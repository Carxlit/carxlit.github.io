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
