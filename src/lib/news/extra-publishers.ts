import fs from 'fs';
import path from 'path';
import { ProcessedNews, ChannelResult } from '@/types/news';

const GRAPH = 'https://graph.facebook.com/v19.0';

/**
 * Imagen pública del artículo (copiada al sitio por el Editor Web): Instagram exige una URL accesible.
 * Preferimos la vertical 4:5 (img/<slug>-ig.jpg) si existe en el sitio; si no, la horizontal.
 */
function publicCardUrl(news: ProcessedNews): string | undefined {
  const site = (process.env.PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  const slug = news.article?.slug;
  if (!site || !slug) return undefined;
  const vertical = path.join(process.cwd(), 'site', 'img', `${slug}-ig.jpg`);
  return fs.existsSync(vertical) ? `${site}/img/${slug}-ig.jpg` : `${site}/img/${slug}.jpg`;
}

/** Instagram no enlaza URLs en el texto: se cambian por un aviso de "enlace en el perfil" */
export function buildInstagramCaption(news: ProcessedNews): string {
  const base = (news.facebookPost || `${news.headline}\n\n${news.subHeadline}`)
    .replace(/Análisis completo:\s*\S+/i, '🔗 Análisis completo: enlace en nuestro perfil')
    .replace(/Fuente:\s*/i, 'Fuente: ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return base.length > 2100 ? `${base.slice(0, 2097)}…` : base;
}

/**
 * Instagram (cuenta profesional vinculada a la página de Facebook) con la Graph API:
 * contenedor de imagen → esperar a que se procese → publicar.
 * Necesita INSTAGRAM_USER_ID y un token de página con instagram_content_publish.
 */
export async function publishToInstagram(news: ProcessedNews, pageToken?: string): Promise<ChannelResult & { mediaId?: string }> {
  const igUser = (process.env.INSTAGRAM_USER_ID || '').trim();
  if (!igUser || !pageToken) return { success: false, error: 'Instagram sin cuenta vinculada o sin token' };
  const imageUrl = publicCardUrl(news);
  if (!imageUrl) return { success: false, error: 'Instagram necesita la imagen pública del artículo (PUBLIC_SITE_URL)' };

  const auth = { Authorization: `Bearer ${pageToken}` };
  const call = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { ...init, headers: { ...auth, ...(init?.headers || {}) }, signal: AbortSignal.timeout(30_000) });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error?.message || `HTTP ${res.status}`);
    return data;
  };

  try {
    const container = await call(`${GRAPH}/${igUser}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption: buildInstagramCaption(news) }),
    });
    // Instagram descarga y procesa la imagen de forma asíncrona
    for (let i = 0; i < 12; i++) {
      const st = await call(`${GRAPH}/${container.id}?fields=status_code`);
      if (st.status_code === 'FINISHED') break;
      if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new Error(`Instagram no pudo procesar la imagen (${st.status_code})`);
      await new Promise((r) => setTimeout(r, 5000));
    }
    const published = await call(`${GRAPH}/${igUser}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id }),
    });
    return { success: true, mediaId: published.id };
  } catch (err: any) {
    return { success: false, error: `Instagram: ${err?.message}` };
  }
}

/** Espera a que Meta termine de procesar un contenedor de Instagram (los videos tardan más) */
async function waitForIgContainer(containerId: string, token: string, maxSeconds: number) {
  const started = Date.now();
  while (Date.now() - started < maxSeconds * 1000) {
    const res = await fetch(`${GRAPH}/${containerId}?fields=status_code,status`, { headers: { Authorization: `Bearer ${token}` } });
    const st: any = await res.json().catch(() => ({}));
    if (st.status_code === 'FINISHED') return;
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new Error(`procesamiento ${st.status_code}: ${st.status || ''}`);
    await new Promise((r) => setTimeout(r, 6000));
  }
  throw new Error('Instagram tardó demasiado en procesar el video');
}

/**
 * Reel de Instagram subiendo el MP4 directamente (subida reanudable): no hace falta alojar el video.
 * share_to_feed: también aparece en la cuadrícula del perfil.
 */
