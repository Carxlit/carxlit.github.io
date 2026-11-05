import { RawArticle, ProcessedNews, NewsConfig } from '@/types/news';
import { extractArticleImage, searchRealNewsPhoto, decodeHtmlEntities } from '@/lib/news/article-image';
import { outletImageUrl, verifyPhotoRelevance, isGenericImageUrl } from '@/lib/news/news-images';
import { buildMultiSourceDossier } from './deep-researcher';
import { runEditorialDesk, resolveUpdateOriginal } from './editorial-desk';
import { runVisualEngine } from './visual-engine';
import { generateInstagramCardImage } from '@/lib/news/card-generator';
import { generateReelCover } from '@/lib/video/reel-cover';
import { withSourceCredit } from '@/lib/news/post-links';
import { findNewsVideo } from '@/lib/news/news-video';

/** Máximo de verificaciones visuales por noticia para cuidar la cuota gratuita */
const MAX_PHOTO_CHECKS = 3;

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

/**
 * Prueba candidatos en orden estricto:
 *   1. Foto de la fuente (RSS o meta-imagen del artículo original)
 *   2. Foto de otros medios que cubren el mismo hecho (outletImageUrl)
 *   3. Búsqueda periodística (searchRealNewsPhoto)
 * Usa el primero que pase verifyPhotoRelevance (máximo 3 verificaciones por noticia).
 * Si ninguno pasa, devuelve undefined (la tarjeta y el Reel usan el marco con texto).
 */
export async function selectVerifiedNewsPhoto(params: {
  newsId: string;
  updateOf?: string;
  headline: string;
  summary: string;
  sourceImageUrl?: string;
  sourceLink?: string;
  outletLinks: string[];
  searchQueries: string[];
}): Promise<string | undefined> {
  let checks = 0;
  const seenUrls = new Set<string>();

  const tryCandidate = async (rawUrl: string | undefined, originLabel: string): Promise<string | undefined> => {
    if (!rawUrl || checks >= MAX_PHOTO_CHECKS) return undefined;
    const url = decodeHtmlEntities(rawUrl.trim());
    if (!url || seenUrls.has(url)) return undefined;
    seenUrls.add(url);

    if (isGenericImageUrl(url) || !(await isLoadableImage(url))) {
      console.warn(`[Pipeline] Foto descartada por filtro/carga (${originLabel}): ${url.slice(0, 80)}`);
      return undefined;
    }

    checks++;
    const verdict = await verifyPhotoRelevance(url, params.headline, params.summary, params.newsId, params.updateOf);
    console.log(
      `[Pipeline] Verificación foto (${checks}/${MAX_PHOTO_CHECKS}, ${originLabel}): ${verdict.relevant ? 'ACEPTADA' : 'RECHAZADA'} — ${verdict.reason}`
    );
    return verdict.relevant ? url : undefined;
  };

  // 1. Foto de la fuente
  if (params.sourceImageUrl) {
    const accepted = await tryCandidate(params.sourceImageUrl, 'fuente');
    if (accepted) return accepted;
  }
  if (checks < MAX_PHOTO_CHECKS && params.sourceLink) {
    try {
      const extracted = await extractArticleImage(params.sourceLink);
      const accepted = await tryCandidate(extracted, 'fuente-meta');
      if (accepted) return accepted;
    } catch (err: any) {
      console.warn('[Pipeline] Error al extraer foto de la fuente:', err?.message);
    }
  }

  // 2. Foto de otros medios que cubren el hecho (outletImageUrl)
  const uniqueOutletLinks = Array.from(new Set(params.outletLinks.filter((u) => u && u !== params.sourceLink)));
  for (const link of uniqueOutletLinks) {
    if (checks >= MAX_PHOTO_CHECKS) break;
    try {
      const outletPhoto = await outletImageUrl(link);
      const accepted = await tryCandidate(outletPhoto, 'otro-medio');
      if (accepted) return accepted;
    } catch (err: any) {
      console.warn('[Pipeline] Error al obtener foto de otro medio:', err?.message);
    }
  }

  // 3. Búsqueda periodística (searchRealNewsPhoto)
  const uniqueQueries = Array.from(new Set(params.searchQueries.map((q) => q.trim()).filter(Boolean)));
  for (const query of uniqueQueries) {
    if (checks >= MAX_PHOTO_CHECKS) break;
    try {
      const searchedPhoto = await searchRealNewsPhoto(query);
      const accepted = await tryCandidate(searchedPhoto, 'busqueda');
      if (accepted) return accepted;
    } catch (err: any) {
      console.warn('[Pipeline] Búsqueda de foto periodística omitida:', err?.message);
    }
  }

  console.log('[Pipeline] Ninguna foto superó la verificación de relevancia; se deja rawImageUrl vacío (marco con texto).');
  return undefined;
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
  const newsId = article.id || Math.random().toString(36).substring(2, 10);

  // 1.5. Agente de Investigación Profunda: reúne información de múltiples páginas y fuentes
  console.log('[Pipeline] Ejecutando Agente Investigador Multi-Fuente...');
  const researchDossier = await buildMultiSourceDossier(article);

  // 2-3.5. Mesa Editorial: Director + Redactor Omnicanal + Redactor de Artículo en una sola llamada a la IA
  console.log('[Pipeline] Ejecutando Mesa Editorial (Director + Redactor Omnicanal + Artículo)...');
  const { brief: editorialBrief, copies, article: fullArticle, video: videoScript } = await runEditorialDesk(article, researchDossier);

  // 1. Selección y verificación de relevancia de la fotografía principal (máx. 3 verificaciones)
  const outletLinks = [
    ...researchDossier.corroboratingSources.map((s) => s.link),
    ...(fullArticle.sources || []).map((s) => s.url),
  ].filter(Boolean);

  const updateInfo = article.updateOf ? resolveUpdateOriginal(article) : undefined;
  const realPhotoUrl =
    (await selectVerifiedNewsPhoto({
      newsId,
      updateOf: article.updateOf,
      headline: editorialBrief.headline || fullArticle.title || article.title,
      summary: editorialBrief.subHeadline || fullArticle.dek || article.contentSnippet || '',
      sourceImageUrl: article.imageUrl,
      sourceLink: article.link,
      outletLinks,
      searchQueries: [article.title, fullArticle.title || ''],
    })) || updateInfo?.rawImageUrl;

  // Video real del hecho: si el titular original no lo encontró, se prueba con el del artículo (más concreto)
  const sourceVideo =
    article.video ||
    researchDossier.video ||
    (fullArticle.title && fullArticle.title !== article.title ? await findNewsVideo(fullArticle.title).catch(() => undefined) : undefined);

  // Construcción del objeto preliminar de noticia procesada
  const processed: ProcessedNews = {
    id: newsId,
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
    updateOf: article.updateOf,
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
    // Portada del Reel para la cuadrícula del perfil (si falla, Instagram usa un fotograma del video)
    try {
      processed.reelCoverUrl = await generateReelCover(processed);
    } catch (err: any) {
      console.warn('[Pipeline] Portada del Reel omitida:', err?.message);
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
