import path from 'path';
import { execSync } from 'child_process';
import {
  QueuedPublication,
  ProcessedNews,
  ChannelSelection,
  ChannelResult,
} from '@/types/news';
import { publishToFacebook } from '@/lib/news/facebook-publisher';
import { publishToTelegram, publishToBluesky } from '@/lib/news/multi-publisher';
import { publishToLinkedInCompany } from '@/lib/news/linkedin-publisher';
import { publishToInstagram, publishToMastodon, publishInstagramReel, publishFacebookReel } from '@/lib/news/extra-publishers';
import { getNewsReel } from '@/lib/video/reel-generator';
import { publishToThreads } from '@/lib/news/threads-publisher';
import { publishYoutubeShort } from '@/lib/news/youtube-publisher';
import { getStoredCredentials, getConfiguredChannels } from '@/lib/config/credentials-manager';
import { readJsonFile, writeJsonFileAtomic } from '@/lib/storage/json-store';
import { markStoryAsCovered } from './news-scout';
import { isUrlLive, getPublicSiteUrl, attachReelToArticle } from '@/lib/site/static-site';
import { withArticleLink } from '@/lib/news/post-links';

const QUEUE_PATH = path.join(process.cwd(), 'storage', 'publication_queue.json');
const PUBLISHED_STORE_PATH = path.join(process.cwd(), 'storage', 'published_news.json');

/** Una noticia que lleva más de este tiempo en cola sin salir ya no es noticia */
const MAX_NEWS_AGE_HOURS = 18;
/** Separación mínima entre publicaciones al recuperar atrasos (p. ej. tras apagar el PC) */
const CATCH_UP_SPACING_MINUTES = 50;
/** Se conservan en disco solo los últimos N elementos cerrados (publicados/fallidos/caducados) */
const MAX_CLOSED_ITEMS = 150;

const CHANNELS = ['facebook', 'telegram', 'bluesky', 'linkedIn', 'instagram', 'facebookReel', 'mastodon', 'threads', 'youtube'] as const;

const reelsEnabled = () => process.env.REELS_ENABLED === 'true';
/**
 * Solo las noticias con video LIBRE del hecho (Creative Commons) salen como Reel, montado con esas imágenes;
 * el resto, como post con imagen (los videos con dueño solo se incrustan en el artículo de la página)
 */
const wantsReel = (news: ProcessedNews) => reelsEnabled() && news.sourceVideo?.license === 'cc-by';
/**
 * Excepción SOLO para Instagram (decisión del dueño): toda noticia sale como Reel; con video real si lo hay
 * y, si no, el Reel narrado con la foto. Desactivable con IG_AI_REELS=false.
 */
const igAlwaysReel = () => reelsEnabled() && process.env.IG_AI_REELS !== 'false';
type Channel = (typeof CHANNELS)[number];

/**
 * Estrategia de community management para Instagram (aprobada por el dueño el 2026-11-14 tras
 * auditar @puntociego.glob: 13–20 posts/día con 57% en cero likes y casi sin comentarios;
 * aplicada a esta redacción el 2026-11-21):
 *  - Máximo 5 Reels al día (IG_DAILY_CAP) y solo historias con urgencia >= 78 (IG_MIN_URGENCY).
 *  - Los Reels se concentran en la franja de mayor audiencia: 18:00–21:00 hora de Bogotá.
 *    Fuera de franja, el Reel se reprograma como ítem solo-Instagram a la próxima apertura;
 *    la historia sale igual en los demás canales. Si ya se reprogramó una vez (igDeferred),
 *    se publica cuando venza para no perderla.
 *  - Las urgencias máximas (isBreaking) no esperan franja ni puntaje.
 * Solo afecta al canal Instagram; el resto de canales y la web no cambian.
 */
const IG_DAILY_CAP = () => Math.max(1, Number(process.env.IG_DAILY_CAP || 5) || 5);
const IG_MIN_URGENCY = () => Number(process.env.IG_MIN_URGENCY || 78) || 78;
const IG_WINDOW_START_HOUR = 18; // Bogotá
const IG_WINDOW_END_HOUR = 21; // Bogotá

function bogotaParts(date: Date): { hour: number; dateKey: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    hour: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return { hour: Number(get('hour')) % 24, dateKey: `${get('year')}-${get('month')}-${get('day')}` };
}

