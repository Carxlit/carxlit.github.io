import fs from 'fs';
import path from 'path';
import { getPublicationQueue, savePublicationQueue, publishMissingChannels, getEffectiveChannels } from './queue-dispatcher';
import { getStoredCredentials, getConfiguredChannels } from '@/lib/config/credentials-manager';
import { checkBlueskySession } from '@/lib/news/bluesky-client';
import { withFileLock, LockBusyError } from '@/lib/storage/json-store';
import { runVisualEngine } from './visual-engine';

type ChannelName = 'facebook' | 'telegram' | 'bluesky' | 'linkedIn' | 'instagram' | 'mastodon';

export interface ChannelHealth {
  channel: ChannelName;
  status: 'online' | 'degraded' | 'offline';
  latencyMs: number;
  message: string;
  configured?: boolean;
  details?: any;
}

export interface NewsroomAuditReport {
  timestamp: string;
  overallHealthScore: number; // 0 - 100
  channels: Record<ChannelName, ChannelHealth>;
  queueStatus: {
    total: number;
    queued: number;
    publishing: number;
    published: number;
    failed: number;
    expired: number;
  };
  healedCount: number;
  healingActions: string[];
  recommendations: string[];
}

/** Los chequeos de conectividad se cachean: no hace falta golpear 4 APIs cada 5 minutos */
const CONNECTIVITY_CACHE_MS = 10 * 60 * 1000;
/** Curación: máximo de reintentos extra, espera entre ellos y antigüedad máxima */
const MAX_HEAL_ATTEMPTS = 3;
const HEAL_COOLDOWN_MS = 30 * 60 * 1000;
const HEAL_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const STUCK_PUBLISHING_MS = 10 * 60 * 1000;

let connectivityCache: { at: number; result: Record<ChannelName, ChannelHealth> } | null = null;

/**
 * 1. Audita la conectividad y validez de las credenciales de los 4 canales
 */
