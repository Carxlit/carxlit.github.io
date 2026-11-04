import path from 'path';
import crypto from 'crypto';
import { ProcessedNews } from '@/types/news';
import { readJsonFile, writeJsonFileAtomic } from '@/lib/storage/json-store';
import { resolveGoogleNewsUrl, isValidEditorialPhoto, decodeHtmlEntities, GENERIC_IMAGE_URL } from './article-image';

/**
 * Imágenes de un Reel: la foto de la noticia y, para que no todo sea la misma imagen fija, otras IMÁGENES RELEVANTES
 * del mismo tema, siempre verificadas:
 *   1. la foto de la noticia;
 *   2. la foto principal de otros medios que cuentan el MISMO hecho (sus enlaces ya vienen de la investigación);
 *   3. (solo formato infografía) fotos con licencia libre de Wikimedia Commons y Openverse de las personas, lugares u
 *      organizaciones que nombra el titular. Una foto solo entra si el nombre aparece en su título o descripción.
 *      Se acredita al autor y la licencia en pantalla y en el texto de la publicación.
 *
 * Contra imágenes que no vienen al caso: se descartan logos, ilustraciones por defecto de los portales y fotos muy pequeñas,
 * y NINGUNA imagen puede repetirse entre noticias distintas (huella de la imagen guardada en storage/image_hashes.json):
 * si la misma imagen ya ilustró otra noticia, es genérica y se descarta.
 */
export interface ReelImage {
  /** Data URL (la imagen viaja dentro de la página del Reel) o, si no se pudo descargar, su dirección original */
  src: string;
  hash: string;
  width: number;
  height: number;
  origin: 'noticia' | 'medio' | 'commons' | 'openverse';
  credit?: string;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const INDEX_PATH = path.join(process.cwd(), 'storage', 'image_hashes.json');
const INDEX_LIMIT = 400;
const MIN_WIDTH = 700;
const MIN_BYTES = 25_000;
const MAX_BYTES = 8_000_000;

export const isGenericImageUrl = (url: string) => GENERIC_IMAGE_URL.test(url) || !isValidEditorialPhoto(url);

function dimensions(buf: Buffer): { width: number; height: number } | null {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const kind = buf.toString('ascii', 12, 16);
      if (kind === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (kind === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
      }
    }
  } catch {
    // formato raro: se decide por el peso
  }
  return null;
}

async function getImage(url: string, origin: ReelImage['origin'], credit?: string): Promise<ReelImage | null> {
  try {
    const clean = decodeHtmlEntities(url);
    if (!/^https?:\/\//.test(clean) || isGenericImageUrl(clean)) return null;
    const res = await fetch(clean, { headers: { 'User-Agent': UA, Accept: 'image/*' }, signal: AbortSignal.timeout(15_000), redirect: 'follow' });
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN_BYTES || buf.length > MAX_BYTES) return null;
    const dim = dimensions(buf);
    if (dim) {
      const ratio = dim.width / dim.height;
      if (dim.width < MIN_WIDTH || ratio > 3 || ratio < 0.45) return null; // pequeñas, banners o tiras
    }
    return {
      src: `data:${type};base64,${buf.toString('base64')}`,
      hash: crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16),
      width: dim?.width || 0,
      height: dim?.height || 0,
      origin,
      credit,
    };
  } catch {
    return null;
  }
}

// ── Otros medios que cuentan el mismo hecho ──────────────────────────────────────────────