/** Reels de Instagram ya publicados hoy (hora de Bogotá), según la cola persistida */
function countInstagramPostsToday(): number {
  const today = bogotaParts(new Date()).dateKey;
  return getPublicationQueue().filter((q) => {
    if (!q.results?.instagram?.success) return false;
    const when = q.publishedAt || q.lastAttemptAt;
    return when ? bogotaParts(new Date(when)).dateKey === today : false;
  }).length;
}

/** Próxima apertura de la franja de Instagram (Bogotá es UTC-5 todo el año: 18:00 = 23:00 UTC) */
function nextInstagramWindowStart(): Date {
  const start = new Date();
  start.setUTCHours(23, 0, 0, 0);
  if (start.getTime() <= Date.now()) start.setUTCDate(start.getUTCDate() + 1);
  return start;
}

type InstagramGate = { action: 'publish' } | { action: 'skip' | 'defer'; reason: string };

function evaluateInstagramGate(item: QueuedPublication): InstagramGate {
  if (item.isBreaking) return { action: 'publish' };
  const urgency = item.news.urgencyScore || 0;
  if (urgency < IG_MIN_URGENCY()) {
    return { action: 'skip', reason: `Estrategia IG: urgencia ${urgency} menor que ${IG_MIN_URGENCY()}; Instagram solo recibe lo mejor del día` };
  }
  if (countInstagramPostsToday() >= IG_DAILY_CAP()) {
    return { action: 'skip', reason: `Estrategia IG: límite diario de ${IG_DAILY_CAP()} Reels alcanzado` };
  }
  const { hour } = bogotaParts(new Date());
  const inWindow = hour >= IG_WINDOW_START_HOUR && hour < IG_WINDOW_END_HOUR;
  if (!inWindow && !item.igDeferred) {
    return { action: 'defer', reason: `Estrategia IG: fuera de la franja 18:00–21:00 (Bogotá); el Reel se reprograma a la franja` };
  }
  return { action: 'publish' };
}

export interface EnqueueOptions {
  forceImmediate?: boolean;
  minJitterMinutes?: number; // Por defecto: 45 minutos
  maxJitterMinutes?: number; // Por defecto: 75 minutos
  scheduledFor?: Date; // Hora exacta calculada por el newsroom
  isBreaking?: boolean; // Protocolo de Urgencia Máxima
}

export interface DispatcherCredentials {
  facebookPageId?: string;
  facebookAccessToken?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  blueskyHandle?: string;
  blueskyPassword?: string;
}

/**
 * Lee la cola persistente desde storage/publication_queue.json
 */
export function getPublicationQueue(): QueuedPublication[] {
  const data = readJsonFile<any>(QUEUE_PATH, []);
  return Array.isArray(data) ? data : (data.queue || []);
}

/**
 * Guarda la cola persistente (escritura atómica) y poda el histórico cerrado
 */
/**
 * Guarda en git el estado de la redacción inmediatamente tras cada publicación exitosa en redes.
 * Solo activo en GitHub Actions (en local no interrumpe ni corre comandos bash de actions).
 */
