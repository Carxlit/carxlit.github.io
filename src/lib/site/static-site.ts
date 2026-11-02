import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { ProcessedNews } from '@/types/news';
import { readJsonFile, writeJsonFileAtomic } from '@/lib/storage/json-store';
import {
  FAVICON_SVG,
  indexPageRel,
  renderArticlePage,
  renderCategoryPage,
  renderIndexPage,
  renderManifest,
  renderNewsSitemap,
  renderNotFoundPage,
  renderRss,
  renderSitemap,
  renderStaticPage,
  SiteEntry,
} from './templates';
import { getSiteConfig, SiteConfig } from './site-config';
import { getStaticPages } from './static-pages';
import { SITE_CATEGORIES, categoryPath } from './categories';

/**
 * Agente 7: Editor Web
 * Publica cada historia como artículo completo en un sitio estático (carpeta site/),
 * lo despliega con el comando configurado y devuelve la URL pública para adjuntarla en los posts.
 *
 * Configuración (.env.local):
 * - PUBLIC_SITE_URL: dominio público del sitio (p. ej. https://puntociego.pages.dev). Vacío = sin enlace en posts.
 * - SITE_DEPLOY_COMMAND: comando que sube la carpeta site/ (p. ej. un deploy de Cloudflare Pages o un git push).
 * Monetización, analítica, contacto y redes: storage/site_config.json (ver site_config.example.json).
 */

export const SITE_DIR = path.join(process.cwd(), 'site');
const STORE_PATH = path.join(process.cwd(), 'storage', 'site_articles.json');
/** Artículos por página de portada/archivo */
const PAGE_SIZE = 15;
const MAX_CATEGORY_ITEMS = 60;
/** Al publicar, solo se regeneran los artículos recientes (sus "Lo último"/"Relacionadas" cambian) */
const REFRESH_RECENT_ARTICLES = 30;
/** Artículos con menos palabras no se publican (mejor sin enlace que con una página pobre) */
const MIN_ARTICLE_WORDS = 300;

export function getPublicSiteUrl(): string {
  return (process.env.PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
}

export function getSiteEntries(): SiteEntry[] {
  return readJsonFile<SiteEntry[]>(STORE_PATH, []);
}

function articlePath(slug: string) {
  return `noticias/${slug}/`;
}

const sortLatest = (entries: SiteEntry[]) => [...entries].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

function writePage(rel: string, html: string) {
  const dir = path.join(SITE_DIR, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

function writeArticle(entry: SiteEntry, latest: SiteEntry[], baseUrl: string, config: SiteConfig) {
  writePage(entry.path, renderArticlePage(entry, baseUrl, { entries: latest, config }));
}

/**
 * Regenera portada paginada, secciones, páginas informativas, 404, RSS, sitemaps, robots, ads.txt e iconos
 */
export function rebuildSiteIndex(entries: SiteEntry[] = getSiteEntries()) {
  const baseUrl = getPublicSiteUrl();
  const config = getSiteConfig();
  const latest = sortLatest(entries);
  fs.mkdirSync(SITE_DIR, { recursive: true });

  // Portada y archivo paginado
  const totalPages = Math.max(1, Math.ceil(latest.length / PAGE_SIZE));
  for (let page = 1; page <= totalPages; page++) {
    const slice = latest.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    writePage(indexPageRel(page), renderIndexPage(slice, baseUrl, { page, totalPages, config }));
  }

  // Secciones (las fijas y cualquier otra categoría que aparezca)
  const categories = Array.from(new Set<string>([...SITE_CATEGORIES, ...latest.map((e) => e.category)]));
  for (const category of categories) {
    const items = latest.filter((e) => e.category === category).slice(0, MAX_CATEGORY_ITEMS);
    writePage(categoryPath(category), renderCategoryPage(category, items, baseUrl, config));
  }

  // Páginas informativas y legales
  const staticPages = getStaticPages(config);
  for (const page of staticPages) writePage(page.rel, renderStaticPage(page, baseUrl, config));

  fs.writeFileSync(path.join(SITE_DIR, '404.html'), renderNotFoundPage(baseUrl, config, latest));
  fs.writeFileSync(path.join(SITE_DIR, 'favicon.svg'), FAVICON_SVG);
  fs.writeFileSync(path.join(SITE_DIR, 'site.webmanifest'), renderManifest());
  fs.writeFileSync(path.join(SITE_DIR, 'rss.xml'), renderRss(latest.slice(0, 30), baseUrl, config));
  fs.writeFileSync(
    path.join(SITE_DIR, 'sitemap.xml'),
    renderSitemap(latest, baseUrl, [
      ...categories.map(categoryPath),
      ...staticPages.map((p) => p.rel),
      ...Array.from({ length: totalPages - 1 }, (_, i) => indexPageRel(i + 2)),
    ])
  );
  fs.writeFileSync(path.join(SITE_DIR, 'news-sitemap.xml'), renderNewsSitemap(latest, baseUrl));
  fs.writeFileSync(
    path.join(SITE_DIR, 'robots.txt'),
    `User-agent: *\nAllow: /\n${baseUrl ? `Sitemap: ${baseUrl}/sitemap.xml\nSitemap: ${baseUrl}/news-sitemap.xml\n` : ''}`
  );
  const adsTxtPath = path.join(SITE_DIR, 'ads.txt');
  if (config.adsTxt) fs.writeFileSync(adsTxtPath, `${config.adsTxt}\n`);
  else if (fs.existsSync(adsTxtPath)) fs.unlinkSync(adsTxtPath);
}

/**
 * Regenera todas las páginas de artículo (p. ej. tras cambiar PUBLIC_SITE_URL o storage/site_config.json,
 * para que canonical, og:url, og:image y anuncios queden al día) y el resto del sitio.
 */
export function rebuildAllSitePages(): number {
  const baseUrl = getPublicSiteUrl();
  const config = getSiteConfig();
  const latest = sortLatest(getSiteEntries());
  for (const entry of latest) writeArticle(entry, latest, baseUrl, config);
  rebuildSiteIndex(latest);
  return latest.length;
}

/**
 * Ejecuta el despliegue configurado. Nunca lanza.
 */
export function deploySite(): Promise<{ ok: boolean; message: string }> {
  const command = (process.env.SITE_DEPLOY_COMMAND || '').trim();
  if (!command) return Promise.resolve({ ok: false, message: 'SITE_DEPLOY_COMMAND no configurado (sitio solo local).' });
  return new Promise((resolve) => {
    exec(command, { cwd: process.cwd(), timeout: 4 * 60 * 1000, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        console.error('[EditorWeb] Falló el despliegue:', err.message, stderr?.slice(-500));
        resolve({ ok: false, message: err.message });
      } else {
        resolve({ ok: true, message: stdout.slice(-300) });
      }
    });
  });
}

const liveCache = new Map<string, { ok: boolean; at: number }>();

/**
 * ¿Responde la URL pública? Solo se adjunta el enlace a los posts si el artículo ya está en línea.
 */
export async function isUrlLive(url: string): Promise<boolean> {
  const cached = liveCache.get(url);
  if (cached && Date.now() - cached.at < (cached.ok ? 60 : 5) * 60 * 1000) return cached.ok;
  let ok = false;
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000) });
    ok = res.ok;
  } catch {
    ok = false;
  }
  liveCache.set(url, { ok, at: Date.now() });
  return ok;
}