async function outletImageUrl(link: string): Promise<string | undefined> {
  try {
    const real = link.includes('news.google.com') ? await resolveGoogleNewsUrl(link) : link;
    if (!real) return undefined;
    const res = await fetch(real, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return undefined;
    const html = (await res.text()).slice(0, 400_000);
    const m =
      html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    return m ? new URL(decodeHtmlEntities(m[1]), real).toString() : undefined;
  } catch {
    return undefined;
  }
}

// ── Personas, lugares y organizaciones del titular ───────────────────────────────────────

const NOT_ENTITY = new Set(
  ['el', 'la', 'los', 'las', 'un', 'una', 'tras', 'según', 'ante', 'por', 'con', 'sin', 'como', 'qué', 'cómo', 'cuándo', 'dónde', 'este', 'esta', 'estos',
    'estas', 'nuevo', 'nueva', 'primer', 'primera', 'gran', 'última', 'último', 'hoy', 'ayer', 'mientras', 'durante', 'entre', 'sobre', 'desde', 'hasta',
    'después', 'antes', 'más', 'menos', 'todo', 'todos', 'dos', 'tres', 'cuatro', 'cinco', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo', 'gobierno',
    'presidente', 'ministro', 'ministra', 'guerra', 'crisis', 'ataque', 'ataques', 'elecciones', 'senado', 'cámara', 'congreso', 'policía', 'ejército',
    'fuerzas', 'nueva', 'caso', 'plan', 'ley', 'banco', 'empresa', 'mercado', 'mercados', 'precio', 'precios', 'deuda', 'acuerdo']
);
const CAP = '[A-ZÁÉÍÓÚÑÜ][\\p{L}\\p{N}\'’-]*';
const ENTITY_RE = new RegExp(`${CAP}(?:\\s+(?:de la|del|de los|de las|de|van|von|bin|al)?\\s*${CAP})*`, 'gu');
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');

/** Nombres propios del titular (los más largos primero): "Sam Altman", "Irán", "Banco Central Europeo" */
export function extractEntities(news: ProcessedNews): string[] {
  const text = [news.article?.title, news.originalTitle, news.subHeadline].filter(Boolean).join('. ');
  const found: string[] = [];
  ENTITY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ENTITY_RE.exec(text))) {
    let e = m[0].replace(/[.'’-]+$/, '').trim();
    const words = e.split(/\s+/);
    while (words.length && NOT_ENTITY.has(norm(words[0]))) words.shift();
    e = words.join(' ');
    if (e.length < 3 || NOT_ENTITY.has(norm(e))) continue;
    if (!found.some((f) => norm(f) === norm(e))) found.push(e);
  }
  return found.sort((a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length).slice(0, 3);
}

/** El título o la descripción de la foto deben nombrar la entidad COMPLETA (nada de coincidencias parciales) */
function mentions(haystack: string, entity: string): boolean {
  return norm(haystack).includes(norm(entity));
}

const ART_WORDS = new RegExp('painting|oil on canvas|drawing|illustration|engraving|lithograph|poster|print\\b|\\bscan\\b|manuscript|caricature|cartoon|sketch|pintura|grabado|cartel|dibujo', 'i');

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

async function commonsImages(entity: string): Promise<{ url: string; credit: string }[]> {
  try {
    const u =
      'https://commons.wikimedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '10', gsrsearch: `${entity} filetype:bitmap`,
        prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '1400', iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription|Categories',
      }).toString();
    const data: any = await (await fetch(u, { headers: { 'User-Agent': 'PuntoCiegoBot/1.0 (news; contact via site)' }, signal: AbortSignal.timeout(12_000) })).json();
    const pages: any[] = Object.values(data?.query?.pages || {});
    pages.sort((a, b) => (a.index || 0) - (b.index || 0));
    const out: { url: string; credit: string }[] = [];
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info || !/^image\/(jpeg|png)$/.test(info.mime || '')) continue;
      const meta = info.extmetadata || {};
      const license = stripHtml(meta.LicenseShortName?.value || '');
      if (!/^(CC BY|CC0|Public domain|PD)/i.test(license)) continue;
      const title = String(p.title || '').replace(/^File:/, '');
      if (/logo|icon|signature|flag of|coat of arms|diagram|chart|map of/i.test(title)) continue;
      if (!mentions(title, entity)) continue; // el nombre debe estar en el título del archivo
      // Solo fotografías: nada de pinturas, grabados, carteles ni documentos escaneados
      if (ART_WORDS.test(`${title} ${stripHtml(meta.ImageDescription?.value || '')}`)) continue;
      const author = stripHtml(meta.Artist?.value || '').slice(0, 60) || 'Wikimedia Commons';
      out.push({ url: info.thumburl || info.url, credit: `${author} · ${license} · Wikimedia Commons` });
      if (out.length >= 2) break;
    }
    return out;
  } catch {
    return [];
  }
}

async function openverseImages(entity: string): Promise<{ url: string; credit: string }[]> {
  try {
    const u =
      'https://api.openverse.org/v1/images/?' +
      new URLSearchParams({ q: entity, page_size: '12', license_type: 'commercial', category: 'photograph', mature: 'false' }).toString();
    const data: any = await (await fetch(u, { headers: { 'User-Agent': 'PuntoCiegoBot/1.0 (news)' }, signal: AbortSignal.timeout(12_000) })).json();
    const out: { url: string; credit: string }[] = [];
    for (const r of data?.results || []) {
      if (!/^(by|by-sa|cc0|pdm)$/i.test(r.license || '')) continue;
      const text = `${r.title || ''} ${(r.tags || []).map((t: any) => t.name).join(' ')}`;
      if (!mentions(text, entity) || (r.width && r.width < MIN_WIDTH)) continue;
      const lic = String(r.license).toUpperCase() === 'CC0' ? 'CC0' : `CC ${String(r.license).toUpperCase()} ${r.license_version || ''}`.trim();
      out.push({ url: r.url, credit: `${String(r.creator || r.source || 'Openverse').slice(0, 60)} · ${lic} · ${r.source || 'Openverse'}` });
      if (out.length >= 2) break;
    }
    return out;
  } catch {
    return [];
  }
}