export function persistStateToGit(message?: string): boolean {
  if (process.env.GITHUB_ACTIONS !== 'true') return false;
  try {
    const cleanMsg = (message || 'Publicaciones').replace(/["`$\\]/g, ' ').slice(0, 60).trim();
    console.log(`[QueueDispatcher] Guardando estado en git tras publicación: "${cleanMsg}"...`);
    execSync(`bash deploy/github/save-state.sh "${cleanMsg}"`, {
      stdio: 'inherit',
      timeout: 180_000,
    });
    return true;
  } catch (err: any) {
    console.warn('[QueueDispatcher] Error guardando estado en git tras publicación:', err?.message);
    return false;
  }
}

export function savePublicationQueue(queue: QueuedPublication[]) {
  try {
    const open = queue.filter((q) => q.status === 'queued' || q.status === 'publishing');
    const closed = queue
      .filter((q) => q.status !== 'queued' && q.status !== 'publishing')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_CLOSED_ITEMS);
    const kept = new Set([...open, ...closed]);
    writeJsonFileAtomic(QUEUE_PATH, queue.filter((q) => kept.has(q)));
  } catch (err) {
    console.error('[QueueDispatcher] Error al guardar cola de publicaciones:', err);
  }
}

/**
 * Calcula un jitter aleatorio en minutos (ej. entre 45 y 75 minutos)
 */
export function generateJitterDelayMinutes(min: number = 45, max: number = 75): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Agrega una noticia a la cola con cálculo de Anti-Spam Jitter.
 * La historia se marca como cubierta en el acto para que el Scout no la vuelva a elegir.
 */
export function enqueuePublication(
  news: ProcessedNews,
  channels: ChannelSelection,
  customCopies?: QueuedPublication['customCopies'],
  options: EnqueueOptions = {}
): QueuedPublication {
  const queue = getPublicationQueue();
  const minJitter = options.minJitterMinutes ?? 45;
  const maxJitter = options.maxJitterMinutes ?? 75;

  let scheduledDate: Date;

  if (options.forceImmediate) {
    scheduledDate = new Date();
  } else if (options.scheduledFor) {
    scheduledDate = options.scheduledFor;
  } else {
    // Buscar la última publicación encolada pendiente para encadenar
    const pendingItems = queue
      .filter((q) => q.status === 'queued')
      .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime());

    const now = Date.now();
    let baselineTimestamp = now;

    if (pendingItems.length > 0) {
      const lastScheduledTime = new Date(pendingItems[0].scheduledFor).getTime();
      if (lastScheduledTime > now) {
        baselineTimestamp = lastScheduledTime;
      }
    }

    const jitterMinutes = generateJitterDelayMinutes(minJitter, maxJitter);
    scheduledDate = new Date(baselineTimestamp + jitterMinutes * 60 * 1000);
  }

  const queuedItem: QueuedPublication = {
    id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    news: {
      ...news,
      facebookPost: customCopies?.facebook || news.facebookPost,
      xPost: customCopies?.twitter || news.xPost,
      telegramPost: customCopies?.telegram || news.telegramPost,
      linkedInPost: customCopies?.linkedIn || news.linkedInPost,
      blueskyPost: customCopies?.bluesky || news.blueskyPost,
    },
    channels,
    customCopies,
    scheduledFor: scheduledDate.toISOString(),
    status: 'queued',
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    ...(options.isBreaking ? { isBreaking: true } : {}),
  };

  queue.push(queuedItem);
  savePublicationQueue(queue);

  if (news.originalUrl) {
    markStoryAsCovered(news.originalUrl, [news.originalTitle, news.headline]);
  }

  return queuedItem;
}

function resolveCredentials(credentials?: DispatcherCredentials) {
  const stored = getStoredCredentials();
  return {
    facebookPageId: credentials?.facebookPageId || stored.facebookPageId,
    facebookAccessToken: credentials?.facebookAccessToken || stored.facebookAccessToken,
    telegramToken: credentials?.telegramBotToken || stored.telegramToken,
    telegramChatId: credentials?.telegramChatId || stored.telegramChatId,
    blueskyHandle: credentials?.blueskyHandle || stored.blueskyHandle,
    blueskyPassword: credentials?.blueskyPassword || stored.blueskyPassword,
  };
}

/**
 * Canales que se intentan para un ítem: pedidos Y con credenciales reales
 */
export function getEffectiveChannels(item: QueuedPublication, credentials?: DispatcherCredentials): Channel[] {
  const configured = getConfiguredChannels(resolveCredentials(credentials));
  return CHANNELS.filter((ch) => item.channels[ch] && configured[ch]);
}

/**
 * Publica en un canal concreto. Nunca lanza: devuelve el resultado.
 */
