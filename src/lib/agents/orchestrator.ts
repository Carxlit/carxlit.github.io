import { RawArticle, ProcessedNews, NewsConfig } from '@/types/news';
import { extractArticleImage, searchRealNewsPhoto } from '@/lib/news/article-image';
import { buildMultiSourceDossier } from './deep-researcher';
import { runEditorialDesk } from './editorial-desk';
import { runVisualEngine } from './visual-engine';
import { generateInstagramCardImage } from '@/lib/news/card-generator';
import { withSourceCredit } from '@/lib/news/post-links';
import { decodeHtmlEntities } from '@/lib/news/article-image';
import { findNewsVideo } from '@/lib/news/news-video';

/** ¿La URL devuelve de verdad una imagen? (no un video, una página o un error) */
async function isLoadableImage(url: string): Promise<boolean> {
  if (!/^https?:\/\//.test(url) || /\.(mp4|m3u8|mov|webm|mpd)(\?|$)/i.test(url)) return false;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', Range: 'bytes=0-2047' },
      signal: AbortSignal.timeout(10_000),
    });
    res.body?.cancel().catch(() => undefined);
    return (res.ok || res.status === 206) && (res.headers.get('content-type') || '').startsWith('image/');
  } catch {
    return false;
  }
}

export interface PipelineOptions {
  skipImageGeneration?: boolean;
}

/**
 * Orquestador Central del Pipeline Multi-Agente "Punto Ciego"
 * Coordina la ejecución secuencial y paralela de los 5 agentes especializados.
 */
export async function runEditorialPipeline(
  article: RawArticle,
  config?: Partial<NewsConfig>,
  options: PipelineOptions = {}
): Promise<ProcessedNews> {
  console.log(`[Pipeline] Iniciando procesamiento multi-agente para: "${article.title.slice(0, 60)}..."`);

  // 1. Fase de Extracción de Fotografía de Prensa Real
  // Cada candidata se comprueba: algunos feeds traen un video (.mp4) o una URL caída como "imagen"
  // y la tarjeta salía con el hueco de la foto vacío
  let realPhotoUrl = article.imageUrl ? decodeHtmlEntities(article.imageUrl) : undefined;
  if (realPhotoUrl && !(await isLoadableImage(realPhotoUrl))) {
    console.warn(`[Pipeline] La imagen del feed no es una foto válida (${realPhotoUrl.slice(0, 80)}); se busca otra`);
    realPhotoUrl = undefined;
  }
  if (!realPhotoUrl && article.link) {
    try {
      const found = await extractArticleImage(article.link, article.title);
      if (found && (await isLoadableImage(found))) realPhotoUrl = found;
    } catch (err: any) {
      console.warn('[Pipeline] Error al extraer foto de URL, recurriendo a búsqueda:', err?.message);
    }
  }

  if (!realPhotoUrl) {
    try {
      const found = await searchRealNewsPhoto(article.title);
      if (found && (await isLoadableImage(found))) realPhotoUrl = found;
    } catch (err: any) {
      console.warn('[Pipeline] Búsqueda de foto periodística omitida:', err?.message);
    }
  }

  // 1.5. Agente de Investigación Profunda: reúne información de múltiples páginas y fuentes
  console.log('[Pipeline] Ejecutando Agente Investigador Multi-Fuente...');
  const researchDossier = await buildMultiSourceDossier(article);

  // 2-3.5. Mesa Editorial: Director + Redactor Omnicanal + Redactor de Artículo en una sola llamada a la IA
  console.log('[Pipeline] Ejecutando Mesa Editorial (Director + Redactor Omnicanal + Artículo)...');
  const { brief: editorialBrief, copies, article: fullArticle, video: videoScript } = await runEditorialDesk(article, researchDossier);

  // Video real del hecho: si el titular original no lo encontró, se prueba con el del artículo (más concreto)
  const sourceVideo =
    article.video ||
    researchDossier.video ||
    (fullArticle.title && fullArticle.title !== article.title ? await findNewsVideo(fullArticle.title).catch(() => undefined) : undefined);

  // Construcción del objeto preliminar de noticia procesada
  const processed: ProcessedNews = {
    id: article.id || Math.random().toString(36).substring(2, 10),
    originalUrl: article.link || '',
    originalTitle: article.title,
    sourceName: article.sourceName || 'Punto Ciego Intel',
    category: editorialBrief.category,
    urgencyScore: editorialBrief.urgencyScore,
    headline: editorialBrief.headline,
    subHeadline: editorialBrief.subHeadline,
    blindSpotAngle: editorialBrief.blindSpotAngle,
    facebookPost: withSourceCredit(copies.facebook, article.sourceName),
    telegramPost: copies.telegram, // Telegram añade la fuente con enlace al publicar
    linkedInPost: withSourceCredit(copies.linkedIn, article.sourceName),
    blueskyPost: copies.bluesky,
    copies,
    article: fullArticle,
    videoScript,
    rawImageUrl: realPhotoUrl,
    sourceVideo,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // 4. Agente 4: Director de Arte / Card Studio (Generación split-screen con Playwright)
  if (!options.skipImageGeneration) {
    console.log('[Pipeline] Ejecutando Agente 4: Director de Arte / Card Studio...');
    try {
      const cardPath = await runVisualEngine(processed, undefined, config);
      processed.cardImageUrl = cardPath;
    } catch (err: any) {
      console.error('[Pipeline] Error en generación de tarjeta visual:', err?.message);
    }
    // Versión vertical 4:5 para Instagram (si falla, Instagram usa la horizontal)
    try {
      processed.instagramCardUrl = await generateInstagramCardImage(processed);
    } catch (err: any) {
      console.warn('[Pipeline] Tarjeta vertical de Instagram omitida:', err?.message);
    }
  }

  console.log(`[Pipeline] Pipeline completado con éxito para "${processed.headline}"`);
  return processed;
}