// ── Huellas: una misma imagen no puede ilustrar dos noticias distintas ───────────────────

const loadIndex = () => readJsonFile<Record<string, string[]>>(INDEX_PATH, {});
function saveIndex(index: Record<string, string[]>) {
  const keys = Object.keys(index);
  const kept: Record<string, string[]> = {};
  for (const k of keys.slice(-INDEX_LIMIT)) kept[k] = index[k];
  writeJsonFileAtomic(INDEX_PATH, kept);
}

export interface CollectOptions {
  /** Permite fotos de licencia libre de Commons/Openverse (formato infografía; nunca en noticias graves) */
  allowStock: boolean;
  max?: number;
}

/**
 * Hasta `max` imágenes distintas y relevantes para el Reel (la de la noticia primero). Vacío si ninguna pasa los filtros.
 */
export async function collectReelImages(news: ProcessedNews, opts: CollectOptions): Promise<ReelImage[]> {
  const max = opts.max ?? 4;
  const id = news.id || news.originalUrl;
  const index = loadIndex();
  const usedByOther = (hash: string) => (index[hash] || []).some((n) => n !== id);

  const accepted: ReelImage[] = [];
  const consider = (img: ReelImage | null, label: string) => {
    if (!img) return;
    if (accepted.some((a) => a.hash === img.hash)) return;
    if (usedByOther(img.hash)) {
      console.log(`[Imágenes] Descartada (ya ilustró otra noticia): ${label}`);
      return;
    }
    accepted.push(img);
  };

  // 1-2. La foto de la noticia y la de otros medios que cuentan el mismo hecho
  const outletLinks = (news.article?.sources || []).map((s) => s.url).filter((u) => u && u !== news.originalUrl).slice(0, 3);
  const [main, ...others] = await Promise.all([
    news.rawImageUrl ? getImage(news.rawImageUrl, 'noticia') : Promise.resolve(null),
    ...outletLinks.map(async (l) => {
      const u = await outletImageUrl(l);
      return u ? getImage(u, 'medio') : null;
    }),
  ]);
  if (!main && news.rawImageUrl && !isGenericImageUrl(news.rawImageUrl)) {
    // Descarga fallida (no filtrada): se deja la dirección original, como antes
    accepted.push({ src: news.rawImageUrl.replace(/&amp;/g, '&'), hash: '', width: 0, height: 0, origin: 'noticia' });
  } else {
    consider(main, 'foto de la noticia');
  }
  others.forEach((o, i) => consider(o, `medio ${i + 1}`));

  // 3. Fotos libres de las personas, lugares y organizaciones del titular
  if (opts.allowStock && accepted.length < max) {
    // Solo personas (2-3 nombres propios seguidos): un concepto como "Internet de las Cosas" devolvería fotos al azar
    const entities = extractEntities(news).filter((e) => /^\S+(\s\S+){1,2}$/.test(e) && e.split(/\s+/).every((w) => /^[A-ZÁÉÍÓÚÑÜ]/.test(w)) && !/^(Le|La|El|The|Los|Las|Il|Der|Die|Das)\s/.test(e));
    const found = (
      await Promise.all(entities.map(async (e) => [...(await commonsImages(e)), ...(await openverseImages(e))].map((x) => ({ ...x, entity: e }))))
    ).flat();
    const fetched = await Promise.all(found.slice(0, 8).map((f) => getImage(f.url, f.credit.includes('Wikimedia') ? 'commons' : 'openverse', f.credit)));
    fetched.forEach((img, i) => accepted.length < max && consider(img, `${found[i].entity} (${found[i].credit})`));
    console.log(`[Imágenes] Entidades: ${entities.join(', ') || '—'} → ${accepted.filter((a) => a.credit).length} fotos libres`);
  }

  const chosen = accepted.slice(0, max);
  chosen.forEach((c) => {
    if (!c.hash) return;
    index[c.hash] = Array.from(new Set([...(index[c.hash] || []), id]));
  });
  saveIndex(index);
  console.log(`[Imágenes] ${chosen.length} para el Reel: ${chosen.map((c) => c.origin).join(', ') || 'ninguna'}`);
  return chosen;
}

export const imageCredits = (images: ReelImage[]) => Array.from(new Set(images.filter((i) => i.credit).map((i) => i.credit!)));
