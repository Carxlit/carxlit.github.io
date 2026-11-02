import { embedMany, cosineSimilarity } from 'ai';
import { RawArticle } from '@/types/news';
import { google } from '@/lib/ai/gemini';

/**
 * Filtro de noticias repetidas por SIGNIFICADO (embeddings de Gemini, cuota gratis aparte de la de texto).
 * El filtro por palabras del Scout no ve que "Ciberataque contra refrigeradores en siete países europeos"
 * y "Nueva ola de ciberataques contra sistemas de refrigeración en supermercados" son el mismo hecho.
 *
 * Calibrado con titulares reales: mismo hecho ≥ 0,82 (refrigeradores 0,87; Learjet 0,84);
 * hechos parecidos pero distintos por debajo ("El BCE mantiene los tipos" vs "La Fed mantiene los tipos": 0,80).
 */
const MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
export const SAME_STORY_SIMILARITY = 0.82;
/** Cuántos candidatos (los primeros del Scout) se comprueban por ciclo */
const MAX_CANDIDATES = 12;

export async function dropSemanticDuplicates(candidates: RawArticle[], recentTitles: string[]): Promise<RawArticle[]> {
  const recent = Array.from(new Set(recentTitles.map((t) => t.trim()).filter(Boolean))).slice(0, 80);
  if (!candidates.length || !recent.length) return candidates;
  const checked = candidates.slice(0, MAX_CANDIDATES);
  try {
    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel(MODEL),
      values: [...checked.map((c) => c.title), ...recent],
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(30_000),
    });
    const recentVecs = embeddings.slice(checked.length);
    const duplicates = new Set<RawArticle>();
    checked.forEach((c, i) => {
      let best = 0;
      let match = '';
      recentVecs.forEach((v, j) => {
        const sim = cosineSimilarity(embeddings[i], v);
        if (sim > best) [best, match] = [sim, recent[j]];
      });
      if (best >= SAME_STORY_SIMILARITY) {
        duplicates.add(c);
        console.log(`[Dedupe] Ya cubierta (${best.toFixed(2)}): "${c.title.slice(0, 70)}" ≈ "${match.slice(0, 70)}"`);
      }
    });
    return candidates.filter((c) => !duplicates.has(c));
  } catch (err: any) {
    // Sin embeddings se sigue con el filtro por palabras del Scout (mejor publicar que parar)
    console.warn('[Dedupe] Filtro por significado no disponible:', String(err?.message || '').slice(0, 160));
    return candidates;
  }
}
