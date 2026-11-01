import Parser from 'rss-parser';
import { RawArticle } from '@/types/news';
import { resolveGoogleNewsUrl } from '@/lib/news/article-image';

const parser = new Parser();

export interface CorroboratingSource {
  sourceName: string;
  title: string;
  snippet: string;
  link: string;
}

export interface ResearchDossier {
  primarySource: string;
  primaryHeadline: string;
  primaryFullText?: string;
  corroboratingSources: CorroboratingSource[];
  sourcesConsultedCount: number;
  sourcesList: string[];
  crossSourceSummary: string;
}

/**
 * Extrae palabras clave periodísticas limpias del titular para rastrear la misma historia
 */
export function extractInvestigationKeywords(title: string): string {
  const clean = title
    .replace(/[.,:;¿?¡!'"“”«»()\[\]-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const stopwords = new Set([
    'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para',
    'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este',
    'sí', 'porque', 'esta', 'son', 'entre', 'está', 'cuando', 'muy', 'sin', 'sobre', 'ser',
    'tiene', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante',
    'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'fueron', 'tras', 'dice', 'según', 'ante'
  ]);

  const tokens = clean
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word.toLowerCase()));

  // Tomar entre 4 y 6 palabras clave esenciales
  return tokens.slice(0, 5).join(' ');
}

/**
 * Descarga y extrae el texto periodístico real de la página del artículo
 */
export async function fetchFullArticleText(url: string): Promise<string> {
  if (!url || url.includes('news.google.com')) {
    return '';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });

    clearTimeout(timeout);
    if (!res.ok) return '';

    const html = await res.text();

    // Eliminar scripts, estilos, comentarios, cabeceras y menús
    const cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ');

    // Extraer texto de párrafos <p>
    const paragraphs: string[] = [];
    const pRegex = /<p\b[^>]*>(.*?)<\/p>/gi;
    let match;

    while ((match = pRegex.exec(cleaned)) !== null) {
      const text = match[1]
        .replace(/<[^>]+>/g, '') // Quitar etiquetas HTML internas
        .replace(/&nbsp;/g, ' ')
        .replace(/&[a-z]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Párrafos informativos con sustancia periodística (más de 40 caracteres)
      if (text.length > 40 && !text.toLowerCase().includes('suscríbete') && !text.toLowerCase().includes('cookies')) {
        paragraphs.push(text);
      }
    }

    // Unir los primeros 10-15 párrafos sustanciales (máximo ~2000 palabras)
    return paragraphs.slice(0, 15).join('\n\n');
  } catch (err: any) {
    console.warn(`[DeepResearcher] Extracción de texto completo no disponible para ${url}:`, err?.message);
    return '';
  }
}

/**
 * Investiga en múltiples medios internacionales la misma noticia para contrastar perspectivas
 */
export async function findCorroboratingCoverage(
  title: string,
  primarySource: string
): Promise<CorroboratingSource[]> {
  const keywords = extractInvestigationKeywords(title);
  if (!keywords) return [];

  const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keywords)}+when:3d&hl=es-419&gl=US&ceid=US:es-419`;

  try {
    const parsed = await parser.parseURL(searchUrl);
    const items = (parsed.items || []).slice(0, 8);
    const corroborating: CorroboratingSource[] = [];

    for (const item of items) {
      let sourceName = 'Medio Internacional';
      let cleanHeadline = item.title || '';

      if (cleanHeadline.includes(' - ')) {
        const parts = cleanHeadline.split(' - ');
        sourceName = parts.pop()?.trim() || sourceName;
        cleanHeadline = parts.join(' - ').trim();
      }

      // Evitar duplicar la misma fuente primaria
      if (sourceName.toLowerCase() === primarySource.toLowerCase()) {
        continue;
      }

      corroborating.push({
        sourceName,
        title: cleanHeadline,
        snippet: (item.contentSnippet || item.content || cleanHeadline).replace(/\s+/g, ' ').trim(),
        link: item.link || '',
      });

      if (corroborating.length >= 4) break;
    }

    return corroborating;
  } catch (err: any) {
    console.warn('[DeepResearcher] Error al rastrear fuentes corroborantes:', err?.message);
    return [];
  }
}

/**
 * Agente de Investigación: Cruza y reúne información de múltiples páginas y fuentes
 */
export async function buildMultiSourceDossier(article: RawArticle): Promise<ResearchDossier> {
  console.log(`[DeepResearcher] Investigando fuentes cruzadas para: "${article.title.slice(0, 60)}..."`);

  // 1. Extraer texto completo del artículo (resolviendo antes los enlaces de Google News al medio real)
  let fullArticleText = '';
  if (article.link) {
    const directUrl = await resolveGoogleNewsUrl(article.link);
    if (directUrl) fullArticleText = await fetchFullArticleText(directUrl);
  }

  // 2. Rastrear cobertura en otros medios internacionales
  const corroborating = await findCorroboratingCoverage(article.title, article.sourceName);

  // 3. Compilar lista de fuentes consultadas
  const sourcesSet = new Set<string>([article.sourceName]);
  corroborating.forEach((c) => sourcesSet.add(c.sourceName));
  const sourcesList = Array.from(sourcesSet);

  // 4. Crear síntesis estructurada para el Director Editorial y Redactor
  const crossSummaries = corroborating.map((c) => `• ${c.sourceName}: "${c.title}" -> ${c.snippet}`).join('\n');

  const compiledBriefing = [
    `FUENTE PRINCIPAL: ${article.sourceName}`,
    fullArticleText ? `TEXTO COMPLETO EXTRAÍDO:\n${fullArticleText.slice(0, 4000)}...` : `RESUMEN DE ORIGEN: ${article.contentSnippet}`,
    corroborating.length > 0 
      ? `COBERTURA CORROBORADA EN OTROS MEDIOS (${corroborating.length} fuentes consultadas):\n${crossSummaries}`
      : 'COBERTURA EXCLUSIVA O EN DESARROLLO INMEDIATO.',
  ].join('\n\n');

  console.log(`[DeepResearcher] Dossier completado con ${sourcesList.length} fuentes recopiladas: [${sourcesList.join(', ')}]`);

  return {
    primarySource: article.sourceName,
    primaryHeadline: article.title,
    primaryFullText: fullArticleText || undefined,
    corroboratingSources: corroborating,
    sourcesConsultedCount: sourcesList.length,
    sourcesList,
    crossSourceSummary: compiledBriefing,
  };
}

