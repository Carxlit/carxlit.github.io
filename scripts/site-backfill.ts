import './clean-env';
import path from 'path';
import { readJsonFile, writeJsonFileAtomic } from '@/lib/storage/json-store';
import { getSiteEntries, saveArticlePhoto, rebuildAllSitePages } from '@/lib/site/static-site';
import { findNewsVideo } from '@/lib/news/news-video';
import { fetchArticlePage } from '@/lib/agents/deep-researcher';

/**
 * Completa los artículos ya publicados con lo que tienen los nuevos: foto limpia (sin textos encima)
 * y video real de la noticia si existe. Después regenera todo el sitio.
 * Uso: npm run site:backfill
 */
async function main() {
  const storage = (f: string) => readJsonFile<any[]>(path.join(process.cwd(), 'storage', f), []);
  const known = [...storage('published_news.json'), ...storage('publication_queue.json').map((q) => q.news)].filter(Boolean);
  const bySlug = new Map<string, any>(known.filter((n) => n?.article?.slug).map((n) => [n.article.slug, n]));

  const entries = getSiteEntries();
  for (const entry of entries) {
    const news = bySlug.get(entry.slug);
    if (!entry.photo && news?.rawImageUrl) entry.photo = await saveArticlePhoto(news.rawImageUrl, entry.slug);
    // Se recalcula siempre (las reglas de coincidencia pueden haber cambiado), salvo el video elegido al redactar
    const sourceUrl = entry.article.sources[0]?.url;
    const { html } = sourceUrl ? await fetchArticlePage(sourceUrl) : { html: '' };
    entry.video = news?.sourceVideo || (await findNewsVideo([news?.originalTitle, entry.title].filter(Boolean), html ? [html] : []));
    console.log(`${entry.slug}: foto ${entry.photo ? 'sí' : 'no'} · video ${entry.video ? `"${entry.video.title}"` : 'no'}`);
  }
  writeJsonFileAtomic(path.join(process.cwd(), 'storage', 'site_articles.json'), entries);
  console.log(`Sitio regenerado: ${rebuildAllSitePages()} artículos`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
