import { ProcessedNews } from '@/types/news';
import { truncateGraphemes } from './bluesky-client';

// Bloque final de hashtags, vaya en su propia línea o pegado a la última frase
const TRAILING_HASHTAGS = new RegExp('\\s+((?:#[\\p{L}\\p{N}_]+\\s*)+)$', 'u');

/**
 * Inserta una línea al final del post pero antes del bloque de hashtags
 */
export function insertBeforeHashtags(text: string, line: string): string {
  const match = text.match(TRAILING_HASHTAGS);
  return match
    ? `${text.slice(0, match.index).trimEnd()}\n\n${line}\n\n${match[1].trim()}`
    : `${text.trimEnd()}\n\n${line}`;
}

/**
 * Cita la fuente si el texto no la menciona ya
 */
export function withSourceCredit(text: string, sourceName?: string): string {
  if (!sourceName || /fuente\s*:/i.test(text)) return text;
  return insertBeforeHashtags(text, `Fuente: ${sourceName}`);
}

/**
 * Devuelve los copys con el enlace al artículo completo incorporado (Facebook y LinkedIn).
 * Telegram y Bluesky lo añaden en su publicador (enlace HTML y facet con texto corto).
 */
export function withArticleLink(news: ProcessedNews, url?: string): ProcessedNews {
  if (!url) return news;
  const line = `Análisis completo: ${url}`;
  return {
    ...news,
    facebookPost: insertBeforeHashtags(news.facebookPost, line),
    linkedInPost: news.linkedInPost ? insertBeforeHashtags(news.linkedInPost, line) : news.linkedInPost,
  };
}

/**
 * Compone el post de Bluesky dentro de 300 grafemas conservando los hashtags.
 * Con enlace, muestra un texto corto ("dominio/…") y devuelve su posición para el facet.
 */
export function composeBlueskyText(base: string, url?: string): { text: string; link?: { display: string; url: string } } {
  const match = base.match(TRAILING_HASHTAGS);
  const body = match ? base.slice(0, match.index).trim() : base.trim();
  const tags = match ? match[1].trim() : '';

  let display = '';
  if (url) {
    const bare = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    display = bare.length > 34 ? `${bare.slice(0, 33)}…` : bare;
  }

  const tail = [tags, display].filter(Boolean).join('\n');
  const room = 300 - (tail ? Array.from(tail).length + 2 : 0);
  const text = tail ? `${truncateGraphemes(body, room)}\n\n${tail}` : truncateGraphemes(body, 300);
  return { text, link: url ? { display, url } : undefined };
}
