import path from 'path';
import crypto from 'crypto';
import { embedMany, cosineSimilarity } from 'ai';
import { RawArticle } from '@/types/news';
import { google } from '@/lib/ai/gemini';
import { readJsonFile, writeJsonFileAtomic } from '@/lib/storage/json-store';
import { matchStoryUpdate, MatchUpdateOptions } from './news-scout';

/**
 * Filtro de noticias repetidas por SIGNIFICADO (embeddings de Gemini, cuota gratis aparte de la de texto).
 * El filtro por palabras del Scout no ve que "Ciberataque contra refrigeradores en siete países europeos"
 * y "Nueva ola de ciberataques contra sistemas de refrigeración en supermercados" son el mismo hecho.
 *
 * Vectores de 768 dimensiones, calibrado con titulares reales: mismo hecho ≥ 0,81 (refrigeradores 0,87;
 * Learjet 0,83); hechos parecidos pero distintos por debajo ("El BCE mantiene los tipos" vs "La Fed…": 0,78).
 * Los vectores se guardan en caché: cada ciclo solo calcula los titulares nuevos (la cuota cuenta por texto).
 */
const MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
const DIMENSIONS = 768;
export const SAME_STORY_SIMILARITY = 0.81;
/** Cuántos candidatos (los primeros del Scout) se comprueban por ciclo */
const MAX_CANDIDATES = 10;
const CACHE_PATH = path.join(process.cwd(), 'storage', 'embeddings_cache.json');
const CACHE_LIMIT = 250;

type Cache = Record<string, number[]>;
const keyOf = (text: string) => crypto.createHash('sha1').update(`${MODEL}:${DIMENSIONS}:${text}`).digest('hex').slice(0, 16);

async function embedAll(texts: string[]): Promise<number[][]> {
  const cache = readJsonFile<Cache>(CACHE_PATH, {});
  const missing = Array.from(new Set(texts.filter((t) => !cache[keyOf(t)])));
  if (missing.length) {
    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel(MODEL, { outputDimensionality: DIMENSIONS }),
      values: missing,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(30_000),
    });
    missing.forEach((t, i) => (cache[keyOf(t)] = embeddings[i].map((x) => Math.round(x * 1e4) / 1e4)));
  }
  // Se conservan los usados ahora y los más recientes, para que el archivo no crezca sin límite
  const used = new Set(texts.map(keyOf));
  const keys = Object.keys(cache);
  const kept: Cache = {};
  for (const k of [...keys.filter((k) => used.has(k)), ...keys.filter((k) => !used.has(k)).slice(-CACHE_LIMIT)]) kept[k] = cache[k];
  writeJsonFileAtomic(CACHE_PATH, kept);
  return texts.map((t) => kept[keyOf(t)]);
}

export async function dropSemanticDuplicates(
  candidates: RawArticle[],
  recentTitles: string[],
  opts?: MatchUpdateOptions
): Promise<RawArticle[]> {
  const recent = Array.from(new Set(recentTitles.map((t) => t.trim()).filter(Boolean))).slice(0, 80);
  if (!candidates.length || !recent.length) return candidates;
  const checked = candidates.slice(0, MAX_CANDIDATES);

  const alreadyUpdatedSlugs = new Set<string>(opts?.alreadyUpdatedSlugs || []);
  let extraUpdatesToday = opts?.extraUpdatesToday || 0;

  try {
    const vectors = await embedAll([...checked.map((c) => c.title), ...recent]);
    const recentVecs = vectors.slice(checked.length);
    const duplicates = new Set<RawArticle>();
    checked.forEach((c, i) => {
      let best = 0;
      let match = '';
      recentVecs.forEach((v, j) => {
        const sim = cosineSimilarity(vectors[i], v);
        if (sim > best) [best, match] = [sim, recent[j]];
      });
      if (best >= SAME_STORY_SIMILARITY) {
        const updateInfo = matchStoryUpdate(c.title, {
          ...opts,
          matchedTitle: match,
          alreadyUpdatedSlugs,
          extraUpdatesToday,
        });
        if (updateInfo) {
          c.updateOf = updateInfo.slug;
          c.updateOriginal = updateInfo;
          alreadyUpdatedSlugs.add(updateInfo.slug);
          extraUpdatesToday++;
          console.log(`[Dedupe] Pasa como actualización (${best.toFixed(2)}): "${c.title.slice(0, 70)}" → original ${updateInfo.slug}`);
          return;
        }
        c.updateOf = undefined;
        c.updateOriginal = undefined;
        duplicates.add(c);
        console.log(`[Dedupe] Ya cubierta (${best.toFixed(2)}): "${c.title.slice(0, 70)}" ≈ "${match.slice(0, 70)}"`);
      } else if (c.updateOf) {
        if (alreadyUpdatedSlugs.has(c.updateOf) || extraUpdatesToday >= 2) {
          c.updateOf = undefined;
          c.updateOriginal = undefined;
          duplicates.add(c);
          console.log(`[Dedupe] Segunda actualización descartada para la misma historia o tope diario: "${c.title.slice(0, 70)}"`);
        } else {
          alreadyUpdatedSlugs.add(c.updateOf);
          extraUpdatesToday++;
        }
      }
    });
    return candidates.filter((c) => !duplicates.has(c));
  } catch (err: any) {
    // Sin embeddings se sigue con el filtro por palabras del Scout (mejor publicar que parar)
    console.warn('[Dedupe] Filtro por significado no disponible:', String(err?.message || '').slice(0, 160));
    return candidates;
  }
}
