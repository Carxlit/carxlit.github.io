import path from 'path';
import { z } from 'zod';
import { RawArticle, MultiPlatformCopies, NewsArticle, VideoScript, StoryUpdateInfo, ProcessedNews } from '@/types/news';
import { generateObjectWithFallback } from '@/lib/ai/gemini';
import { readJsonFile } from '@/lib/storage/json-store';
import type { ResearchDossier } from './deep-researcher';
import { EditorialBrief, EditorialBriefSchema, DIRECTOR_SYSTEM_PROMPT, finalizeBrief } from './editorial-director';
import { MultiPlatformCopySchema, COPYWRITER_SYSTEM_PROMPT, finalizeCopies } from './multi-platform-copywriter';
import { ArticleSchema, ARTICLE_SYSTEM_PROMPT, finalizeArticle } from './article-writer';

/** Guion del Reel: cada línea es una diapositiva y se narra en voz alta (sin cifras dudosas ni siglas raras) */
const VideoScriptSchema = z.object({
  hook: z.string().describe('Frase gancho de apertura, máximo 14 palabras, sin mayúsculas sostenidas'),
  beats: z.array(z.string()).describe('3 frases cortas (máximo 22 palabras cada una) con los hechos clave y el punto ciego'),
  close: z.string().describe('Cierre de máximo 14 palabras que invite a leer el análisis completo en el enlace del perfil'),
});

const DeskSchema = z.object({
  brief: EditorialBriefSchema,
  copies: MultiPlatformCopySchema,
  article: ArticleSchema,
  video: VideoScriptSchema,
});

export interface DeskOutput {
  brief: EditorialBrief;
  copies: MultiPlatformCopies;
  article: NewsArticle;
  video?: VideoScript;
}

const VIDEO_SYSTEM_PROMPT = `ROL 4 - GUIONISTA DE REELS ("video"): guion de 25 a 40 segundos para un video vertical narrado.
- "hook": abre con el dato más sorprendente o la pregunta que nadie se hace. Nada de "En esta noticia...".
- "beats": exactamente 3 frases, una idea por frase, lenguaje hablado y claro; la última revela el punto ciego.
- "close": invita a leer el análisis completo en el enlace del perfil.
- CIFRAS: si el dossier trae una cifra clave real (porcentaje, cantidad, monto), inclúyela en UNA de las frases con el número en dígitos y la unidad pegada ("62%", "435 escaños", "2,5 millones de personas"): el video la muestra en grande. Solo cifras que estén en el dossier; nunca inventes ni redondees por tu cuenta.
- Tono humano y cercano, como un creador de contenido que le cuenta la noticia a un amigo: tutea, usa conectores naturales ("ojo", "y aquí viene lo interesante", "lo que nadie dice es que"), nada de lenguaje de comunicado.
- Escribe como se habla: frases cortas, sin paréntesis, sin URLs, sin hashtags, sin emojis, números en cifras simples.
- Ortografía impecable: mayúscula inicial, tildes, signos de apertura (¿¡) y nombres propios con mayúscula. Nunca todo en mayúsculas ni todo en minúsculas.`;

function finalizeVideoScript(raw: any): VideoScript | undefined {
  const clean = (s: unknown) => {
    const t = typeof s === 'string' ? s.replace(/\s+/g, ' ').replace(/https?:\/\/\S+|#\w+/g, '').trim() : '';
    // Frases en MAYÚSCULAS sostenidas pasan a tipo oración; siempre mayúscula inicial
    const cased = t.length > 12 && t === t.toLocaleUpperCase('es') ? t.toLocaleLowerCase('es') : t;
    return cased.replace(new RegExp('^([¿¡"«]?)(\\p{Ll})', 'u'), (_m, p, c) => p + c.toLocaleUpperCase('es'));
  };
  const hook = clean(raw?.hook);
  const beats = (Array.isArray(raw?.beats) ? raw.beats : []).map(clean).filter(Boolean).slice(0, 3);
  const close = clean(raw?.close);
  return hook && beats.length >= 2 ? { hook, beats, close: close || 'Lee el análisis completo en el enlace de nuestro perfil.' } : undefined;
}

const SLUG_STOPWORDS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'a', 'un', 'una', 'por', 'para', 'con', 'que', 'su', 'sus', 'al', 'lo', 'se', 'actualizacion']);

/**
 * Slug corto y legible para la URL del artículo: palabras clave del título + sufijo único
 */
