import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import { RawArticle, EditorialCategory, StoryUpdateInfo } from '@/types/news';
import { readJsonFile, writeJsonFileAtomic, localDateKey } from '@/lib/storage/json-store';

const QUEUE_PATH = path.join(process.cwd(), 'storage', 'publication_queue.json');

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['image', 'image'],
    ],
  },
});

export interface ExpandedFeedConfig {
  url: string;
  sourceName: string;
  category: EditorialCategory;
  weight: number; // Prioridad periodística (1-10)
}

/** Búsqueda de Google Noticias como feed (por defecto en español latino) */
function gnews(query: string, hl = 'en-US', ceid = 'US:en'): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${ceid.split(':')[0]}&ceid=${ceid}`;
}

/**
 * Red ampliada de corresponsalías y agencias internacionales de alto rigor
 */
export const SCOUT_FEEDS: ExpandedFeedConfig[] = [
  // --- TECNOLOGÍA & IA ---
  {
    url: 'https://news.google.com/rss/headlines/section/topic/SCITECH?hl=es-419&gl=US&ceid=US:es-419',
    sourceName: 'Google Tech & IA',
    category: 'TECNOLOGÍA & IA',
    weight: 10,
  },
  {
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia/portada',
    sourceName: 'El País Tecnología',
    category: 'TECNOLOGÍA & IA',
    weight: 9,
  },
  {
    url: 'https://es.wired.com/feed/rss',
    sourceName: 'Wired en Español',
    category: 'TECNOLOGÍA & IA',
    weight: 9,
  },
  {
    url: 'https://www.xataka.com/feedburner.xml',
    sourceName: 'Xataka',
    category: 'TECNOLOGÍA & IA',
    weight: 8,
  },
  {
    url: 'https://www.genbeta.com/feedburner.xml',
    sourceName: 'Genbeta',
    category: 'TECNOLOGÍA & IA',
    weight: 8,
  },
  {
    url: 'https://hipertextual.com/feed',
    sourceName: 'Hipertextual',
    category: 'TECNOLOGÍA & IA',
    weight: 8,
  },
  {
    url: 'https://news.google.com/rss/search?q=Inteligencia+Artificial+OR+OpenAI+OR+Nvidia+when:2d&hl=es-419&gl=US&ceid=US:es-419',
    sourceName: 'Radar IA & Chips',
    category: 'TECNOLOGÍA & IA',
    weight: 9,
  },

  // --- GEOPOLÍTICA & INTERNACIONAL ---
  {
    url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=es-419&gl=US&ceid=US:es-419',
    sourceName: 'Reuters / Agencias',
    category: 'GEOPOLÍTICA',
    weight: 9,
  },
  {
    url: 'https://feeds.bbci.co.uk/mundo/rss.xml',
    sourceName: 'BBC Mundo',
    category: 'GEOPOLÍTICA',
    weight: 9,
  },
  {
    url: 'https://rss.dw.com/rdf/rss-sp-all',
    sourceName: 'Deutsche Welle (DW)',
    category: 'GEOPOLÍTICA',
    weight: 8,
  },
  {
    url: 'https://www.france24.com/es/rss',
    sourceName: 'France 24 Español',
    category: 'GEOPOLÍTICA',
    weight: 8,
  },
  {
    url: 'https://es.euronews.com/rss?format=mrss&level=theme&name=news',
    sourceName: 'Euronews en Español',
    category: 'GEOPOLÍTICA',
    weight: 8,
  },
  {
    // Swissinfo retiró su RSS en español (HTTP 410)
    url: 'https://news.google.com/rss/search?q=ONU+OR+diplomacia+OR+sanciones+OR+cumbre+when:2d&hl=es-419&gl=US&ceid=US:es-419',
    sourceName: 'Google News Diplomacia',
    category: 'GEOPOLÍTICA',
    weight: 8,
  },

  // --- ECONOMÍA GLOBAL & MERCADOS ---
  {
    url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=es-419&gl=US&ceid=US:es-419',
    sourceName: 'Bloomberg / Mercados',
    category: 'ECONOMÍA GLOBAL',
    weight: 9,
  },
  {
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada',
    sourceName: 'El País Economía',
    category: 'ECONOMÍA GLOBAL',
    weight: 8,
  },
  {
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada',
    sourceName: 'Cinco Días Mercados',
    category: 'ECONOMÍA GLOBAL',
    weight: 8,
  },
  {
    url: 'https://www.expansion.com/rss/economia.xml',
    sourceName: 'Expansión Economía',
    category: 'ECONOMÍA GLOBAL',
    weight: 8,
  },
  {
    url: 'https://news.google.com/rss/search?q=banco+central+OR+aranceles+OR+inflacion+when:2d&hl=es-419&gl=US&ceid=US:es-419',
    sourceName: 'Radar Macroeconómico',
    category: 'ECONOMÍA GLOBAL',
    weight: 9,
  },

  // --- SEGURIDAD & DEFENSA ---
  {
    url: 'https://news.google.com/rss/headlines/section/topic/NATION?hl=es-419&gl=US&ceid=US:es-419',
    sourceName: 'Associated Press (AP)',
    category: 'SEGURIDAD & DEFENSA',
    weight: 8,
  },
  {
    url: 'https://www.infobae.com/arc/outboundfeeds/rss/?outputType=xml',
    sourceName: 'Infobae América',
    category: 'SEGURIDAD & DEFENSA',
    weight: 8,
  },
  {
    url: 'https://news.google.com/rss/search?q=OTAN+OR+Kremlin+OR+Pentagono+OR+armamento+when:2d&hl=es-419&gl=US&ceid=US:es-419',
    sourceName: 'Radar Alianzas & Defensa',
    category: 'SEGURIDAD & DEFENSA',
    weight: 8,
  },

  // --- PODER & SOCIEDAD ---
  {
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada',
    sourceName: 'El País Internacional',
    category: 'PODER & SOCIEDAD',
    weight: 8,
  },
  {
    url: 'https://theconversation.com/es/articles.atom',
    sourceName: 'The Conversation',
    category: 'PODER & SOCIEDAD',
    weight: 8,
  },

  // --- Red ampliada (2026-11): agencias, prensa latinoamericana y especializada ---
  { url: 'https://www.europapress.es/rss/rss.aspx?ch=00069', sourceName: 'Europa Press', category: 'GEOPOLÍTICA', weight: 8 },
  { url: 'https://www.rfi.fr/es/rss', sourceName: 'RFI Español', category: 'GEOPOLÍTICA', weight: 8 },
  { url: 'https://e00-elmundo.uecdn.es/elmundo/rss/internacional.xml', sourceName: 'El Mundo', category: 'GEOPOLÍTICA', weight: 7 },
  { url: 'https://www.abc.es/rss/2.0/internacional/', sourceName: 'ABC Internacional', category: 'GEOPOLÍTICA', weight: 7 },
  { url: 'https://www.lavanguardia.com/rss/internacional.xml', sourceName: 'La Vanguardia', category: 'GEOPOLÍTICA', weight: 7 },
  { url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada', sourceName: 'El País América', category: 'PODER & SOCIEDAD', weight: 9 },
  { url: 'https://www.eltiempo.com/rss/mundo.xml', sourceName: 'El Tiempo', category: 'PODER & SOCIEDAD', weight: 8 },
  { url: 'https://www.semana.com/arc/outboundfeeds/rss/?outputType=xml', sourceName: 'Semana', category: 'PODER & SOCIEDAD', weight: 7 },
  { url: 'https://www.clarin.com/rss/mundo/', sourceName: 'Clarín', category: 'PODER & SOCIEDAD', weight: 7 },
  { url: 'https://www.bloomberglinea.com/arc/outboundfeeds/rss/?outputType=xml', sourceName: 'Bloomberg Línea', category: 'ECONOMÍA GLOBAL', weight: 9 },
  { url: 'https://www.portafolio.co/rss/economia', sourceName: 'Portafolio', category: 'ECONOMÍA GLOBAL', weight: 7 },
  { url: 'https://www.xataka.com.mx/feedburner.xml', sourceName: 'Xataka México', category: 'TECNOLOGÍA & IA', weight: 7 },
  { url: 'https://www.defensa.com/rss', sourceName: 'Defensa.com', category: 'SEGURIDAD & DEFENSA', weight: 8 },
  {
    url: 'https://news.google.com/rss/search?q=ciberataque+OR+hackeo+OR+ransomware+OR+filtraci%C3%B3n+when:2d&hl=es-419&gl=US&ceid=US:es-419',
    sourceName: 'Google News Ciberseguridad',
    category: 'SEGURIDAD & DEFENSA',
    weight: 8,
  },
  // --- Cobertura mundial (2026-11): agencias y prensa internacional en inglés (la mesa editorial escribe siempre en español) ---
  { url: gnews('site:reuters.com world when:1d'), sourceName: 'Reuters', category: 'GEOPOLÍTICA', weight: 10 },
  { url: gnews('site:apnews.com when:1d'), sourceName: 'Associated Press', category: 'GEOPOLÍTICA', weight: 10 },
  { url: gnews('site:reuters.com business OR markets OR economy when:1d'), sourceName: 'Reuters Business', category: 'ECONOMÍA GLOBAL', weight: 10 },
  { url: gnews('site:reuters.com technology OR AI OR chips when:1d'), sourceName: 'Reuters Technology', category: 'TECNOLOGÍA & IA', weight: 10 },
  { url: gnews('site:reuters.com defense OR military OR war when:1d'), sourceName: 'Reuters Defense', category: 'SEGURIDAD & DEFENSA', weight: 10 },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', sourceName: 'BBC News', category: 'GEOPOLÍTICA', weight: 10 },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', sourceName: 'Al Jazeera', category: 'GEOPOLÍTICA', weight: 9 },
  { url: 'https://www.theguardian.com/world/rss', sourceName: 'The Guardian', category: 'GEOPOLÍTICA', weight: 9 },
  { url: 'https://feeds.npr.org/1004/rss.xml', sourceName: 'NPR', category: 'GEOPOLÍTICA', weight: 8 },
  { url: 'https://rss.dw.com/rdf/rss-en-all', sourceName: 'DW News', category: 'GEOPOLÍTICA', weight: 8 },
  { url: 'https://www.france24.com/en/rss', sourceName: 'France 24', category: 'GEOPOLÍTICA', weight: 8 },
  { url: 'https://www.euronews.com/rss?format=mrss&level=theme&name=news', sourceName: 'Euronews', category: 'GEOPOLÍTICA', weight: 8 },
  { url: 'https://www.channelnewsasia.com/rssfeeds/8395986', sourceName: 'CNA (Asia)', category: 'GEOPOLÍTICA', weight: 8 },
  { url: 'https://www.scmp.com/rss/91/feed', sourceName: 'South China Morning Post', category: 'GEOPOLÍTICA', weight: 8 },
  { url: 'https://www.thehindu.com/news/international/feeder/default.rss', sourceName: 'The Hindu', category: 'GEOPOLÍTICA', weight: 7 },
  { url: 'https://www.africanews.com/feed/rss', sourceName: 'Africanews', category: 'PODER & SOCIEDAD', weight: 7 },
  { url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', sourceName: 'Noticias de la ONU', category: 'PODER & SOCIEDAD', weight: 9 },
  { url: 'https://www.infobae.com/arc/outboundfeeds/rss/category/america/?outputType=xml', sourceName: 'Infobae Mundo', category: 'PODER & SOCIEDAD', weight: 7 },

  // Radares por región y por tipo de hecho (búsquedas de Google Noticias, últimas 24-48 h)
  { url: gnews('China OR Japón OR India OR Corea OR Taiwán OR Filipinas when:1d', 'es-419', 'US:es-419'), sourceName: 'Radar Asia', category: 'GEOPOLÍTICA', weight: 8 },
  { url: gnews('Israel OR Irán OR Gaza OR Líbano OR Siria OR Yemen OR Arabia Saudita when:1d', 'es-419', 'US:es-419'), sourceName: 'Radar Medio Oriente', category: 'GEOPOLÍTICA', weight: 9 },
  { url: gnews('Ucrania OR Rusia OR OTAN OR Unión Europea OR Reino Unido when:1d', 'es-419', 'US:es-419'), sourceName: 'Radar Europa', category: 'GEOPOLÍTICA', weight: 9 },
  { url: gnews('Sudán OR Congo OR Nigeria OR Etiopía OR Sahel OR Sudáfrica when:2d', 'es-419', 'US:es-419'), sourceName: 'Radar África', category: 'PODER & SOCIEDAD', weight: 8 },
  { url: gnews('Trump OR Casa Blanca OR Congreso OR Senado OR Supremo when:1d', 'es-419', 'US:es-419'), sourceName: 'Radar Estados Unidos', category: 'PODER & SOCIEDAD', weight: 9 },
  { url: gnews('terremoto OR huracán OR tsunami OR inundaciones OR incendio forestal OR erupción when:1d', 'es-419', 'US:es-419'), sourceName: 'Radar Desastres', category: 'PODER & SOCIEDAD', weight: 9 },
  { url: gnews('brote OR epidemia OR pandemia OR Ébola OR OMS OR vacuna when:2d', 'es-419', 'US:es-419'), sourceName: 'Radar Salud Global', category: 'PODER & SOCIEDAD', weight: 9 },
  { url: gnews('cambio climático OR ola de calor OR sequía OR COP when:2d', 'es-419', 'US:es-419'), sourceName: 'Radar Clima', category: 'PODER & SOCIEDAD', weight: 7 },
  { url: 'https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=es-419&gl=US&ceid=US:es-419', sourceName: 'Google Ciencia', category: 'TECNOLOGÍA & IA', weight: 7 },
  { url: gnews('Reserva Federal OR BCE OR FMI OR Banco Mundial OR petróleo OR OPEP when:1d', 'es-419', 'US:es-419'), sourceName: 'Radar Bancos Centrales & Energía', category: 'ECONOMÍA GLOBAL', weight: 9 },
  { url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom', sourceName: 'USGS (sismos)', category: 'PODER & SOCIEDAD', weight: 10 },
  { url: 'https://www.ecb.europa.eu/rss/press.html', sourceName: 'Banco Central Europeo', category: 'ECONOMÍA GLOBAL', weight: 9 },
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml', sourceName: 'Reserva Federal', category: 'ECONOMÍA GLOBAL', weight: 9 },

  // Tecnología, ciencia, defensa y finanzas globales (inglés): donde primero salen los anuncios
  { url: 'https://techcrunch.com/feed/', sourceName: 'TechCrunch', category: 'TECNOLOGÍA & IA', weight: 8 },
  { url: 'https://www.theverge.com/rss/index.xml', sourceName: 'The Verge', category: 'TECNOLOGÍA & IA', weight: 8 },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', sourceName: 'Ars Technica', category: 'TECNOLOGÍA & IA', weight: 8 },
  { url: 'https://www.wired.com/feed/rss', sourceName: 'Wired', category: 'TECNOLOGÍA & IA', weight: 8 },
  { url: 'https://www.technologyreview.com/feed/', sourceName: 'MIT Technology Review', category: 'TECNOLOGÍA & IA', weight: 9 },
  { url: 'https://www.nature.com/nature.rss', sourceName: 'Nature', category: 'TECNOLOGÍA & IA', weight: 8 },
  { url: 'https://www.bleepingcomputer.com/feed/', sourceName: 'BleepingComputer', category: 'SEGURIDAD & DEFENSA', weight: 8 },
  { url: 'https://feeds.feedburner.com/TheHackersNews', sourceName: 'The Hacker News', category: 'SEGURIDAD & DEFENSA', weight: 8 },
  { url: 'https://www.defenseone.com/rss/all/', sourceName: 'Defense One', category: 'SEGURIDAD & DEFENSA', weight: 8 },
  { url: 'https://warontherocks.com/feed/', sourceName: 'War on the Rocks', category: 'SEGURIDAD & DEFENSA', weight: 8 },
  { url: 'https://kyivindependent.com/feed/', sourceName: 'The Kyiv Independent', category: 'SEGURIDAD & DEFENSA', weight: 8 },
  { url: 'https://www.politico.eu/feed/', sourceName: 'Politico Europe', category: 'GEOPOLÍTICA', weight: 8 },
  { url: 'https://foreignpolicy.com/feed/', sourceName: 'Foreign Policy', category: 'GEOPOLÍTICA', weight: 9 },
  { url: 'https://www.japantimes.co.jp/feed/', sourceName: 'The Japan Times', category: 'GEOPOLÍTICA', weight: 8 },
  { url: gnews('site:asia.nikkei.com when:1d'), sourceName: 'Nikkei Asia', category: 'ECONOMÍA GLOBAL', weight: 9 },
  { url: 'https://www.cnbc.com/id/100727362/device/rss/rss.html', sourceName: 'CNBC World', category: 'ECONOMÍA GLOBAL', weight: 9 },
  { url: gnews('site:ft.com world OR economy OR markets when:1d'), sourceName: 'Financial Times', category: 'ECONOMÍA GLOBAL', weight: 9 },
];

/** Hechos graves en el titular (muertes, catástrofes, guerra, golpes, atentados), en español e inglés */
export const SEVERE_EVENT = new RegExp(
  '\\b(muertos?|fallecid|mueren|muri[oó]|masacre|atentado|terremoto|sismo|tsunami|hurac[aá]n|erupci[oó]n|invasi[oó]n|declara la guerra|golpe de estado|' +
    'explosi[oó]n|bombardeo|rehenes|se estrell[oó]|accidente a[eé]reo|plane crash|crashes|killed|dead|dies|death toll|massacre|attack|earthquake|tsunami|hurricane|eruption|invasion|declares war|coup|explosion|hostages)\\b',
  'i'
);

/** Marcadores de novedad que permiten publicar una actualización de un hecho grave ya cubierto */
export const UPDATE_NOVELTY_MARKERS = new RegExp(
  '\\b(identifican|identific[oó]|identificad[oa]s?|identidad(?:es)?|causas?|investigaci[oó]n|investigadores|investigan|peritajes?|caja\\s+negra|cajas\\s+negras|' +
    'balance|asciende(?:n)?|sube\\s+a|eleva(?:n)?\\s+a|aumenta(?:n)?\\s+a|v[ií]ctimas|arrestan|arrestad[oa]s?|detienen|detenid[oa]s?|capturan|capturad[oa]s?|' +
    'imputan|imputad[oa]s?|sentencian|sentenciad[oa]s?|condenan|condenad[oa]s?|confirman|confirmad[oa]s?|revelan|hallan|encuentran|rescatan|sobrevivientes?|' +
    'supervivientes?|autopsias?|informe\\s+preliminar|nuevos\\s+detalles|death\\s+toll\\s+rises|toll\\s+rises|toll\\s+climbs|rises\\s+to|climbs\\s+to|' +
    'identified|identifies|identify|victims|causes?|investigators|investigation|black\\s+box|flight\\s+recorder|charged|arrested|sentenced|confirmed|confirms|' +
    'new\\s+details|preliminary\\s+report|survivors?)\\b',
  'gi'
);

/** Agencias y medios de referencia: su verificación propia basta para una urgencia grave */
export const TIER1_SOURCES = new RegExp(
  '^(reuters|associated press|ap news|ap|afp|efe|europa press|bbc|bbc news|bbc mundo|al jazeera|the guardian|the new york times|the washington post|cnn|cnn en espa[nñ]ol|dw|deutsche welle|france 24|rfi|el pa[ií]s|bloomberg|bloomberg l[ií]nea|npr|usgs|noticias de la onu|euronews)\\b',
  'i'
);

const HISTORY_PATH = path.join(process.cwd(), 'storage', 'news_history.json');

interface NewsHistoryData {
  seenUrls: string[];
  processedSignatures?: {
    title: string;
    normalizedTokens: string[];
    date: string;
  }[];
}

const stripAccents = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Normaliza un titular para deduplicación semántica (elimina tildes, stopwords, signos)
 */
export function extractSemanticTokens(text: string): string[] {
  const stopwords = new Set([
    'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para',
    'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este',
    'sí', 'porque', 'esta', 'son', 'entre', 'está', 'cuando', 'muy', 'sin', 'sobre', 'ser',
    'tiene', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante',
    'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'fueron', 'tras', 'dice', 'según', 'ante'
  ]);

  return stripAccents(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

const NUMBER_WORDS: Record<string, string> = {
  uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8',
  nueve: '9', diez: '10', once: '11', doce: '12', trece: '13', catorce: '14', quince: '15',
  dieciseis: '16', diecisiete: '17', dieciocho: '18', diecinueve: '19', veinte: '20', treinta: '30',
  cuarenta: '40', cincuenta: '50', sesenta: '60', setenta: '70', ochenta: '80', noventa: '90',
  cien: '100', ciento: '100', mil: '1000',
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8',
  nine: '9', ten: '10', eleven: '11', twelve: '12', fifteen: '15', twenty: '20', thirty: '30',
};

/**
 * Tokens para reconocer el MISMO HECHO contado con otras palabras por otro medio:
 * conserva cifras ("9", "nueve" → "9") y recorta a una raíz de 6 letras
 * ("estrelló" / "estrellarse" → "estrel", "muertos" → "muerto").
 */
export function extractEventTokens(text: string): string[] {
  const words = stripAccents(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const tokens = new Set<string>();
  for (const w of words) {
    if (/^\d+$/.test(w)) { tokens.add(w); continue; }
    if (NUMBER_WORDS[w]) { tokens.add(NUMBER_WORDS[w]); continue; }
    const base = extractSemanticTokens(w)[0];
    if (base) tokens.add(base.length > 6 ? base.slice(0, 6) : base);
  }
  return Array.from(tokens);
}

/**
 * ¿Es el mismo hecho? Jaccard alto, o al menos 3 términos en común que cubren la mitad
 * del titular más corto (dos medios casi nunca titulan igual el mismo accidente o anuncio).
 */
export function isSameEvent(titleA: string, titleB: string): boolean {
  const a = extractEventTokens(titleA);
  const b = new Set(extractEventTokens(titleB));
  if (a.length < 3 || b.size < 3) return false;
  const shared = a.filter((t) => b.has(t)).length;
  const union = new Set([...a, ...Array.from(b)]).size;
  return shared / union >= 0.5 || (shared >= 3 && shared / Math.min(a.length, b.size) >= 0.5);
}

/** Ventana en la que dos titulares parecidos se consideran el mismo hecho */
const SAME_EVENT_WINDOW_MS = 72 * 3_600_000;
/** Ventana para permitir una actualización de una noticia grave ya publicada (3 a 48 h) */
const MIN_UPDATE_AGE_MS = 3 * 3_600_000;
const MAX_UPDATE_AGE_MS = 48 * 3_600_000;
const MAX_UPDATES_PER_DAY = 2;

function extractNumbers(text: string): string[] {
  const cleaned = stripAccents(text)
    .replace(/(\d)[.,](\d{3})\b/g, '$1$2')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const nums: string[] = [];
  for (const w of cleaned) {
    if (/^\d+$/.test(w)) {
      const n = Number(w);
      if (n >= 2024 && n <= 2028) continue;
      nums.push(String(n));
    } else if (NUMBER_WORDS[w]) {
      nums.push(NUMBER_WORDS[w]);
    }
  }
  return Array.from(new Set(nums));
}

/**
 * Comprueba si un titular candidato aporta un marcador de novedad o una cifra distinta respecto a la nota original
 */
export function hasUpdateNovelty(
  candidateTitle: string,
  origTitlesText: string,
  origFullRefText?: string
): { novel: boolean; reason?: string } {
  const normOrig = stripAccents(origTitlesText);
  UPDATE_NOVELTY_MARKERS.lastIndex = 0;
  const matches = candidateTitle.match(UPDATE_NOVELTY_MARKERS) || [];
  for (const rawMatch of matches) {
    const cleanMatch = stripAccents(rawMatch.trim());
    const root = cleanMatch.slice(0, Math.min(6, cleanMatch.length));
    if (root && !normOrig.includes(root)) {
      return { novel: true, reason: `marcador "${rawMatch.trim()}"` };
    }
  }

  const candNums = extractNumbers(candidateTitle);
  const origTitleNums = extractNumbers(origTitlesText);
  const origAllNums = new Set(extractNumbers(origFullRefText || origTitlesText));
  if (candNums.length > 0 && origTitleNums.length > 0) {
    const diff = candNums.find((n) => !origAllNums.has(n));
    if (diff) {
      return { novel: true, reason: `cifra distinta (${diff})` };
    }
  }

  return { novel: false };
}

const GENERIC_EVENT_TOKENS = new Set([
  'estado', 'unidos', 'gobier', 'presid', 'minist', 'polici', 'fuerza', 'ataque', 'guerra', 'crisis',
  'muerto', 'fallec', 'accide', 'incend', 'explos', 'pais', 'paises', 'ciudad', 'mundo', 'alerta',
]);

function matchesStoryCorpus(candidateTitle: string, storyTitles: string[]): boolean {
  const candSem = extractSemanticTokens(candidateTitle);
  for (const t of storyTitles) {
    if (!t) continue;
    if (calculateSemanticOverlap(candSem, extractSemanticTokens(t)) >= 0.50 || isSameEvent(candidateTitle, t)) {
      return true;
    }
  }
  const combinedTokens = new Set(extractEventTokens(storyTitles.join(' ')));
  const candEvent = extractEventTokens(candidateTitle);
  if (candEvent.length < 3 || combinedTokens.size < 3) return false;
  const shared = candEvent.filter((tok) => combinedTokens.has(tok));
  if (shared.length >= 3 && shared.length / candEvent.length >= 0.45) return true;

  // Titular corto de actualización ("Identifican a las víctimas del Learjet en Florida"):
  // los tokens fuera del marcador de novedad coinciden con las entidades específicas del hecho
  const withoutNovelty = candidateTitle.replace(UPDATE_NOVELTY_MARKERS, ' ');
  const subjectTokens = extractEventTokens(withoutNovelty);
  const specificShared = shared.filter((tok) => !GENERIC_EVENT_TOKENS.has(tok));
  if (
    subjectTokens.length >= 2 &&
    shared.length >= 2 &&
    specificShared.length >= 2 &&
    shared.length / subjectTokens.length >= 0.6
  ) {
    return true;
  }
  return false;
}

export interface MatchUpdateOptions {
  now?: number;
  queue?: any[];
  matchedTitle?: string;
  alreadyUpdatedSlugs?: Set<string>;
  extraUpdatesToday?: number;
}

/**
 * Evalúa si un candidato que coincide con una noticia ya cubierta cumple las 4 reglas para salir como ACTUALIZACIÓN:
 *   (a) nuestra noticia original se publicó hace entre 3 y 48 horas,
 *   (b) la original era grave (SEVERE_EVENT) o urgente,
 *   (c) el titular trae un marcador de novedad o una cifra distinta,
 *   (d) solo 1 actualización por historia original y máximo 2 al día.
 */
export function matchStoryUpdate(candidateTitle: string, opts: MatchUpdateOptions = {}): StoryUpdateInfo | null {
  const now = opts.now ?? Date.now();
  const queue = opts.queue ?? readJsonFile<any[]>(QUEUE_PATH, []);
  if (!Array.isArray(queue) || queue.length === 0) return null;

  const todayKey = localDateKey(new Date(now));
  const activeItems = queue.filter((item) => item && item.status !== 'expired' && item.status !== 'failed');

  // Regla (d): máximo 2 actualizaciones al día y solo 1 por historia original
  const updatesToday =
    activeItems.filter(
      (item) => item.news?.updateOf && localDateKey(item.publishedAt || item.createdAt || new Date(now)) === todayKey
    ).length + (opts.extraUpdatesToday || 0);
  if (updatesToday >= MAX_UPDATES_PER_DAY) return null;

  const updatedSlugs = new Set<string>(opts.alreadyUpdatedSlugs || []);
  for (const item of activeItems) {
    if (item.news?.updateOf) updatedSlugs.add(item.news.updateOf);
  }

  for (const item of activeItems) {
    const news = item?.news;
    const slug = news?.article?.slug;
    if (!news || !slug || news.updateOf) continue;
    if (updatedSlugs.has(slug)) continue;

    const storyTitles = [news.originalTitle, news.headline, news.article?.title].filter(Boolean) as string[];
    const matchesByTitle =
      (opts.matchedTitle && storyTitles.some((t) => t.trim() === opts.matchedTitle!.trim())) ||
      matchesStoryCorpus(candidateTitle, storyTitles);
    if (!matchesByTitle) continue;

    // Regla (a): publicada hace entre 3 y 48 horas
    const pubMs = new Date(item.publishedAt || news.publishedAt || item.createdAt).getTime();
    const createdMs = new Date(item.createdAt || item.publishedAt).getTime();
    const agePub = now - pubMs;
    const ageCreated = now - createdMs;
    const inWindow =
      (Number.isFinite(agePub) && agePub >= MIN_UPDATE_AGE_MS && agePub <= MAX_UPDATE_AGE_MS) ||
      (Number.isFinite(ageCreated) && ageCreated >= MIN_UPDATE_AGE_MS && ageCreated <= MAX_UPDATE_AGE_MS);
    if (!inWindow) continue;

    // Regla (b): noticia original grave (SEVERE_EVENT) o urgente
    const origText = storyTitles.join(' ');
    const isSevereOrUrgent = SEVERE_EVENT.test(origText) || Boolean(item.isBreaking) || (news.urgencyScore || 0) >= 90;
    if (!isSevereOrUrgent) continue;

    // Regla (c): marcador de novedad o cifra distinta respecto a la original
    const origTitlesText = [news.originalTitle, news.headline].filter(Boolean).join(' ');
    const origFullRefText = [news.originalTitle, news.headline, news.subHeadline, news.article?.title, news.article?.dek]
      .filter(Boolean)
      .join(' ');
    const novelty = hasUpdateNovelty(candidateTitle, origTitlesText, origFullRefText);
    if (!novelty.novel) continue;

    return {
      id: news.id,
      slug,
      title: news.article?.title || news.originalTitle || news.headline,
      headline: news.headline || news.originalTitle,
      summary: news.subHeadline || news.article?.dek || '',
      publishedAt: item.publishedAt || item.createdAt,
      reason: novelty.reason,
    };
  }

  return null;
}

/**
 * Calcula la similitud Jaccard entre dos conjuntos de tokens para detectar el mismo hecho
 */
export function calculateSemanticOverlap(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  Array.from(setA).forEach((token) => {
    if (setB.has(token)) intersection++;
  });
  const union = new Set(tokensA.concat(tokensB)).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Lee el historial de URLs y firmas semánticas previas
 */
export function getNewsHistory(): NewsHistoryData {
  try {
    if (!fs.existsSync(HISTORY_PATH)) {
      return { seenUrls: [], processedSignatures: [] };
    }
    const raw = fs.readFileSync(HISTORY_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return {
      seenUrls: data.seenUrls || [],
      processedSignatures: data.processedSignatures || [],
    };
  } catch {
    return { seenUrls: [], processedSignatures: [] };
  }
}

/**
 * Registra una noticia procesada en el historial para evitar repetición temática
 */
export function recordNewsInHistory(url: string, title: string) {
  try {
    const dir = path.dirname(HISTORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const history = getNewsHistory();
    if (!history.seenUrls.includes(url)) {
      history.seenUrls.push(url);
    }

    const tokens = extractSemanticTokens(title);
    if (!history.processedSignatures) history.processedSignatures = [];

    // Mantener sólo las últimas 500 firmas para eficiencia
    history.processedSignatures.unshift({
      title,
      normalizedTokens: tokens,
      date: new Date().toISOString(),
    });

    if (history.seenUrls.length > 1000) {
      history.seenUrls = history.seenUrls.slice(-1000);
    }
    if (history.processedSignatures.length > 500) {
      history.processedSignatures = history.processedSignatures.slice(0, 500);
    }

    writeJsonFileAtomic(HISTORY_PATH, history);
  } catch (err) {
    console.error('[NewsScout] Error al guardar en historial:', err);
  }
}

/**
 * Registra una noticia en el historial con su URL, titular original y titular editorial.
 * Se llama al ENCOLAR (no al publicar) para que el Scout no vuelva a elegirla en el siguiente ciclo.
 */
export function markStoryAsCovered(url: string, titles: (string | undefined)[]) {
  const unique = Array.from(new Set(titles.filter((t): t is string => Boolean(t && t.trim()))));
  if (unique.length === 0) unique.push(url);
  unique.forEach((t) => recordNewsInHistory(url, t));
}

/**
 * Verifica si una noticia ya fue cubierta conceptualmente por otro medio.
 * Si coincide con una historia nuestra previa pero cumple las reglas de actualización
 * (3-48 h, hecho grave/urgente, marcador de novedad o cifra distinta, <=1 por historia y <=2/día),
 * devuelve false para permitir que pase como actualización.
 */
export function isDuplicateEvent(title: string, history: NewsHistoryData, opts: MatchUpdateOptions = {}): boolean {
  const currentTokens = extractSemanticTokens(title);
  if (currentTokens.length < 3) return false;

  const now = opts.now ?? Date.now();
  let matchedDuplicate = false;

  for (const signature of history.processedSignatures || []) {
    const similarity = calculateSemanticOverlap(currentTokens, signature.normalizedTokens);
    // Si comparten más del 50% de palabras clave esenciales, es el mismo evento
    if (similarity >= 0.50) {
      matchedDuplicate = true;
      break;
    }
    // Mismo hecho redactado distinto por otro medio (solo en los últimos días)
    const age = now - new Date(signature.date).getTime();
    if (signature.title && (!Number.isFinite(age) || age <= SAME_EVENT_WINDOW_MS) && isSameEvent(title, signature.title)) {
      matchedDuplicate = true;
      break;
    }
  }

  if (!matchedDuplicate) {
    const queue = opts.queue ?? readJsonFile<any[]>(QUEUE_PATH, []);
    for (const item of Array.isArray(queue) ? queue : []) {
      const news = item?.news;
      if (!news) continue;
      const age = now - new Date(item.createdAt || item.publishedAt).getTime();
      if (Number.isFinite(age) && age <= SAME_EVENT_WINDOW_MS) {
        const storyTitles = [news.originalTitle, news.headline, news.article?.title].filter(Boolean) as string[];
        if (matchesStoryCorpus(title, storyTitles)) {
          matchedDuplicate = true;
          break;
        }
      }
    }
  }

  if (!matchedDuplicate) return false;
  return matchStoryUpdate(title, opts) === null;
}

/**
 * Firmas de lo que ya está en la cola (pendiente o publicado), leídas directamente del disco
 * para no depender del historial: si algo está en cola, no se vuelve a producir.
 */
function getQueueSignatures(): { urls: Set<string>; signatures: NonNullable<NewsHistoryData['processedSignatures']> } {
  const queue = readJsonFile<any[]>(QUEUE_PATH, []);
  const urls = new Set<string>();
  const signatures: NonNullable<NewsHistoryData['processedSignatures']> = [];
  for (const item of Array.isArray(queue) ? queue : []) {
    const news = item?.news;
    if (!news) continue;
    if (news.originalUrl) urls.add(news.originalUrl);
    for (const t of [news.originalTitle, news.headline]) {
      if (t) signatures.push({ title: t, normalizedTokens: extractSemanticTokens(t), date: item.createdAt });
    }
  }
  return { urls, signatures };
}

/**
 * Califica el impacto y urgencia de 60 a 99 según palabras clave geopolíticas y severidad
 */
export function scoreNewsImpact(title: string, snippet: string, feedWeight: number): { urgency: number; geopoliticalImpact: number } {
  const text = ` ${stripAccents(`${title} ${snippet}`).replace(/[^a-z0-9\s]/g, ' ')} `;

  // Coincidencia por palabra completa (antes "fed" coincidía con "federal" y "baja" con casi todo)
  const highImpactKeywords = [
    'guerra', 'misil', 'ataque', 'nuclear', 'sanciones', 'petróleo', 'banco central',
    'aranceles', 'otan', 'kremlin', 'pentágono', 'taiwan', 'golpe de estado', 'elecciones',
    'crisis', 'inflación', 'reserva federal', 'cepa', 'fmi', 'deuda', 'soberanía', 'ciberataque',
    'renuncia', 'tratado', 'fuerzas armadas', 'invasión', 'alto el fuego',
    'inteligencia artificial', 'openai', 'nvidia', 'semiconductores', 'microchips',
    'algoritmo', 'tsmc', 'supercomputadora', 'cuántica', 'silicon valley', 'deepfake',
    'ciberseguridad', 'espionaje digital', 'monopolio', 'big tech',
    // Inglés (agencias y prensa internacional)
    'war', 'missile', 'strike', 'nuclear', 'sanctions', 'oil', 'central bank', 'tariffs', 'nato', 'kremlin', 'pentagon',
    'coup', 'election', 'elections', 'crisis', 'inflation', 'federal reserve', 'imf', 'debt', 'cyberattack', 'resigns',
    'treaty', 'invasion', 'ceasefire', 'artificial intelligence', 'semiconductors', 'earthquake', 'tsunami', 'hurricane',
    'outbreak', 'pandemic', 'ebola', 'killed', 'death toll', 'explosion', 'hostages', 'shutdown', 'default', 'recession',
    'estado de emergencia', 'terremoto', 'huracán', 'tsunami', 'brote', 'pandemia', 'muertos', 'masacre', 'rehenes', 'recesión'
  ];

  let matches = 0;
  for (const kw of highImpactKeywords) {
    if (text.includes(` ${stripAccents(kw)} `)) matches++;
  }

  // Base 65 + hasta 20 puntos por keywords + hasta 14 puntos por el peso de la fuente
  const urgency = Math.min(99, Math.max(60, 65 + (matches * 4) + Math.round((feedWeight / 10) * 10)));
  const geopoliticalImpact = Math.min(99, Math.max(60, 60 + (matches * 5) + (feedWeight * 2)));

  return { urgency, geopoliticalImpact };
}

/**
 * Agente 1: News Scout & Fact-Checker
 * Monitoriza feeds internacionales, deduplica semánticamente y califica urgencia.
 */
export async function runNewsScout(limitPerFeed: number = 3): Promise<RawArticle[]> {
  const baseHistory = getNewsHistory();
  const queued = getQueueSignatures();
  const queueItems = readJsonFile<any[]>(QUEUE_PATH, []);
  const history: NewsHistoryData = {
    seenUrls: baseHistory.seenUrls,
    processedSignatures: [...(baseHistory.processedSignatures || []), ...queued.signatures],
  };
  const seenSet = new Set([...history.seenUrls, ...Array.from(queued.urls)]);
  const candidates: RawArticle[] = [];

  // Función auxiliar para parsear un feed con timeout de seguridad
  const fetchSingleFeed = async (feed: ExpandedFeedConfig) => {
    try {
      const parsed = await Promise.race([
        parser.parseURL(feed.url),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Feed timeout (10s)')), 10000)
        )
      ]);

      const items = (parsed.items || []).slice(0, limitPerFeed);
      const feedCandidates: RawArticle[] = [];

      for (const item of items) {
        const link = item.link || '';
        const title = (item.title || '').trim();

        if (!link || !title || seenSet.has(link)) {
          continue;
        }

        let cleanTitle = title;
        let sourceName = feed.sourceName;

        if (feed.url.includes('news.google.com') && title.includes(' - ')) {
          const parts = title.split(' - ');
          sourceName = parts.pop()?.trim() || feed.sourceName;
          cleanTitle = parts.join(' - ').trim();
        }

        // Deduplicación semántica para evitar repetir la misma historia de dos medios
        // (salvo que cumpla las reglas estrictas de actualización de una noticia grave ya publicada)
        if (isDuplicateEvent(cleanTitle, history, { queue: queueItems })) {
          continue;
        }
        const updateInfo = matchStoryUpdate(cleanTitle, { queue: queueItems });
        if (updateInfo) {
          console.log(`[NewsScout] Candidata de ACTUALIZACIÓN para ${updateInfo.slug} (${updateInfo.reason}): "${cleanTitle}"`);
        }

        let imageUrl: string | undefined = undefined;
        if (item.enclosure?.url) {
          imageUrl = item.enclosure.url;
        } else if (item['mediaContent']?.$?.url) {
          imageUrl = item['mediaContent'].$.url;
        } else if (item['mediaThumbnail']?.$?.url) {
          imageUrl = item['mediaThumbnail'].$.url;
        } else if (item['image']?.url) {
          imageUrl = item['image'].url;
        }

        const snippet = item.contentSnippet || item.content || cleanTitle;
        const { urgency, geopoliticalImpact } = scoreNewsImpact(cleanTitle, snippet, feed.weight);

        feedCandidates.push({
          tier1: TIER1_SOURCES.test(sourceName.trim()),
          id: Math.random().toString(36).substring(2, 11),
          title: cleanTitle,
          link,
          pubDate: item.pubDate || new Date().toISOString(),
          contentSnippet: snippet,
          sourceName,
          category: feed.category,
          imageUrl,
          urgencyScore: urgency,
          geopoliticalImpact,
          ...(updateInfo ? { updateOf: updateInfo.slug, updateOriginal: updateInfo } : {}),
        });
      }

      return feedCandidates;
    } catch (err: any) {
      console.warn(`[NewsScout] Feed omitido temporalmente (${feed.sourceName}):`, err?.message);
      return [];
    }
  };

  // Consultar todas las fuentes concurrentemente en paralelo
  const results = await Promise.allSettled(SCOUT_FEEDS.map((feed) => fetchSingleFeed(feed)));

  for (const res of results) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      candidates.push(...res.value);
    }
  }

  // Ordenar por urgencia decreciente y quitar el mismo hecho repetido por varios medios en esta ronda
  candidates.sort((a, b) => (b.urgencyScore || 0) - (a.urgencyScore || 0));
  // coverageCount: cuántos medios cuentan el mismo hecho (señal fuerte de noticia de última hora)
  const unique: RawArticle[] = [];
  const seenUpdateSlugs = new Set<string>();
  let updateCandidatesCount = 0;
  const existingUpdatesToday = queueItems.filter(
    (item) => item && item.status !== 'expired' && item.status !== 'failed' && item.news?.updateOf && localDateKey(item.publishedAt || item.createdAt) === localDateKey()
  ).length;

  for (const c of candidates) {
    const tokens = extractSemanticTokens(c.title);
    const match = unique.find(
      (u) =>
        (c.updateOf && u.updateOf === c.updateOf) ||
        calculateSemanticOverlap(tokens, extractSemanticTokens(u.title)) >= 0.5 ||
        isSameEvent(c.title, u.title)
    );
    if (match) {
      match.coverageCount = (match.coverageCount || 1) + 1;
      if (c.tier1) match.tier1 = true;
    } else {
      if (c.updateOf) {
        if (seenUpdateSlugs.has(c.updateOf) || existingUpdatesToday + updateCandidatesCount >= MAX_UPDATES_PER_DAY) {
          continue;
        }
        seenUpdateSlugs.add(c.updateOf);
        updateCandidatesCount++;
      }
      unique.push({ ...c, coverageCount: 1 });
    }
  }
  // Una noticia que cuentan varios medios a la vez, o con un hecho grave en el titular, es de verdad urgente:
  // sin este refuerzo la urgencia por palabras clave casi nunca llegaba al umbral de "última hora" (95).
  for (const u of unique) {
    const severe = SEVERE_EVENT.test(u.title);
    // Un hecho grave de una fuente de primer nivel vale por sí solo; el resto lo refuerzan los medios que lo repiten
    const bonus = Math.min(20, ((u.coverageCount || 1) - 1) * 7) + (severe ? 8 : 0) + (severe && u.tier1 ? 10 : 0);
    if (bonus > 0) u.urgencyScore = Math.min(99, (u.urgencyScore || 70) + bonus);
  }
  return unique;
}