async function publishToChannel(
  channel: Channel,
  news: ProcessedNews,
  creds: ReturnType<typeof resolveCredentials>,
  lastChance = true
): Promise<ChannelResult & Record<string, any>> {
  try {
    switch (channel) {
      case 'facebook':
        return await publishToFacebook(news, creds.facebookPageId, creds.facebookAccessToken);
      case 'telegram':
        return await publishToTelegram(news, creds.telegramToken, creds.telegramChatId);
      case 'bluesky':
        return await publishToBluesky(news, creds.blueskyHandle, creds.blueskyPassword);
      case 'linkedIn':
        return await publishToLinkedInCompany(news);
      case 'instagram': {
        // Con Reels activados, Instagram recibe el video; si el video falla, la tarjeta vertical de siempre
        if (wantsReel(news) || igAlwaysReel()) {
          const video = await getNewsReel(news, { allowAi: igAlwaysReel() }).catch((e) => {
            console.warn('[QueueDispatcher] Reel no disponible, Instagram usa la imagen:', e?.message);
            return null;
          });
          if (video) {
            // Meta falla a veces de forma pasajera ("Request processing failed"): se reintenta la subida antes de rendirse
            let reel = await publishInstagramReel(news, creds.facebookAccessToken!, video);
            for (let retry = 1; !reel.success && retry <= 2; retry++) {
              console.warn(`[QueueDispatcher] ${reel.error} → reintento ${retry}/2 del Reel`);
              await new Promise((r) => setTimeout(r, retry * 20_000));
              // Si la portada propia estorbara, el reintento sale con el fotograma por defecto
              reel = await publishInstagramReel(news, creds.facebookAccessToken!, video, { cover: retry < 2 });
            }
            if (reel.success) {
              if (reel.permalink && news.article?.slug) attachReelToArticle(news.article.slug, reel.permalink);
              return reel;
            }
            // Instagram siempre es Reel: si falla, el canal queda pendiente y vuelve a intentarlo el siguiente ciclo.
            // Solo en el último intento de la noticia se publica la imagen para no perder la historia.
            if (!lastChance) return { success: false, error: `${reel.error} (se reintenta como Reel)` };
            console.warn('[QueueDispatcher]', reel.error, '→ último intento: se publica la imagen');
          }
        }
        return await publishToInstagram(news, creds.facebookAccessToken);
      }
      case 'facebookReel': {
        if (!wantsReel(news)) return { success: false, skipped: true, error: 'Noticia sin video libre: solo post con imagen' };
        const video = await getNewsReel(news).catch((e) => ({ error: e?.message as string }));
        if (typeof video !== 'string') {
          // Un video que no se pudo generar no bloquea la publicación de la historia
          return { success: false, skipped: true, error: `Reel no generado: ${video.error}` };
        }
        return await publishFacebookReel(news, creds.facebookPageId!, creds.facebookAccessToken!, video);
      }
      case 'mastodon':
        return await publishToMastodon(news);
      case 'threads':
        return await publishToThreads(news);
      case 'youtube': {
        if (!wantsReel(news)) return { success: false, skipped: true, error: 'Noticia sin video libre: no se sube a YouTube' };
        const video = await getNewsReel(news).catch((e) => ({ error: e?.message as string }));
        if (typeof video !== 'string') return { success: false, skipped: true, error: `Short no generado: ${video.error}` };
        return await publishYoutubeShort(news, video);
      }
    }
  } catch (err: any) {
    return { success: false, error: err?.message || `Error en ${channel}` };
  }
}

/**
 * Registra la noticia publicada en storage/published_news.json (historial del panel)
 */
function appendPublishedHistory(news: ProcessedNews) {
  const history = readJsonFile<ProcessedNews[]>(PUBLISHED_STORE_PATH, []);
  if (history.some((h) => h.id === news.id && h.originalUrl === news.originalUrl)) return;
  history.unshift(news);
  writeJsonFileAtomic(PUBLISHED_STORE_PATH, history.slice(0, 200));
}

/** Cambia la base de un enlace de artículo (p. ej. carxlit.github.io) por PUBLIC_SITE_URL, conservando la ruta */
function currentSiteArticleUrl(url?: string): string | undefined {
  const base = getPublicSiteUrl();
  if (!url || !base) return url;
  const i = url.indexOf('/noticias/');
  return i >= 0 ? `${base}${url.slice(i)}` : url;
}

/**
 * Publica solo en los canales que faltan (idempotente: nunca repite un canal que ya tuvo éxito)
 * y actualiza `item.results`. Devuelve los canales que siguen pendientes.
 */
