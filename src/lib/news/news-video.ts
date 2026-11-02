import { NewsVideo } from '@/types/news';
import { extractEventTokens } from '@/lib/agents/news-scout';

/**
 * Video real de la noticia (p. ej. las imágenes del accidente) para incrustarlo en el artículo.
 * Solo YouTube: se incrusta con su reproductor oficial (legal y gratis, sin volver a subir el video).
 *  1) videos que el propio medio incrustó en su artículo,
 *  2) si no hay, búsqueda en YouTube de esta semana con el titular.
 * Cada candidato se valida con el título real del video (oEmbed) para no colar uno que no tenga que ver.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const YT_ID = '([A-Za-z0-9_-]{11})';

/** IDs de YouTube incrustados en el HTML del artículo (iframes, og:video, enlaces watch/shorts) */
export function findYoutubeIdsInHtml(html: string): string[] {
  const patterns = [
    new RegExp(`youtube(?:-nocookie)?\\.com/embed/${YT_ID}`, 'g'),
    new RegExp(`youtube\\.com/(?:watch\\?(?:[^"'\\s>]*&(?:amp;)?)?v=|shorts/|live/)${YT_ID}`, 'g'),
    new RegExp(`youtu\\.be/${YT_ID}`, 'g'),
  ];
  const ids: string[] = [];
  for (const re of patterns) {
    for (const m of Array.from(html.matchAll(re))) {
      if (!ids.includes(m[1]) && m[1] !== 'videoseries') ids.push(m[1]);
    }
  }
  return ids.slice(0, 5);
}

/** Título y canal reales del video; undefined si no existe o no se puede incrustar */
async function oembed(id: string): Promise<{ title: string; channel?: string } | undefined> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const data: any = await res.json();
    return data?.title ? { title: String(data.title), channel: data.author_name ? String(data.author_name) : undefined } : undefined;
  } catch {
    return undefined;
  }
}

const UPPER_START = new RegExp('^\\p{Lu}', 'u');
const NON_WORD = new RegExp('[^\\p{L}\\p{N}\\s]', 'gu');
const NON_LETTER = new RegExp('[^\\p{L}]', 'gu');
const HAS_LETTER = new RegExp('\\p{L}', 'u');

/** Nombres propios y siglas del titular (BCE, Learjet, Palm Beach...): lo que distingue un hecho de otro parecido */
function properTokens(title: string): Set<string> | undefined {
  const words = title.replace(NON_WORD, ' ').split(/\s+/).filter(Boolean);
  const letters = title.replace(NON_LETTER, '');
  if (letters && letters === letters.toUpperCase()) return undefined; // titular en MAYÚSCULAS: no se distinguen
  const proper = words.filter((w, i) => (i > 0 && UPPER_START.test(w)) || (w.length >= 2 && w === w.toUpperCase() && HAS_LETTER.test(w)));
  return new Set(proper.flatMap((w) => extractEventTokens(w)));
}

const STOP = new Set('para como tras sobre entre desde hasta contra durante según ante este esta estos estas que del los las una unos unas por con sin sus más pero hay fue son ser han'.split(' '));

/** Búsqueda corta y concreta: nombres propios, cifras y las primeras palabras con peso ("avión ejecutivo West Palm Beach") */
function searchQueryFor(title: string): string {
  const words = title.replace(NON_WORD, ' ').split(/\s+/).filter(Boolean);
  const proper = properTokens(title) ? words.filter((w, i) => (i > 0 && UPPER_START.test(w)) || (w.length >= 2 && w === w.toUpperCase() && HAS_LETTER.test(w))) : [];
  const numbers = words.filter((w) => /^\d+$/.test(w));
  const content = words.filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()) && !proper.includes(w)).slice(0, 3);
  return Array.from(new Set([...content, ...proper.slice(0, 4), ...numbers.slice(0, 1)])).join(' ');
}

