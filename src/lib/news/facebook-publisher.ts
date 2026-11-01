import fs from 'fs';
import path from 'path';
import { ProcessedNews } from '@/types/news';
import { getStoredCredentials } from '@/lib/config/credentials-manager';

interface PublishResult {
  success: boolean;
  postId?: string;
  simulated?: boolean;
  error?: string;
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
    });

    const data = await response.json();

    if (!response.ok || data.error) {
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

