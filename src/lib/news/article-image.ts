import { chromium, Browser } from 'playwright';

let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return sharedBrowser;
}

/**
 * Decodifica entidades HTML en URLs sacadas de feeds/meta tags (p. ej. "&amp;" rompía las fotos)
 */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/gi, '/')
    .trim();
}

const resolvedUrlCache = new Map<string, string>();

/**
 * Resuelve un enlace de Google News al artículo del medio original
 * (la redirección es por JavaScript, por eso se usa Playwright). Devuelve '' si no se pudo.
 */
export async function resolveGoogleNewsUrl(url: string): Promise<string> {
  if (!url.includes('news.google.com')) return url;
  const cached = resolvedUrlCache.get(url);
  if (cached !== undefined) return cached;

  let resolved = '';
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForURL((u) => !u.hostname.includes('news.google.com'), { timeout: 8000 }).catch(() => {});
      const finalUrl = page.url();
      if (finalUrl && !finalUrl.includes('news.google.com')) resolved = finalUrl;
    } finally {
      await page.close();
    }
  } catch (err: any) {
    console.warn('[ArticleImage] No se pudo resolver enlace de Google News:', err?.message);
  }

  resolvedUrlCache.set(url, resolved);
  if (resolvedUrlCache.size > 300) resolvedUrlCache.delete(resolvedUrlCache.keys().next().value as string);
  return resolved;
}

/**
 * Verifica si una imagen es una fotografía editorial real
 * y descarta logotipos genéricos (como el logo de Google News o íconos).
 */
/** Ilustraciones por defecto, logos y recursos de marca que algunos portales ponen como "foto" de cualquier noticia */
export const GENERIC_IMAGE_URL = new RegExp(
  'news-story|tradingview\.com/static|placeholder|no-?image|image-?not-?found|default[-_]?(image|thumb|share|og)|og[-_]?default|share[-_]?default|' +
    'social[-_]?(share|card)|sprite|/logos?/|logo[-_.]|[-_.]logo|avatar|blank\.|fallback|generic|brand[-_]?image',
  'i'
);

export function isValidEditorialPhoto(url?: string): boolean {
  if (!url) return false;
  const s = url.toLowerCase();
  if (GENERIC_IMAGE_URL.test(s)) return false;
  if (s.includes('googleusercontent.com')) return false;
  if (s.includes('google.com/logos')) return false;
  if (s.includes('favicon')) return false;
  if (s.includes('icon-') || s.includes('logo-') || s.includes('default_avatar')) return false;
  return true;
}

/**
 * Busca una fotografía periodística real de alta resolución en la web
 * para el tema específico de la noticia.
 */
export async function searchRealNewsPhoto(query: string): Promise<string | undefined> {
  try {
    // Limpiar el query para que sea una búsqueda periodística concisa
    const cleanQuery = query
      .replace(/[.,:;¿?¡!]/g, '')
      .split(' - ')[0]
      .split(/\s+/)
      .slice(0, 6)
      .join(' ');

    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&iax=images&ia=images`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const tokenHtml = await tokenRes.text();
    const vqdMatch = tokenHtml.match(/vqd=([0-9-]+)&/);
    if (!vqdMatch) return undefined;

    const vqd = vqdMatch[1];
    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(cleanQuery)}&vqd=${vqd}&f=,,,&p=1`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );
    const imgData = await imgRes.json();
    if (imgData.results && imgData.results.length > 0) {
      // Filtrar la primera imagen que sea jpg/png/webp válida y no sea un logo
      for (const item of imgData.results) {
        if (isValidEditorialPhoto(item.image) && (item.image.startsWith('http://') || item.image.startsWith('https://'))) {
          return item.image;
        }
      }
    }
  } catch (err: any) {
    console.warn('Error en búsqueda de foto de prensa:', err?.message);
  }
  return undefined;
}

/**
 * Extrae la fotografía real de la noticia.
 * Si es un enlace de Google News, resuelve la redirección hacia el medio real (Univision, BBC, El País, etc.)
 * y si no encuentra foto, busca una foto periodística de archivo en alta resolución.
 */
export async function extractArticleImage(url: string, newsTitle?: string): Promise<string | undefined> {
  let realUrl = url;

  // 1. Si es un link de Google News, resolver la redirección al medio original con Playwright
  if (url.includes('news.google.com')) {
    try {
      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await page.waitForTimeout(1800); // Dar 1.8s para completar la redirección
        const resolvedUrl = page.url();
        if (resolvedUrl && !resolvedUrl.includes('news.google.com')) {
          realUrl = resolvedUrl;
        }

        // Intentar leer la meta-imagen directamente desde la página renderizada
        const ogImage = await page.evaluate(() => {
          const el = document.querySelector('meta[property="og:image"]') 
            || document.querySelector('meta[name="twitter:image"]')
            || document.querySelector('meta[content*=".jpg"]');
          return el ? el.getAttribute('content') : null;
        });

        if (isValidEditorialPhoto(ogImage || undefined)) {
          return decodeHtmlEntities(ogImage as string);
        }
      } finally {
        await page.close();
      }
    } catch (err: any) {
      console.warn('No se pudo resolver redirección de Google News:', err?.message);
    }
  }

  // 2. Si no es de Google News o no se obtuvo con Playwright, hacer fetch directo al HTML
  if (realUrl && !realUrl.includes('news.google.com')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(realUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();
        const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) 
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
          || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);

        if (ogMatch && isValidEditorialPhoto(ogMatch[1])) {
          return decodeHtmlEntities(ogMatch[1]);
        }
      }
    } catch {
      // Ignorar error y pasar al buscador de fotos de prensa
    }
  }

  // 3. Si la noticia no trajo foto real o era un logo genérico, buscar foto de prensa del suceso
  if (newsTitle) {
    const photo = await searchRealNewsPhoto(newsTitle);
    if (photo) return photo;
  }

  return undefined;
}