export async function publishMissingChannels(
  item: QueuedPublication,
  credentials?: DispatcherCredentials
): Promise<{ pending: Channel[]; lastError: string }> {
  const creds = resolveCredentials(credentials);
  const basePayload: ProcessedNews = {
    ...item.news,
    facebookPost: item.customCopies?.facebook || item.news.facebookPost,
    xPost: item.customCopies?.twitter || item.news.xPost,
    telegramPost: item.customCopies?.telegram || item.news.telegramPost,
    linkedInPost: item.customCopies?.linkedIn || item.news.linkedInPost,
    blueskyPost: item.customCopies?.bluesky || item.news.blueskyPost,
  };
  // Historias encoladas antes de un cambio de dominio: se enlazan a la dirección actual del sitio
  const articleUrl = currentSiteArticleUrl(item.news.articleUrl);
  // El enlace al artículo completo solo se adjunta si la página responde en este momento
  const liveArticleUrl = articleUrl && (await isUrlLive(articleUrl)) ? articleUrl : undefined;
  const newsPayload: ProcessedNews = { ...withArticleLink(basePayload, liveArticleUrl), articleUrl: liveArticleUrl };

  const results: NonNullable<QueuedPublication['results']> = { ...(item.results || {}) };
  const effective = getEffectiveChannels(item, credentials);
  let lastError = '';

  // Canales pedidos pero sin credenciales: se dejan constancia y no bloquean
  for (const ch of CHANNELS) {
    if (item.channels[ch] && !effective.includes(ch) && !results[ch]?.success) {
      results[ch] = { success: false, skipped: true, error: 'Canal sin credenciales configuradas (omitido)' };
    }
  }

  for (const ch of effective) {
    if (results[ch]?.success || results[ch]?.skipped) continue;
    if (ch === 'instagram') {
      const gate = evaluateInstagramGate(item);
      if (gate.action !== 'publish') {
        results[ch] = { success: false, skipped: true, error: gate.reason };
        item.results = { ...results };
        console.log(`[QueueDispatcher] ${gate.reason} — "${item.news.headline}"`);
        if (gate.action === 'defer') {
          // La historia sigue su curso en los demás canales; el Reel queda encolado
          // como ítem solo-Instagram para la próxima franja de audiencia.
          const igOnly: ChannelSelection = {
            facebook: false, telegram: false, bluesky: false, linkedIn: false,
            instagram: true, facebookReel: false, mastodon: false, threads: false, youtube: false,
          };
          const deferred = enqueuePublication(newsPayload, igOnly, undefined, {
            scheduledFor: nextInstagramWindowStart(),
          });
          const freshQueue = getPublicationQueue();
          const deferredIdx = freshQueue.findIndex((q) => q.id === deferred.id);
          if (deferredIdx !== -1) {
            freshQueue[deferredIdx].igDeferred = true;
            savePublicationQueue(freshQueue);
          }
        }
        continue;
      }
    }
    const res = await publishToChannel(ch, newsPayload, creds, item.attempts >= item.maxAttempts);
    results[ch] = res as any;
    if (res.success) {
      item.results = { ...results };
      // Guardar de inmediato en disco para que ningún canal exitoso se pierda si otro falla después
      const curQueue = getPublicationQueue();
      const idx = curQueue.findIndex((q) => q.id === item.id);
      if (idx !== -1) {
        curQueue[idx].results = { ...(curQueue[idx].results || {}), [ch]: res };
        savePublicationQueue(curQueue);
      }
    }
    if (!res.success && !res.skipped) {
      lastError = `${ch}: ${res.error || 'error desconocido'}`;
      console.warn(`[QueueDispatcher] Falló ${ch}:`, res.error);
    }
  }

  item.results = results;
  // "skipped" (p. ej. un Reel que no se pudo generar) no bloquea ni se reintenta
  return { pending: effective.filter((ch) => !results[ch]?.success && !results[ch]?.skipped), lastError };
}

/**
 * Marca el ítem como publicado y guarda la noticia en el historial del panel
 */
function markPublished(item: QueuedPublication, failedChannels: Channel[] = []) {
  item.status = 'published';
  item.publishedAt = new Date().toISOString();
  item.news.status = 'published';
  item.news.publishedAt = item.publishedAt;
  item.error = failedChannels.length > 0
    ? `Publicado parcialmente. No se pudo en: ${failedChannels.join(', ')}`
    : undefined;
  appendPublishedHistory(item.news);
}

/**
 * Ejecuta el envío real u omnicanal de un elemento específico de la cola
 */
export async function dispatchPublication(
  item: QueuedPublication,
  credentials?: DispatcherCredentials
): Promise<QueuedPublication> {
  item.status = 'publishing';
  item.attempts += 1;
  item.lastAttemptAt = new Date().toISOString();

  const effective = getEffectiveChannels(item, credentials);
  if (effective.length === 0) {
    item.status = 'failed';
    item.error = 'Ningún canal seleccionado tiene credenciales configuradas.';
    return item;
  }

  const { pending, lastError } = await publishMissingChannels(item, credentials);
  const anySuccess = effective.some((ch) => item.results?.[ch]?.success);

  if (pending.length === 0) {
    markPublished(item);
  } else if (item.attempts < item.maxAttempts) {
    // Backoff para reintentar solo los canales que faltan: +3 min, luego +15 min
    item.status = 'queued';
    const backoffMinutes = item.attempts === 1 ? 3 : 15;
    item.scheduledFor = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
    item.error = `Reintento ${item.attempts}/${item.maxAttempts}: ${lastError}`;
  } else if (anySuccess) {
    // Ya salió en al menos una red: se da por publicada y el Auditor no la vuelve a lanzar
    markPublished(item, pending);
  } else {
    item.status = 'failed';
    item.error = `Falló tras ${item.attempts} intentos: ${lastError}`;
  }

  return item;
}

