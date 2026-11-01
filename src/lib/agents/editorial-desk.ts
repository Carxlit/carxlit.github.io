import { z } from 'zod';
import { RawArticle, MultiPlatformCopies, NewsArticle } from '@/types/news';
import { generateObjectWithFallback } from '@/lib/ai/gemini';
import type { ResearchDossier } from './deep-researcher';
import { EditorialBrief, EditorialBriefSchema, DIRECTOR_SYSTEM_PROMPT, finalizeBrief } from './editorial-director';
import { MultiPlatformCopySchema, COPYWRITER_SYSTEM_PROMPT, finalizeCopies } from './multi-platform-copywriter';
import { ArticleSchema, ARTICLE_SYSTEM_PROMPT, finalizeArticle } from './article-writer';

const DeskSchema = z.object({
  brief: EditorialBriefSchema,
  copies: MultiPlatformCopySchema,
  article: ArticleSchema,
});

export interface DeskOutput {
  brief: EditorialBrief;
  copies: MultiPlatformCopies;
  article: NewsArticle;
}

const SLUG_STOPWORDS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'a', 'un', 'una', 'por', 'para', 'con', 'que', 'su', 'sus', 'al', 'lo', 'se']);

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
 * Mesa Editorial: Director (Agente 2) + Redactor Omnicanal (Agente 3) + Redactor de Artículo (3.5)
 * trabajan en UNA sola llamada al modelo. Así cada historia gasta 1 solicitud de la cuota diaria
 * en vez de 3, y los tres textos quedan coherentes entre sí.
 */
export async function runEditorialDesk(article: RawArticle, dossier?: ResearchDossier): Promise<DeskOutput> {
  const researchContext = dossier?.crossSourceSummary || article.contentSnippet;

  const raw = await generateObjectWithFallback({
    label: 'Mesa Editorial',
    schema: DeskSchema,
    temperature: 0.7,
    system: [
      'Eres la mesa editorial completa de "Punto Ciego". Produces en una sola respuesta tres entregables coherentes entre sí: "brief" (Rol 1), "copies" (Rol 2) y "article" (Rol 3). El titular editorial del brief es el que usan los copys.',
      DIRECTOR_SYSTEM_PROMPT,
      COPYWRITER_SYSTEM_PROMPT,
      ARTICLE_SYSTEM_PROMPT,
      'REGLA DE VERACIDAD GLOBAL: usa solo hechos, cifras y nombres presentes en el dossier. El análisis puede ser interpretativo; los hechos no se inventan.',
    ].join('\n\n'),
    prompt: `Noticia a trabajar:
Titular recibido: "${article.title}"
Fuente principal: ${article.sourceName}
Categoría sugerida por el radar: ${article.category}
URL de origen: ${article.link}

DOSSIER DE INVESTIGACIÓN MULTI-FUENTE (${dossier?.sourcesConsultedCount || 1} fuentes: ${dossier?.sourcesList?.join(', ') || article.sourceName}):
${researchContext}`,
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
    article: {
      slug: buildSlug(draft.title || brief.headline),
      ...draft,
      title: draft.title || brief.headline,
      sources,
      wordCount,
    },
  };
}