export async function publishInstagramReel(news: ProcessedNews, pageToken: string, videoPath: string): Promise<ChannelResult & { mediaId?: string }> {
  const igUser = (process.env.INSTAGRAM_USER_ID || '').trim();
  // La subida reanudable a Instagram necesita una versión reciente de la Graph API
  const REEL_API = 'v23.0';
  try {
    const init = await fetch(`https://graph.facebook.com/${REEL_API}/${igUser}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pageToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'REELS', upload_type: 'resumable', caption: buildInstagramCaption(news), share_to_feed: true }),
    });
    const container: any = await init.json();
    if (!init.ok || !container.id) throw new Error(container.error?.message || `HTTP ${init.status}`);

    const bytes = fs.readFileSync(videoPath);
    const up = await fetch(container.uri || `https://rupload.facebook.com/ig-api-upload/${REEL_API}/${container.id}`, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${pageToken}`,
        offset: '0',
        file_size: String(bytes.length),
        'Content-Type': 'application/octet-stream',
      },
      body: bytes,
      signal: AbortSignal.timeout(180_000),
    });
    const upData: any = await up.json().catch(() => ({}));
    if (!up.ok || upData.success === false) throw new Error(`subida: ${upData.debug_info?.message || upData.error?.message || up.status}`);

    await waitForIgContainer(container.id, pageToken, 240);
    const pub = await fetch(`https://graph.facebook.com/${REEL_API}/${igUser}/media_publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pageToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id }),
    });
    const published: any = await pub.json();
    if (!pub.ok || !published.id) throw new Error(published.error?.message || `HTTP ${pub.status}`);
    return { success: true, mediaId: published.id };
  } catch (err: any) {
    return { success: false, error: `Reel de Instagram: ${err?.message}` };
  }
}

/** Texto del Reel de Facebook: el post corto + el enlace al análisis */
export function buildFacebookReelDescription(news: ProcessedNews): string {
  const body = (news.blueskyPost || news.subHeadline || news.headline).trim();
  return news.articleUrl ? `${body}\n\nAnálisis completo: ${news.articleUrl}` : body;
}

/** Reel de la página de Facebook (API video_reels: iniciar → subir binario → publicar) */
export async function publishFacebookReel(
  news: ProcessedNews,
  pageId: string,
  pageToken: string,
  videoPath: string
): Promise<ChannelResult & { videoId?: string }> {
  try {
    const start = await fetch(`${GRAPH}/${pageId}/video_reels`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pageToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_phase: 'start' }),
    });
    const s: any = await start.json();
    if (!start.ok || !s.video_id) throw new Error(s.error?.message || `HTTP ${start.status}`);

    const bytes = fs.readFileSync(videoPath);
    const up = await fetch(s.upload_url || `https://rupload.facebook.com/video-upload/v19.0/${s.video_id}`, {
      method: 'POST',
      headers: { Authorization: `OAuth ${pageToken}`, offset: '0', file_size: String(bytes.length) },
      body: bytes,
      signal: AbortSignal.timeout(180_000),
    });
    const upData: any = await up.json().catch(() => ({}));
    if (!up.ok || upData.success === false) throw new Error(`subida: ${upData.debug_info?.message || upData.error?.message || up.status}`);

    const finish = await fetch(`${GRAPH}/${pageId}/video_reels`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pageToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'finish',
        video_id: s.video_id,
        video_state: 'PUBLISHED',
        description: buildFacebookReelDescription(news),
      }),
    });
    const f: any = await finish.json();
    if (!finish.ok || f.success === false || f.error) throw new Error(f.error?.message || `HTTP ${finish.status}`);
    return { success: true, videoId: s.video_id };
  } catch (err: any) {
    return { success: false, error: `Reel de Facebook: ${err?.message}` };
  }
}

/** Texto para Mastodon (500 caracteres, enlaces clicables): el post corto de Bluesky + el enlace */
export function buildMastodonText(news: ProcessedNews): string {
  const body = (news.blueskyPost || news.subHeadline || news.headline).trim();
  const link = news.articleUrl ? `\n\nAnálisis completo: ${news.articleUrl}` : '';
  const room = 500 - link.length;
  const text = body.length > room ? `${body.slice(0, room - 1).replace(/\s+\S*$/, '')}…` : body;
  return `${text}${link}`;
}

/**
 * Mastodon (gratis, sin aprobación): sube la tarjeta y publica el estado.
 * Necesita MASTODON_INSTANCE (p. ej. https://mastodon.social) y MASTODON_TOKEN (permiso write:statuses y write:media).
 */
export async function publishToMastodon(news: ProcessedNews): Promise<ChannelResult & { url?: string }> {
  const instance = (process.env.MASTODON_INSTANCE || '').trim().replace(/\/+$/, '');
  const token = (process.env.MASTODON_TOKEN || '').trim();
  if (!instance || !token) return { success: false, error: 'Mastodon sin instancia o token' };
  const auth = { Authorization: `Bearer ${token}` };

  try {
    const mediaIds: string[] = [];
    const cardPath = news.cardImageUrl ? path.join(process.cwd(), 'public', news.cardImageUrl.replace(/^\//, '')) : '';
    if (cardPath && fs.existsSync(cardPath)) {
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(cardPath)], { type: 'image/jpeg' }), 'tarjeta.jpg');
      form.append('description', news.headline);
      const up = await fetch(`${instance}/api/v2/media`, { method: 'POST', headers: auth, body: form, signal: AbortSignal.timeout(60_000) });
      const media: any = await up.json().catch(() => ({}));
      if (up.ok && media.id) mediaIds.push(media.id);
    }

    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json', 'Idempotency-Key': `${news.id}-${news.originalUrl}`.slice(0, 64) },
      body: JSON.stringify({ status: buildMastodonText(news), media_ids: mediaIds, language: 'es', visibility: 'public' }),
      signal: AbortSignal.timeout(30_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: `Mastodon: ${data.error || `HTTP ${res.status}`}` };
    return { success: true, url: data.url };
  } catch (err: any) {
    return { success: false, error: `Mastodon: ${err?.message}` };
  }
}