/**
 * ¿El video cuenta ESTE hecho? Al menos 3 términos en común que cubran el 40 % del texto más corto,
 * y uno de ellos tiene que ser un nombre propio o una sigla del titular (si no, "El BCE mantiene los tipos"
 * se confundiría con "La Fed mantiene los tipos"). Con titulares en mayúsculas se piden 4 términos.
 */
function sameStory(newsTitle: string, videoTitle: string): boolean {
  const a = extractEventTokens(newsTitle);
  const b = new Set(extractEventTokens(videoTitle));
  const shared = a.filter((t) => b.has(t));
  if (shared.length < 3 || shared.length / Math.max(1, Math.min(a.length, b.size)) < 0.4) return false;
  const proper = properTokens(newsTitle);
  return proper ? shared.some((t) => proper.has(t)) : shared.length >= 4;
}

/** Canales de "en vivo 24 horas" o recopilatorios: nunca son el video de un hecho concreto */
const GENERIC_VIDEO = /\b(en vivo|en directo|live|24\/7|24 horas|señal|resumen semanal|podcast|completo|full episode)\b/i;

/** Busca en YouTube (resultados de esta semana) sin API ni clave, leyendo los datos de la página */
export async function searchYoutube(query: string): Promise<{ id: string; title: string; channel?: string; seconds?: number }[]> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIIAw%253D%253D&hl=es&gl=CO`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'es-419,es;q=0.9', Cookie: 'CONSENT=YES+1; SOCS=CAI' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const json = html.match(/var ytInitialData\s*=\s*(\{[\s\S]+?\});<\/script>/)?.[1];
    if (!json) return [];
    const out: { id: string; title: string; channel?: string; seconds?: number }[] = [];
    const walk = (node: any) => {
      if (!node || typeof node !== 'object' || out.length >= 8) return;
      const v = node.videoRenderer;
      if (v?.videoId) {
        const length = v.lengthText?.simpleText as string | undefined;
        const seconds = length ? length.split(':').reduce((s: number, p: string) => s * 60 + Number(p), 0) : undefined;
        out.push({
          id: v.videoId,
          title: v.title?.runs?.map((r: any) => r.text).join('') || '',
          channel: v.ownerText?.runs?.[0]?.text,
          seconds,
        });
        return;
      }
      for (const k of Object.keys(node)) walk(node[k]);
    };
    walk(JSON.parse(json));
    return out;
  } catch {
    return [];
  }
}

/**
 * Video de la noticia o undefined.
 * `titles`: titular original y, si hay, el del artículo (cuentan el hecho con palabras distintas).
 * `pagesHtml`: HTML del artículo original (y de otros medios si se tiene).
 */
export async function findNewsVideo(titles: string | string[], pagesHtml: string[] = []): Promise<NewsVideo | undefined> {
  const variants = (Array.isArray(titles) ? titles : [titles]).map((t) => t?.trim()).filter(Boolean) as string[];
  if (!variants.length) return undefined;
  const matches = (videoTitle: string) => !GENERIC_VIDEO.test(videoTitle) && variants.some((t) => sameStory(t, videoTitle));

  // 1) Incrustados por el medio (a menudo hay videos ajenos en la barra lateral: se validan igual)
  for (const id of pagesHtml.flatMap(findYoutubeIdsInHtml).slice(0, 6)) {
    const info = await oembed(id);
    if (info && matches(info.title)) return { provider: 'youtube', id, title: info.title, channel: info.channel };
  }

  // 2) Búsqueda de esta semana con cada titular: videos cortos (no programas enteros) que cuenten lo mismo
  if (process.env.NEWS_VIDEO_SEARCH === 'false') return undefined;
  const queries = Array.from(new Set(variants.flatMap((t) => [searchQueryFor(t), t]).filter(Boolean)));
  for (const query of queries) {
    for (const r of await searchYoutube(query)) {
      if (!r.seconds || r.seconds > 15 * 60 || !matches(r.title)) continue;
      const info = await oembed(r.id); // confirma que se puede incrustar
      if (info) return { provider: 'youtube', id: r.id, title: info.title, channel: info.channel || r.channel };
    }
  }
  return undefined;
}
