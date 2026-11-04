import path from 'path';
import { readJsonFile, writeJsonFileAtomic, localDateKey } from '@/lib/storage/json-store';
import { getStoredCredentials } from '@/lib/config/credentials-manager';

/**
 * Progreso de la audiencia: seguidores por red, publicaciones, "me gusta" y comentarios de Instagram.
 * Se toma una foto al día (storage/metrics_history.json, solo cifras públicas) para ver el crecimiento.
 *
 * Alcance y reproducciones de Instagram NO se pueden leer todavía: exigen el permiso instagram_manage_insights
 * (se agrega al generar el token con TOKEN_FACEBOOK.bat). Mientras tanto, "me gusta" + comentarios son la medida.
 */
const HISTORY_PATH = path.join(process.cwd(), 'storage', 'metrics_history.json');
const GRAPH = 'https://graph.facebook.com/v23.0';

export interface MetricsSnapshot {
  date: string; // AAAA-MM-DD (hora local)
  at: string;
  instagram?: { followers: number; posts: number; likes: number; comments: number; reels: number };
  facebook?: { followers: number };
  bluesky?: { followers: number; posts: number };
  telegram?: { members: number };
  topPost?: { url: string; likes: number; comments: number; type: string; at: string };
}

async function getJson(url: string, token?: string): Promise<any> {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(15_000) });
  return res.json();
}

export async function collectMetrics(now = new Date()): Promise<MetricsSnapshot> {
  const creds = getStoredCredentials();
  const snap: MetricsSnapshot = { date: localDateKey(now), at: now.toISOString() };
  const token = creds.facebookAccessToken;
  const igId = (process.env.INSTAGRAM_USER_ID || '').trim();

  await Promise.all([
    (async () => {
      if (!igId || !token) return;
      const acc = await getJson(`${GRAPH}/${igId}?fields=followers_count,media_count`, token);
      const media = await getJson(`${GRAPH}/${igId}/media?fields=timestamp,media_product_type,like_count,comments_count,permalink&limit=50`, token);
      const posts: any[] = media.data || [];
      if (typeof acc.followers_count === 'number') {
        snap.instagram = {
          followers: acc.followers_count,
          posts: acc.media_count ?? posts.length,
          likes: posts.reduce((s, m) => s + (m.like_count || 0), 0),
          comments: posts.reduce((s, m) => s + (m.comments_count || 0), 0),
          reels: posts.filter((m) => m.media_product_type === 'REELS').length,
        };
      }
      // Mejor publicación de los últimos 3 días
      const since = now.getTime() - 3 * 86_400_000;
      const best = posts
        .filter((m) => new Date(m.timestamp).getTime() >= since)
        .sort((a, b) => (b.like_count || 0) + 3 * (b.comments_count || 0) - ((a.like_count || 0) + 3 * (a.comments_count || 0)))[0];
      if (best) snap.topPost = { url: best.permalink, likes: best.like_count || 0, comments: best.comments_count || 0, type: best.media_product_type, at: best.timestamp };
    })().catch((e) => console.warn("[Métricas]", e?.message)),
    (async () => {
      if (!creds.facebookPageId || !token) return;
      const page = await getJson(`${GRAPH}/${creds.facebookPageId}?fields=followers_count,fan_count`, token);
      const n = page.followers_count ?? page.fan_count;
      if (typeof n === 'number') snap.facebook = { followers: n };
    })().catch((e) => console.warn("[Métricas]", e?.message)),
    (async () => {
      if (!creds.blueskyHandle) return;
      const p = await getJson(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(creds.blueskyHandle)}`);
      if (typeof p.followersCount === 'number') snap.bluesky = { followers: p.followersCount, posts: p.postsCount || 0 };
    })().catch((e) => console.warn("[Métricas]", e?.message)),
    (async () => {
      if (!creds.telegramToken || !creds.telegramChatId) return;
      const r = await getJson(`https://api.telegram.org/bot${creds.telegramToken}/getChatMemberCount?chat_id=${encodeURIComponent(creds.telegramChatId)}`);
      if (r.ok && typeof r.result === 'number') snap.telegram = { members: r.result };
    })().catch((e) => console.warn("[Métricas]", e?.message)),
  ]);
  return snap;
}

export function getMetricsHistory(): MetricsSnapshot[] {
  return readJsonFile<MetricsSnapshot[]>(HISTORY_PATH, []);
}

/** Guarda la foto de hoy (una por día; si ya había, se actualiza) y conserva 120 días */
export async function recordDailyMetrics(now = new Date()): Promise<MetricsSnapshot> {
  const snap = await collectMetrics(now);
  const history = getMetricsHistory().filter((s) => s.date !== snap.date);
  history.push(snap);
  history.sort((a, b) => a.date.localeCompare(b.date));
  writeJsonFileAtomic(HISTORY_PATH, history.slice(-120));
  return snap;
}

const delta = (now: number, before?: number) => (before === undefined ? '' : now - before === 0 ? ' (=)' : ` (${now > before ? '+' : ''}${now - before})`);

/** Líneas legibles de progreso: cifra de hoy y cambio frente a ayer y hace 7 días */
export function progressLines(snap: MetricsSnapshot, history = getMetricsHistory()): string[] {
  const prior = history.filter((s) => s.date < snap.date);
  const yesterday = prior[prior.length - 1];
  const weekAgo = [...prior].reverse().find((s) => new Date(snap.date).getTime() - new Date(s.date).getTime() >= 6 * 86_400_000);
  const row = (label: string, now: number | undefined, pick: (s: MetricsSnapshot) => number | undefined) => {
    if (now === undefined) return null;
    const y = yesterday ? pick(yesterday) : undefined;
    const w = weekAgo ? pick(weekAgo) : undefined;
    return `${label}: <b>${now}</b>${y !== undefined ? ` · ayer${delta(now, y)}` : ''}${w !== undefined ? ` · 7 días${delta(now, w)}` : ''}`;
  };
  return [
    row('📸 Instagram seguidores', snap.instagram?.followers, (s) => s.instagram?.followers),
    row('👍 Instagram "me gusta" (últimas 50)', snap.instagram?.likes, (s) => s.instagram?.likes),
    row('💬 Instagram comentarios (últimas 50)', snap.instagram?.comments, (s) => s.instagram?.comments),
    row('📘 Facebook seguidores', snap.facebook?.followers, (s) => s.facebook?.followers),
    row('🦋 Bluesky seguidores', snap.bluesky?.followers, (s) => s.bluesky?.followers),
    row('✈️ Telegram miembros', snap.telegram?.members, (s) => s.telegram?.members),
  ].filter((l): l is string => !!l);
}