/**
 * Caduca noticias viejas y re-espacia los atrasos para no publicar en ráfaga
 * cuando el sistema vuelve de estar apagado.
 */
function normalizePendingSchedule(queue: QueuedPublication[]) {
  const now = Date.now();
  const pending = queue
    .filter((q) => q.status === 'queued')
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());

  let cursor: number | null = null;
  for (const item of pending) {
    const ageHours = (now - new Date(item.createdAt).getTime()) / 3_600_000;
    const neverPublished = !CHANNELS.some((ch) => item.results?.[ch]?.success);
    if (ageHours > MAX_NEWS_AGE_HOURS && neverPublished) {
      item.status = 'expired';
      item.error = `Caducada: llevaba ${Math.round(ageHours)} h en cola sin publicarse.`;
      continue;
    }

    // Hora efectiva: un atrasado cuenta como "ahora"
    const effective = Math.max(new Date(item.scheduledFor).getTime(), now);
    if (cursor === null) {
      cursor = effective;
    } else if (effective < cursor + CATCH_UP_SPACING_MINUTES * 60_000) {
      cursor += generateJitterDelayMinutes(CATCH_UP_SPACING_MINUTES, CATCH_UP_SPACING_MINUTES + 25) * 60_000;
      item.scheduledFor = new Date(cursor).toISOString();
    } else {
      cursor = effective;
    }
  }
}

/**
 * Revisa la cola y despacha (uno por ciclo) el elemento que haya alcanzado su scheduledFor
 */
export async function dispatchDueItems(
  credentials?: DispatcherCredentials
): Promise<{ processed: number; items: QueuedPublication[] }> {
  const queue = getPublicationQueue();
  normalizePendingSchedule(queue);

  const now = Date.now();
  const processedItems: QueuedPublication[] = [];

  const due = queue
    .filter((q) => q.status === 'queued' && new Date(q.scheduledFor).getTime() <= now)
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];

  if (due) {
    // Persistir 'publishing' antes de llamar a las redes: si el proceso muere, el Auditor lo recupera
    due.status = 'publishing';
    due.lastAttemptAt = new Date().toISOString();
    savePublicationQueue(queue);
    due.status = 'queued';

    await dispatchPublication(due, credentials);
    processedItems.push(due);
  }

  // Re-leer y fusionar para no pisar cambios hechos durante el envío
  const latest = getPublicationQueue();
  const byId = new Map(queue.map((q) => [q.id, q]));
  const merged = latest.map((q) => byId.get(q.id) || q);
  queue.forEach((q) => { if (!latest.some((l) => l.id === q.id)) merged.push(q); });
  savePublicationQueue(merged);

  // Si se publicó con éxito en al menos un canal, persistir en git de inmediato
  if (due && CHANNELS.some((ch) => due.results?.[ch]?.success)) {
    persistStateToGit(`Publicado: ${due.news.headline}`);
  }

  return { processed: processedItems.length, items: processedItems };
}

/**
 * Cancela o elimina un ítem de la cola
 */
export function cancelQueuedPublication(id: string): boolean {
  let queue = getPublicationQueue();
  const initialLength = queue.length;
  queue = queue.filter((item) => item.id !== id);
  if (queue.length !== initialLength) {
    savePublicationQueue(queue);
    return true;
  }
  return false;
}

/**
 * Fuerza el despacho inmediato de un elemento en cola saltando el jitter
 */
/** Deja estos ítems en cola como vencidos ya (publicación manual de prueba desde GitHub) */
export function makeDueNow(ids: string[]) {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  const queue = getPublicationQueue();
  for (const item of queue) {
    if (ids.includes(item.id) && item.status === 'queued') item.scheduledFor = now;
  }
  savePublicationQueue(queue);
}

export async function forcePublishQueuedItem(
  id: string,
  credentials?: DispatcherCredentials
): Promise<QueuedPublication | null> {
  const queue = getPublicationQueue();
  const index = queue.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const item = queue[index];
  if (item.status === 'published') return item;

  const updated = await dispatchPublication(item, credentials);
  const latest = getPublicationQueue();
  const latestIdx = latest.findIndex((q) => q.id === id);
  if (latestIdx !== -1) latest[latestIdx] = updated;
  else latest.push(updated);
  savePublicationQueue(latest);

  if (updated && CHANNELS.some((ch) => updated.results?.[ch]?.success)) {
    persistStateToGit(`Publicado urgente: ${updated.news.headline}`);
  }

  return updated;
}
