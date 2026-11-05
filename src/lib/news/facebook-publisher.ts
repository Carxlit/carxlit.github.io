import fs from 'fs';
import path from 'path';
import { ProcessedNews } from '@/types/news';
import { getStoredCredentials } from '@/lib/config/credentials-manager';
import { normalizeCaptionForDedupe } from './extra-publishers';

interface PublishResult {
  success: boolean;
  postId?: string;
  simulated?: boolean;
  error?: string;
}

export interface RecentFacebookPost {
  id: string;
  message?: string;
  created_time?: string;
}

/**
 * Consulta los últimos posts publicados en la página de Facebook
 */
export async function getRecentFacebookPosts(
  pageId: string,
  accessToken: string,
  limit = 15
): Promise<RecentFacebookPost[]> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message,created_time&limit=${limit}&access_token=${accessToken}`,
      { signal: AbortSignal.timeout(15_000) }
    );
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.data)) return [];
    return data.data;
  } catch (err: any) {
    console.warn('[Facebook] Error consultando posts recientes:', err?.message);
    return [];
  }
}

/**
 * Busca si un mensaje ya fue publicado en Facebook en las últimas 48 horas
 */
export function findMatchingFacebookPost(
  targetText: string,
  posts: RecentFacebookPost[],
  maxAgeHours = 48,
  altText?: string
): RecentFacebookPost | null {
  const targetNorm = normalizeCaptionForDedupe(targetText);
  const altNorm = altText ? normalizeCaptionForDedupe(altText) : '';
  if (!targetNorm && !altNorm) return null;

  const now = Date.now();
  const maxAgeMs = maxAgeHours * 3600 * 1000;

  for (const post of posts) {
    if (!post.message || !post.created_time) continue;
    const postTime = new Date(post.created_time).getTime();
    if (isNaN(postTime) || (now - postTime) > maxAgeMs) continue;

    const postNorm = normalizeCaptionForDedupe(post.message);
    if (!postNorm) continue;

    if (postNorm === targetNorm || (altNorm && postNorm === altNorm)) {
      return post;
    }
  }
  return null;
}

/**
 * Publica una noticia con imagen en la Página de Facebook especificada.
 * Si no hay credenciales configuradas, simula la publicación y guarda el borrador.
 */
export async function publishToFacebook(
  news: ProcessedNews,
  pageId?: string,
  accessToken?: string
): Promise<PublishResult> {
  const creds = getStoredCredentials();
  const finalPageId = pageId || creds.facebookPageId || process.env.FACEBOOK_PAGE_ID;
  const finalToken = accessToken || creds.facebookAccessToken || process.env.FACEBOOK_ACCESS_TOKEN;

  // Si no hay credenciales de Facebook configuradas, operar en modo Simulación/Borrador
  if (!finalPageId || !finalToken) {
    console.log('[Facebook Publisher] Modo Simulación activo: credenciales no configuradas.');
    return {
      success: true,
      simulated: true,
      postId: `simulated-${Date.now()}`,
    };
  }

  try {
    // 1. Guarda de duplicados previa
    const recent = await getRecentFacebookPosts(finalPageId, finalToken, 15);
    const existing = findMatchingFacebookPost(news.facebookPost, recent, 48, news.headline);
    if (existing) {
      console.log('[Facebook] Ya publicado, se evita el duplicado');
      return { success: true, postId: existing.id, simulated: false };
    }

    const fullImagePath = news.cardImageUrl 
      ? path.join(process.cwd(), 'public', news.cardImageUrl.replace(/^\//, ''))
      : null;

    if (!fullImagePath || !fs.existsSync(fullImagePath)) {
      throw new Error('La imagen de la noticia no existe en disco para subir a Facebook.');
    }

    const imageBuffer = fs.readFileSync(fullImagePath);
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('caption', news.facebookPost);
    formData.append('access_token', finalToken);
    formData.append('source', blob, 'news.jpg');

    const response = await fetch(`https://graph.facebook.com/v19.0/${finalPageId}/photos`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60_000),
    });

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      // Re-consultar si se publicó pese al error de red
      const recheck = await getRecentFacebookPosts(finalPageId, finalToken, 15);
      const matched = findMatchingFacebookPost(news.facebookPost, recheck, 48, news.headline);
      if (matched) {
        console.log('[Facebook] Ya publicado, se evita el duplicado');
        return { success: true, postId: matched.id, simulated: false };
      }
      throw new Error(data.error?.message || 'Error al comunicarse con Meta Graph API');
    }

    return {
      success: true,
      postId: data.id || data.post_id,
      simulated: false,
    };
  } catch (error: any) {
    console.error('Error al publicar en Facebook:', error);
    return {
      success: false,
      error: error?.message || 'Error desconocido al subir a Facebook',
    };
  }
}