export async function auditChannelsConnectivity(force = false): Promise<Record<ChannelName, ChannelHealth>> {
  if (!force && connectivityCache && Date.now() - connectivityCache.at < CONNECTIVITY_CACHE_MS) {
    return connectivityCache.result;
  }

  const creds = getStoredCredentials();

  // 1. Facebook Graph API
  let fbHealth: ChannelHealth = { channel: 'facebook', status: 'offline', latencyMs: 0, message: 'No configurado', configured: false };
  if (creds.facebookAccessToken && creds.facebookPageId) {
    const t0 = Date.now();
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${creds.facebookPageId}?fields=id,name`,
        { headers: { Authorization: `Bearer ${creds.facebookAccessToken}` }, signal: AbortSignal.timeout(6000) }
      );
      const data = await res.json();
      const latencyMs = Date.now() - t0;
      fbHealth = res.ok && data.id
        ? { channel: 'facebook', status: 'online', latencyMs, configured: true, message: `Conectado a página: ${data.name} (ID: ${data.id})` }
        : { channel: 'facebook', status: 'offline', latencyMs, configured: true, message: data.error?.message || 'Token de Facebook inválido o caducado' };

      // Un token de página corto "funciona" hasta que caduca a mitad del día: avisar con antelación
      if (fbHealth.status === 'online') {
        const dbg = await fetch(
          `https://graph.facebook.com/v19.0/debug_token?input_token=${creds.facebookAccessToken}`,
          { headers: { Authorization: `Bearer ${creds.facebookAccessToken}` }, signal: AbortSignal.timeout(6000) }
        ).then((r) => r.json()).catch(() => null);
        const expiresAt = Number(dbg?.data?.expires_at || 0);
        if (expiresAt > 0) {
          const hoursLeft = (expiresAt * 1000 - Date.now()) / 3_600_000;
          if (hoursLeft < 72) {
            fbHealth = {
              ...fbHealth,
              status: 'degraded',
              message: `El token de Facebook caduca en ${Math.max(0, hoursLeft).toFixed(1)} h. Ejecuta "npm run fb:token" para obtener uno permanente.`,
            };
          }
        }
      }
    } catch (err: any) {
      fbHealth = { channel: 'facebook', status: 'degraded', latencyMs: Date.now() - t0, configured: true, message: `Sin respuesta de Meta: ${err.message}` };
    }
  }

  // 2. Telegram Bot API
  let tgHealth: ChannelHealth = { channel: 'telegram', status: 'offline', latencyMs: 0, message: 'No configurado', configured: false };
  if (creds.telegramToken) {
    const t0 = Date.now();
    try {
      const res = await fetch(`https://api.telegram.org/bot${creds.telegramToken}/getMe`, {
        signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      const latencyMs = Date.now() - t0;
      tgHealth = data.ok && data.result?.username
        ? { channel: 'telegram', status: 'online', latencyMs, configured: true, message: `Bot operativo: @${data.result.username}` }
        : { channel: 'telegram', status: 'offline', latencyMs, configured: true, message: data.description || 'Token de Telegram inválido' };
    } catch (err: any) {
      tgHealth = { channel: 'telegram', status: 'degraded', latencyMs: Date.now() - t0, configured: true, message: err.message };
    }
  }

  // 3. Bluesky AT Protocol (reutiliza la sesión guardada: no crea una nueva en cada auditoría)
  let bskyHealth: ChannelHealth = { channel: 'bluesky', status: 'offline', latencyMs: 0, message: 'No configurado', configured: false };
  if (creds.blueskyHandle && creds.blueskyPassword) {
    const t0 = Date.now();
    try {
      const session = await checkBlueskySession(creds.blueskyHandle, creds.blueskyPassword);
      bskyHealth = { channel: 'bluesky', status: 'online', latencyMs: Date.now() - t0, configured: true, message: `Sesión activa: @${session.handle}` };
    } catch (err: any) {
      bskyHealth = { channel: 'bluesky', status: 'offline', latencyMs: Date.now() - t0, configured: true, message: err.message || 'Error de autenticación Bluesky' };
    }
  }

  // 4. LinkedIn CDP (navegador con --remote-debugging-port=9222)
  let liHealth: ChannelHealth = { channel: 'linkedIn', status: 'degraded', latencyMs: 0, configured: true, message: 'Puerto 9222 no responde. Abre Brave con --remote-debugging-port=9222' };
  if (process.env.LINKEDIN_WEBHOOK_URL) {
    liHealth = { channel: 'linkedIn', status: 'online', latencyMs: 0, configured: true, message: 'Publicación vía webhook de Make' };
  } else if (process.env.LINKEDIN_ENABLED === 'false') {
    liHealth = { channel: 'linkedIn', status: 'offline', latencyMs: 0, configured: false, message: 'Desactivado (LINKEDIN_ENABLED=false)' };
  } else {
    const t0 = Date.now();
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version', { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      if (data && data.Browser) {
        liHealth = { channel: 'linkedIn', status: 'online', latencyMs: Date.now() - t0, configured: true, message: `Navegador CDP activo: ${data.Browser}` };
      }
    } catch {
      // Se queda en 'degraded'
    }
  }

  // 5. Instagram (cuenta profesional vinculada a la página; usa el mismo token de página)
  let igHealth: ChannelHealth = { channel: 'instagram', status: 'offline', latencyMs: 0, configured: false, message: 'Sin cuenta de Instagram vinculada' };
  const igUser = process.env.INSTAGRAM_USER_ID;
  if (igUser && creds.facebookAccessToken) {
    const t0 = Date.now();
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${igUser}?fields=username`, {
        headers: { Authorization: `Bearer ${creds.facebookAccessToken}` },
        signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      igHealth = res.ok && data.username
        ? { channel: 'instagram', status: 'online', latencyMs: Date.now() - t0, configured: true, message: `@${data.username}` }
        : { channel: 'instagram', status: 'offline', latencyMs: Date.now() - t0, configured: true, message: data.error?.message || 'Instagram no responde' };
    } catch (err: any) {
      igHealth = { channel: 'instagram', status: 'degraded', latencyMs: Date.now() - t0, configured: true, message: err.message };
    }
  }

  // 6. Mastodon
  let mastoHealth: ChannelHealth = { channel: 'mastodon', status: 'offline', latencyMs: 0, configured: false, message: 'No configurado' };
  const mastoInstance = (process.env.MASTODON_INSTANCE || '').replace(/\/+$/, '');
  if (mastoInstance && process.env.MASTODON_TOKEN) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${mastoInstance}/api/v1/accounts/verify_credentials`, {
        headers: { Authorization: `Bearer ${process.env.MASTODON_TOKEN}` },
        signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      mastoHealth = res.ok && data.acct
        ? { channel: 'mastodon', status: 'online', latencyMs: Date.now() - t0, configured: true, message: `@${data.acct}` }
        : { channel: 'mastodon', status: 'offline', latencyMs: Date.now() - t0, configured: true, message: data.error || 'Token de Mastodon inválido' };
    } catch (err: any) {
      mastoHealth = { channel: 'mastodon', status: 'degraded', latencyMs: Date.now() - t0, configured: true, message: err.message };
    }
  }

  const result = { facebook: fbHealth, telegram: tgHealth, bluesky: bskyHealth, linkedIn: liHealth, instagram: igHealth, mastodon: mastoHealth };
  connectivityCache = { at: Date.now(), result };
  return result;
}

