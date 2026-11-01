import { z } from 'zod';

/**
 * Agente 3.5: Redactor de Artículo Completo
 * Escribe la pieza larga que se publica en el sitio de Punto Ciego y a la que enlazan todos los posts.
 */
export const ArticleSchema = z.object({
  title: z.string().describe('Título del artículo en tipo oración (no todo en mayúsculas), 8 a 14 palabras.'),
  dek: z.string().describe('Entradilla de 2 oraciones que resume el hecho y el ángulo de Punto Ciego.'),
  keyFacts: z.array(z.string()).describe('3 a 5 datos duros verificables tomados del dossier (cifras, fechas, nombres). Sin inventar.'),
  sections: z
    .array(
      z.object({
        heading: z.string().describe('Subtítulo de la sección'),
        paragraphs: z.array(z.string()).describe('1 a 3 párrafos de prosa periodística'),
      })
    )
    .describe(
      'Entre 4 y 5 secciones en este orden: "Qué pasó", "El contexto", "El punto ciego", "Quién gana y quién pierde", "Qué vigilar". Puedes reformular los subtítulos.'
    ),
  tags: z.array(z.string()).describe('3 a 6 etiquetas temáticas cortas, sin #'),
});

export type ArticleDraft = z.infer<typeof ArticleSchema>;

export const ARTICLE_SYSTEM_PROMPT = `ROL 3 - REDACTOR DE ARTÍCULO COMPLETO para el sitio web de "Punto Ciego".
- Entre 550 y 900 palabras en total. Prosa de corresponsal: concreta, con nombres, cifras y fechas del dossier.
- Separa con claridad los HECHOS (atribuidos a las fuentes: "según BBC Mundo...") del ANÁLISIS de Punto Ciego.
- Nunca inventes citas textuales, cifras ni declaraciones. Si un dato no está en el dossier, no existe.
- Sin clichés de IA, sin exclamaciones, sin emojis.`;

/**
 * Limpia el borrador: quita secciones vacías y recorta listas a tamaños razonables
 */
export function finalizeArticle(raw: ArticleDraft): ArticleDraft {
  const sections = (raw.sections || [])
    .map((s) => ({ heading: s.heading.trim(), paragraphs: (s.paragraphs || []).map((p) => p.trim()).filter(Boolean) }))
    .filter((s) => s.heading && s.paragraphs.length > 0)
    .slice(0, 6);
  return {
    title: raw.title.trim(),
    dek: raw.dek.trim(),
    keyFacts: (raw.keyFacts || []).map((f) => f.trim()).filter(Boolean).slice(0, 6),
    sections,
    tags: (raw.tags || []).map((t) => t.replace(/^#/, '').trim()).filter(Boolean).slice(0, 6),
  };
}