export async function waitUntilLive(url: string, timeoutMs = 90_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    liveCache.delete(url);
    if (await isUrlLive(url)) return true;
    await new Promise((r) => setTimeout(r, 10_000));
  }
  return false;
}

/**
 * Publica el artículo de la noticia en el sitio. Devuelve la URL pública si quedó en línea
 * (o la URL prevista si no hay comando de despliegue pero sí dominio). Nunca lanza.
 */
export async function publishArticleToSite(news: ProcessedNews): Promise<string | undefined> {
  const article = news.article;
  if (!article) return undefined;
  if (article.wordCount < MIN_ARTICLE_WORDS || article.sections.length < 3) {
    console.warn(`[EditorWeb] Artículo demasiado corto (${article.wordCount} palabras); no se publica.`);
    return undefined;
  }

  try {
    const baseUrl = getPublicSiteUrl();
    const relPath = articlePath(article.slug);
    const dir = path.join(SITE_DIR, 'noticias', article.slug);
    fs.mkdirSync(dir, { recursive: true });

    // Copiar la tarjeta como imagen del artículo y de la vista previa social (og:image)
    let imageFile: string | undefined;
    if (news.cardImageUrl) {
      const src = path.join(process.cwd(), 'public', news.cardImageUrl.replace(/^\//, ''));
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.join(SITE_DIR, 'img'), { recursive: true });
        imageFile = `img/${article.slug}.jpg`;
        fs.copyFileSync(src, path.join(SITE_DIR, imageFile));
      }
    }

    const entry: SiteEntry = {
      slug: article.slug,
      path: relPath,
      title: article.title,
      headline: news.headline,
      dek: article.dek,
      category: String(news.category),
      sourceName: news.sourceName,
      image: imageFile,
      publishedAt: new Date().toISOString(),
      article,
      blindSpot: news.blindSpotAngle,
    };

    const entries = getSiteEntries().filter((e) => e.slug !== entry.slug);
    entries.unshift(entry);
    writeJsonFileAtomic(STORE_PATH, entries.slice(0, 2000));

    // El nuevo artículo y los recientes (cambian sus bloques "Lo último" y "Relacionadas")
    const config = getSiteConfig();
    const latest = sortLatest(entries);
    for (const e of latest.slice(0, REFRESH_RECENT_ARTICLES)) writeArticle(e, latest, baseUrl, config);
    if (!latest.slice(0, REFRESH_RECENT_ARTICLES).some((e) => e.slug === entry.slug)) writeArticle(entry, latest, baseUrl, config);
    rebuildSiteIndex(latest);

    if (!baseUrl) {
      console.log(`[EditorWeb] Artículo generado en site/${relPath} (sin PUBLIC_SITE_URL: no se enlaza en posts).`);
      return undefined;
    }

    const publicUrl = `${baseUrl}/${relPath}`;
    const deploy = await deploySite();
    if (deploy.ok) {
      const live = await waitUntilLive(publicUrl);
      console.log(`[EditorWeb] Artículo ${live ? 'en línea' : 'desplegado (aún no responde)'}: ${publicUrl}`);
    } else {
      console.warn(`[EditorWeb] ${deploy.message}`);
    }
    // Se guarda igual: al publicar en redes se vuelve a comprobar que responda
    return publicUrl;
  } catch (err: any) {
    console.error('[EditorWeb] Error al publicar el artículo:', err?.message);
    return undefined;
  }
}