/**
 * 2. Auditoría y Auto-Sanación de la Cola de Publicaciones
 * - Desbloquea elementos atascados en 'publishing'.
 * - Regenera imágenes perdidas.
 * - Reintenta SOLO los canales que faltan (idempotente), con tope de intentos y espera entre ellos.
 */
export async function auditAndHealQueue(): Promise<{
  healedCount: number;
  actions: string[];
  queueSummary: NewsroomAuditReport['queueStatus'];
}> {
  const queue = getPublicationQueue();
  const actions: string[] = [];
  let healedCount = 0;
  let changed = false;
  const now = Date.now();

  for (const item of queue) {
    // Atascado en 'publishing' (el proceso murió a mitad de envío)
    if (item.status === 'publishing') {
      const lastAttempt = item.lastAttemptAt ? new Date(item.lastAttemptAt).getTime() : 0;
      if (now - lastAttempt > STUCK_PUBLISHING_MS) {
        item.status = 'queued';
        changed = true;
        healedCount++;
        actions.push(`[Auto-Sanador] "${item.news.headline.slice(0, 40)}..." desbloqueado de 'publishing' a 'queued'.`);
      }
      continue;
    }

    if (item.status !== 'failed') continue;

    const age = now - new Date(item.createdAt).getTime();
    const healAttempts = item.healAttempts || 0;
    const sinceLast = now - (item.lastAttemptAt ? new Date(item.lastAttemptAt).getTime() : 0);
    if (age > HEAL_MAX_AGE_MS || healAttempts >= MAX_HEAL_ATTEMPTS || sinceLast < HEAL_COOLDOWN_MS) continue;

    const effective = getEffectiveChannels(item);
    if (effective.length === 0) continue;

    console.log(`[Auto-Sanador] Diagnosticando fallo en: "${item.news.headline}" (curación ${healAttempts + 1}/${MAX_HEAL_ATTEMPTS})...`);
    item.healAttempts = healAttempts + 1;
    item.lastAttemptAt = new Date().toISOString();
    changed = true;

    // Diagnóstico 1: ¿Falta la imagen en disco?
    const news = item.news;
    const imagePath = news.cardImageUrl
      ? path.join(process.cwd(), 'public', news.cardImageUrl.replace(/^\//, ''))
      : '';
    if (!imagePath || !fs.existsSync(imagePath)) {
      try {
        news.cardImageUrl = await runVisualEngine(news);
        actions.push(`[Auto-Sanador] Imagen regenerada para "${news.headline.slice(0, 40)}...".`);
      } catch (imgErr: any) {
        console.error('[Auto-Sanador] Falló regeneración de imagen:', imgErr.message);
        continue;
      }
    }

    // Diagnóstico 2: publicar solo lo que falta
    const before = effective.filter((ch) => item.results?.[ch]?.success).length;
    const { pending, lastError } = await publishMissingChannels(item);
    const after = effective.length - pending.length;

    if (after > before) {
      healedCount++;
      actions.push(`[Auto-Sanador] "${news.headline.slice(0, 40)}...": ${after}/${effective.length} canales publicados.`);
    }

    if (pending.length === 0 || (after > 0 && item.healAttempts >= MAX_HEAL_ATTEMPTS)) {
      item.status = 'published';
      item.publishedAt = new Date().toISOString();
      item.news.status = 'published';
      item.error = pending.length > 0 ? `Publicado parcialmente. No se pudo en: ${pending.join(', ')}` : undefined;
      actions.push(`[Auto-Sanador] Publicación cerrada: "${news.headline.slice(0, 40)}...".`);
    } else {
      item.error = `Curación ${item.healAttempts}/${MAX_HEAL_ATTEMPTS}: ${lastError}`;
    }
  }

  if (changed) savePublicationQueue(queue);

  const queueSummary = {
    total: queue.length,
    queued: queue.filter((q) => q.status === 'queued').length,
    publishing: queue.filter((q) => q.status === 'publishing').length,
    published: queue.filter((q) => q.status === 'published').length,
    failed: queue.filter((q) => q.status === 'failed').length,
    expired: queue.filter((q) => q.status === 'expired').length,
  };

  return { healedCount, actions, queueSummary };
}

/**
 * 3. Ejecuta una auditoría integral del Newsroom con cálculo de Health Score y recomendaciones
 */
export async function runFullNewsroomAudit(options: { forceConnectivity?: boolean } = {}): Promise<NewsroomAuditReport> {
  const channels = await auditChannelsConnectivity(options.forceConnectivity);

  let healing: Awaited<ReturnType<typeof auditAndHealQueue>>;
  try {
    // Comparte candado con el ciclo editorial: nunca tocan la cola a la vez
    healing = await withFileLock('newsroom', () => auditAndHealQueue());
  } catch (err) {
    if (!(err instanceof LockBusyError)) throw err;
    const queue = getPublicationQueue();
    healing = {
      healedCount: 0,
      actions: ['[Auditor] Ciclo editorial en curso; la curación se hará en el próximo turno.'],
      queueSummary: {
        total: queue.length,
        queued: queue.filter((q) => q.status === 'queued').length,
        publishing: queue.filter((q) => q.status === 'publishing').length,
        published: queue.filter((q) => q.status === 'published').length,
        failed: queue.filter((q) => q.status === 'failed').length,
        expired: queue.filter((q) => q.status === 'expired').length,
      },
    };
  }
  const { healedCount, actions, queueSummary } = healing;

  // Health Score sobre los canales configurados (un canal sin credenciales no resta)
  const configured = getConfiguredChannels();
  const active = (Object.keys(channels) as ChannelName[]).filter((ch) => configured[ch]);
  const perChannel = active.length > 0 ? 100 / active.length : 0;
  let channelScore = 0;
  for (const ch of active) {
    if (channels[ch].status === 'online') channelScore += perChannel;
    else if (channels[ch].status === 'degraded') channelScore += perChannel * 0.4;
  }

  const failurePenalty = queueSummary.failed * 10;
  const overallHealthScore = Math.round(Math.max(0, Math.min(100, channelScore - failurePenalty)));

  const recommendations: string[] = [];
  if (configured.facebook && channels.facebook.status !== 'online') {
    recommendations.push(channels.facebook.message || 'Renovar el Page Access Token de Facebook ("npm run fb:token").');
  }
  if (configured.linkedIn && channels.linkedIn.status !== 'online') {
    recommendations.push('Abre Brave con el flag: --remote-debugging-port=9222 para activar publicación en LinkedIn.');
  }
  if (configured.telegram && channels.telegram.status !== 'online') {
    recommendations.push('Verificar el token de Telegram Bot.');
  }
  if (configured.bluesky && channels.bluesky.status !== 'online') {
    recommendations.push('Verificar credenciales de Bluesky (usa una App Password).');
  }
  if (queueSummary.failed > 0) {
    recommendations.push(`Hay ${queueSummary.failed} publicaciones con fallos. El Auto-Sanador las reintentará hasta ${MAX_HEAL_ATTEMPTS} veces (cada 30 min).`);
  }

  return {
    timestamp: new Date().toISOString(),
    overallHealthScore,
    channels,
    queueStatus: queueSummary,
    healedCount,
    healingActions: actions,
    recommendations,
  };
}
