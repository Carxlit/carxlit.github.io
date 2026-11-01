import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import { RawArticle, NewsCategory } from '@/types/news';
import { extractArticleImage } from './article-image';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
    ],
  },
});

interface FeedConfig {
  url: string;
  sourceName: string;
  category: NewsCategory;
}

const FEEDS: FeedConfig[] = [
  {
    url: 'https://news.google.com/rss?hl=es-419&gl=US&ceid=US:es-419',
    sourceName: 'Google Noticias',
    category: 'mundo',
  },
  {
    url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=es-419&gl=US&ceid=US:es-419',
    sourceName: 'Internacional',
    category: 'mundo',
  },
  {
    url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=es-419&gl=US&ceid=US:es-419',
    sourceName: 'Tecnología',
    category: 'tecnologia',
  },
  {
    url: 'https://feeds.bbci.co.uk/mundo/rss.xml',
    sourceName: 'BBC Mundo',
    category: 'mundo',
  },
];

const HISTORY_PATH = path.join(process.cwd(), 'storage', 'news_history.json');

/**
 * Lee el historial de URLs ya procesadas para evitar duplicados
 */
export function getSeenUrls(): Set<string> {
  try {
    if (!fs.existsSync(HISTORY_PATH)) {
      return new Set();
    }
    const data = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
    return new Set(data.seenUrls || []);
  } catch {
    return new Set();
  }
}

/**
 * Guarda una URL como procesada
 */
export function markUrlAsSeen(url: string) {
  try {
    const dir = path.dirname(HISTORY_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let seen: string[] = [];
    if (fs.existsSync(HISTORY_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
      seen = parsed.seenUrls || [];
    }
    if (!seen.includes(url)) {
      seen.push(url);
      // Mantener máximo los últimos 1,000 links
      if (seen.length > 1000) seen = seen.slice(-1000);
      fs.writeFileSync(HISTORY_PATH, JSON.stringify({ seenUrls: seen }, null, 2));
    }
  } catch (err) {
    console.error('Error al guardar URL en historial:', err);
  }
}

/**
 * Obtiene las noticias más recientes sin procesar desde las fuentes RSS
 */
export async function fetchLatestNews(limitPerFeed: number = 4): Promise<RawArticle[]> {
  const seenUrls = getSeenUrls();
  const rawArticles: RawArticle[] = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items || []).slice(0, limitPerFeed);

      for (const item of items) {
        const link = item.link || '';
        const title = (item.title || '').trim();

        if (!link || !title || seenUrls.has(link)) {
          continue;
        }

        // Detectar si el RSS trajo imagen directa
        let imageUrl: string | undefined = undefined;
        if (item.enclosure?.url) {
          imageUrl = item.enclosure.url;
        } else if (item['mediaContent']?.$?.url) {
          imageUrl = item['mediaContent'].$.url;
        }

        let cleanTitle = title;
        let sourceName = feed.sourceName;

        if (title.includes(' - ')) {
          const parts = title.split(' - ');
          sourceName = parts.pop()?.trim() || feed.sourceName;
          cleanTitle = parts.join(' - ').trim();
        }

        rawArticles.push({
          id: Math.random().toString(36).substring(2, 11),
          title: cleanTitle,
          link,
          pubDate: item.pubDate || new Date().toISOString(),
          contentSnippet: item.contentSnippet || item.content || cleanTitle,
          sourceName,
          category: feed.category,
          imageUrl,
        });
      }
    } catch (err: any) {
      console.warn(`No se pudo leer feed ${feed.sourceName}:`, err?.message);
    }
  }

  return rawArticles;
}

