import fs from 'fs';
import { ProcessedNews, ChannelResult } from '@/types/news';
import { videoCredit } from './extra-publishers';

/**
 * YouTube Shorts (API oficial, gratis): sube el mismo video vertical de los Reels (menos de 60 s = Short).
 *
 * Secretos: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET y YOUTUBE_REFRESH_TOKEN (los genera YOUTUBE.bat).
 * Cuota gratis: 10.000 unidades al día y cada subida cuesta 1.600 → unos 6 Shorts diarios; al agotarse, el canal se omite.
 * Ojo: los proyectos de Google Cloud sin auditar suben los videos como PRIVADOS hasta que YouTube apruebe el
 * formulario de auditoría (gratis, lo envía el dueño una vez). El sistema funciona igual; solo falta ese visto bueno.
 */
export const youtubeConfigured = () =>
  ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'].every((k) => (process.env[k] || '').trim());

async function accessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!.trim(),
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!.trim(),
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN!.trim(),
      grant_type: 'refresh_token',
    }).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const data: any = await res.json();
  if (!data.access_token) throw new Error(`token de YouTube: ${data.error_description || data.error || res.status}`);
  return data.access_token as string;
}

export function buildShortTitle(news: ProcessedNews): string {
  const tag = ' #Shorts';
  const head = (news.headline || '').trim();
  return head.length > 100 - tag.length ? `${head.slice(0, 100 - tag.length - 1).replace(/\s+\S*$/, '')}…${tag}` : `${head}${tag}`;
}

export function buildShortDescription(news: ProcessedNews): string {
  const body = (news.subHeadline || news.blueskyPost || '').trim();
  return [body, news.articleUrl ? `Análisis completo: ${news.articleUrl}` : '', videoCredit(news), '#Shorts #Noticias #PuntoCiego']
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4900);
}

export async function publishYoutubeShort(news: ProcessedNews, videoPath: string): Promise<ChannelResult & { url?: string }> {
  try {
    const token = await accessToken();
    const bytes = fs.readFileSync(videoPath);
    const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(bytes.length),
      },
      body: JSON.stringify({
        snippet: {
          title: buildShortTitle(news),
          description: buildShortDescription(news),
          categoryId: '25', // Noticias y política
          defaultLanguage: 'es',
          defaultAudioLanguage: 'es',
        },
        status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!init.ok) {
      const err: any = await init.json().catch(() => ({}));
      const reason = err.error?.errors?.[0]?.reason || '';
      // Cuota diaria agotada: no es un fallo de la noticia, se omite el canal
      if (reason === 'quotaExceeded' || reason === 'uploadLimitExceeded') return { success: false, skipped: true, error: `YouTube: ${reason}` };
      throw new Error(err.error?.message || `HTTP ${init.status}`);
    }
    const location = init.headers.get('location');
    if (!location) throw new Error('YouTube no devolvió la dirección de subida');

    const up = await fetch(location, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(bytes.length) },
      body: bytes,
      signal: AbortSignal.timeout(240_000),
    });
    const data: any = await up.json().catch(() => ({}));
    if (!up.ok || !data.id) throw new Error(data.error?.message || `subida: HTTP ${up.status}`);
    return { success: true, url: `https://youtube.com/shorts/${data.id}` };
  } catch (err: any) {
    return { success: false, error: `YouTube Shorts: ${err?.message}` };
  }
}