export function buildSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => !SLUG_STOPWORDS.has(w))
    .slice(0, 6)
    .join('-');
  return `${base || 'noticia'}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Busca el titular y resumen de la noticia original cuando article.updateOf está presente
 */
export function resolveUpdateOriginal(article: RawArticle): StoryUpdateInfo | undefined {
  if (article.updateOriginal) return article.updateOriginal;
  if (!article.updateOf) return undefined;
  const slug = article.updateOf;
  const queuePath = path.join(process.cwd(), 'storage', 'publication_queue.json');
  const queue = readJsonFile<any[]>(queuePath, []);
  for (const rawItem of queue) {
    const found: ProcessedNews | undefined = rawItem?.news || rawItem;
    if (found && (found.article?.slug === slug || found.id === slug || rawItem?.id === slug)) {
      return {
        id: found.id || rawItem?.id || slug,
        slug: found.article?.slug || slug,
        title: found.originalTitle || found.article?.title || found.headline,
        headline: found.headline || found.article?.title || found.originalTitle,
        summary: found.subHeadline || found.article?.dek || found.blindSpotAngle || '',
        rawImageUrl: found.rawImageUrl,
      };
    }
  }
  const sitePath = path.join(process.cwd(), 'storage', 'site_articles.json');
  const siteEntries = readJsonFile<Array<{ slug: string; headline?: string; title?: string; dek?: string }>>(sitePath, []);
  const siteFound = siteEntries.find((e) => e.slug === slug);
  if (siteFound) {
    return {
      id: siteFound.slug,
      slug: siteFound.slug,
      title: siteFound.title || siteFound.headline || slug,
      headline: siteFound.headline || siteFound.title || slug,
      summary: siteFound.dek || '',
    };
  }
  return undefined;
}

/**
 * Construye el prompt de usuario para la Mesa Editorial (incluye contexto de actualización si aplica)
 */
export function buildEditorialDeskPrompt(article: RawArticle, dossier?: ResearchDossier): string {
  const researchContext = dossier?.crossSourceSummary || article.contentSnippet;
  const updateOriginal = resolveUpdateOriginal(article);
  const updateBlock = updateOriginal
    ? `\n\nACTUALIZACIÓN DE NOTICIA YA PUBLICADA POR PUNTO CIEGO:
- Slug original: ${updateOriginal.slug}
- Titular de la primera nota: "${updateOriginal.headline}"
- Resumen de la primera nota: "${updateOriginal.summary}"
INSTRUCCIÓN EDITORIAL OBLIGATORIA: ya la publicamos; cuenta SOLO lo nuevo, sin repetir lo anterior. El titular del brief (brief.headline) DEBE empezar por "ACTUALIZACIÓN:".`
    : '';

  return `Noticia a trabajar:
Titular recibido: "${article.title}"
Fuente principal: ${article.sourceName}
Categoría sugerida por el radar: ${article.category}
URL de origen: ${article.link}${updateBlock}

DOSSIER DE INVESTIGACIÓN MULTI-FUENTE (${dossier?.sourcesConsultedCount || 1} fuentes: ${dossier?.sourcesList?.join(', ') || article.sourceName}):
${researchContext}`;
}

/**
 * Mesa Editorial: Director (Agente 2) + Redactor Omnicanal (Agente 3) + Redactor de Artículo (3.5)
 * trabajan en UNA sola llamada al modelo. Así cada historia gasta 1 solicitud de la cuota diaria
 * en vez de 3, y los tres textos quedan coherentes entre sí.
 */
export async function runEditorialDesk(article: RawArticle, dossier?: ResearchDossier): Promise<DeskOutput> {
  const prompt = buildEditorialDeskPrompt(article, dossier);

  const raw = await generateObjectWithFallback({
    label: 'Mesa Editorial',
    schema: DeskSchema,
    temperature: 0.7,
    system: [
      'Eres la mesa editorial completa de "Punto Ciego". Produces en una sola respuesta cuatro entregables coherentes entre sí: "brief" (Rol 1), "copies" (Rol 2), "article" (Rol 3) y "video" (Rol 4). El titular editorial del brief es el que usan los copys.',
      DIRECTOR_SYSTEM_PROMPT,
      COPYWRITER_SYSTEM_PROMPT,
      ARTICLE_SYSTEM_PROMPT,
      VIDEO_SYSTEM_PROMPT,
      'IDIOMA: escribe TODO en español neutro (titular, copys, artículo y guion), aunque las fuentes estén en inglés u otro idioma; traduce los nombres de cargos y mantén los nombres propios. REGLA DE VERACIDAD GLOBAL: usa solo hechos, cifras y nombres presentes en el dossier. El análisis puede ser interpretativo; los hechos no se inventan.',
    ].join('\n\n'),
    prompt,
  });

  const brief = finalizeBrief(raw.brief, article);
  const copies = finalizeCopies(raw.copies);
  const draft = finalizeArticle(raw.article);

  // Las fuentes del artículo salen del dossier (enlaces reales), nunca del modelo
  const sources = [
    { name: article.sourceName, title: article.title, url: article.link },
    ...(dossier?.corroboratingSources || []).map((s) => ({ name: s.sourceName, title: s.title, url: s.link })),
  ].filter((s, i, arr) => s.url && arr.findIndex((o) => o.url === s.url) === i);

  const wordCount = [draft.dek, ...draft.sections.flatMap((s) => s.paragraphs)].join(' ').split(/\s+/).length;

  return {
    brief,
    copies,
    video: finalizeVideoScript(raw.video),
    article: {
      slug: buildSlug(draft.title || brief.headline),
      ...draft,
      title: draft.title || brief.headline,
      sources,
      wordCount,
    },
  };
}
