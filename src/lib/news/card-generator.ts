import fs from 'fs';
import path from 'path';
import { chromium, Browser } from 'playwright';
import { ProcessedNews, NewsConfig } from '@/types/news';

let sharedBrowser: Browser | null = null;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return sharedBrowser;
}

/**
 * Genera una tarjeta de noticias limpia, elegante y profesional.
 * Sin sellos invasivos de 'última hora' ni marcas genéricas.
 * La foto queda 100% visible arriba y el texto editorial abajo.
 */
export async function generateNewsCardImage(
  news: ProcessedNews,
  config?: Partial<NewsConfig>
): Promise<string> {
  const outputDir = path.join(process.cwd(), 'public', 'news-cards');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `news-${news.id}-${Date.now()}.jpg`;
  const outputPath = path.join(outputDir, fileName);

  // Todo texto que viene de la IA o de los feeds se escapa antes de entrar al HTML
  const categoryName = escapeHtml((news.category || 'actualidad').toUpperCase());
  const rawHeadline = escapeHtml(news.headline || 'NOTICIA');
  const subHeadline = escapeHtml(news.subHeadline || '');
  const sourceName = escapeHtml((news.sourceName || '').toUpperCase());
  const currentDate = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();

  // Si la foto remota no carga, se oculta y queda el degradado de respaldo
  const photoUrl = news.rawImageUrl ? news.rawImageUrl.replace(/&amp;/g, '&') : '';
  const photoHtml = photoUrl && /^https?:\/\//.test(photoUrl)
    ? `<div class="photo-placeholder" style="position:absolute;inset:0"></div><img src="${escapeHtml(photoUrl)}" class="photo-img" style="position:relative" referrerpolicy="no-referrer" onerror="this.remove()" />`
    : `<div class="photo-placeholder"></div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 630px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #050811;
      display: flex;
      flex-direction: column;
    }
    .photo-container {
      width: 1200px;
      height: 375px;
      position: relative;
      overflow: hidden;
      background-color: #050811;
    }
    .photo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 25%;
      filter: contrast(1.05) saturate(1.1);
    }
    .photo-placeholder {
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at center, #1e293b 0%, #050811 100%);
    }
    .photo-vignette {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.2) 0%,
        transparent 40%,
        rgba(5, 8, 17, 0.95) 100%
      );
    }

    /* SECCIÓN EDITORIAL INFERIOR */
    .editorial-section {
      width: 1200px;
      height: 255px;
      background-color: #050811;
      border-top: 3px solid #dc2626;
      padding: 20px 50px 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      z-index: 20;
    }
    .category-line {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.16em;
      color: #f43f5e;
      text-transform: uppercase;
    }
    .category-bullet {
      width: 20px;
      height: 3px;
      background-color: #f43f5e;
    }
    .headline {
      color: #ffffff;
      font-size: 38px;
      font-weight: 900;
      line-height: 1.15;
      letter-spacing: -0.01em;
      text-transform: uppercase;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .subheadline {
      color: #cbd5e1;
      font-size: 19px;
      font-weight: 500;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      padding-top: 12px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #94a3b8;
    }
    .footer-left {
      color: #cbd5e1;
    }
    .footer-right {
      color: #64748b;
    }
  </style>
</head>
<body>
  <!-- FOTOGRAFÍA SUPERIOR 100% LIMPIA -->
  <div class="photo-container">
    ${photoHtml}
    <div class="photo-vignette"></div>
  </div>

  <!-- SECCIÓN EDITORIAL INFERIOR -->
  <div class="editorial-section">
    <div class="category-line">
      <div class="category-bullet"></div>
      <span>${categoryName}</span>
    </div>

    <h1 class="headline">${rawHeadline}</h1>
    <p class="subheadline">${subHeadline}</p>

    <div class="footer">
      <div class="footer-left">FUENTE: ${sourceName}</div>
      <div class="footer-right">${currentDate}</div>
    </div>
  </div>
</body>
</html>`;

  await renderHtmlToJpeg(html, outputPath, 1200, 630);
  return `/news-cards/${fileName}`;
}

export async function renderHtmlToJpeg(html: string, outputPath: string, width: number, height: number) {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  try {
    try {
      await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
    } catch {
      // Foto lenta: se renderiza con lo que haya cargado (el degradado cubre el hueco)
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: outputPath, type: 'jpeg', quality: 92 });
  } finally {
    await page.close();
  }
}

export { escapeHtml };

/**
 * Tarjeta vertical 4:5 (1080×1350) para Instagram: ocupa más pantalla en el feed y no se recorta
 * en la cuadrícula del perfil. Foto grande arriba, titular grande abajo, marca arriba.
 */
export async function generateInstagramCardImage(news: ProcessedNews): Promise<string> {
  const outputDir = path.join(process.cwd(), 'public', 'news-cards');
  fs.mkdirSync(outputDir, { recursive: true });
  const fileName = `news-${news.id}-${Date.now()}-ig.jpg`;
  const outputPath = path.join(outputDir, fileName);

  const categoryName = escapeHtml((news.category || 'actualidad').toUpperCase());
  const headline = escapeHtml(news.headline || 'NOTICIA');
  const subHeadline = escapeHtml(news.subHeadline || '');
  const sourceName = escapeHtml((news.sourceName || '').toUpperCase());
  const currentDate = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  // Titulares largos bajan de tamaño para caber en 4 líneas
  const headlineSize = headline.length > 95 ? 54 : headline.length > 65 ? 62 : 70;

  const photoUrl = news.rawImageUrl ? news.rawImageUrl.replace(/&amp;/g, '&') : '';
  const photoHtml = photoUrl && /^https?:\/\//.test(photoUrl)
    ? `<div class="ph" style="position:absolute;inset:0"></div><img src="${escapeHtml(photoUrl)}" class="photo" referrerpolicy="no-referrer" onerror="this.remove()" />`
    : `<div class="ph"></div>`;

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 1080px; height: 1350px; overflow: hidden; background: #050811; display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  .brand { height: 92px; display: flex; align-items: center; justify-content: space-between; padding: 0 56px;
    border-bottom: 1px solid rgba(255,255,255,.08); }
  .logo { font-family: Georgia, "Times New Roman", serif; font-size: 40px; font-weight: 900; color: #fff; letter-spacing: .02em; }
  .logo b { color: #dc2626; }
  .date { color: #64748b; font-size: 22px; font-weight: 700; letter-spacing: .08em; }
  .photo-box { position: relative; height: 640px; overflow: hidden; background: #050811; }
  .photo { position: relative; width: 100%; height: 100%; object-fit: cover; object-position: center 30%; filter: contrast(1.05) saturate(1.1); }
  .ph { width: 100%; height: 100%; background: radial-gradient(circle at center, #1e293b 0%, #050811 100%); }
  .shade { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 55%, rgba(5,8,17,.95) 100%); }
  .text { flex: 1; border-top: 5px solid #dc2626; padding: 34px 56px 36px; display: flex; flex-direction: column; gap: 22px; }
  .cat { display: flex; align-items: center; gap: 14px; color: #f43f5e; font-size: 24px; font-weight: 900; letter-spacing: .16em; }
  .cat i { width: 34px; height: 4px; background: #f43f5e; display: block; }
  h1 { color: #fff; font-size: ${headlineSize}px; font-weight: 900; line-height: 1.08; letter-spacing: -.01em; text-transform: uppercase;
    display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  p { color: #cbd5e1; font-size: 28px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .foot { margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: 18px;
    border-top: 1px solid rgba(255,255,255,.12); color: #94a3b8; font-size: 21px; font-weight: 700; letter-spacing: .06em; }
  .foot span:last-child { color: #f43f5e; }
</style></head><body>
  <div class="brand"><div class="logo">PUNTO CIEGO<b>.</b></div><div class="date">${currentDate}</div></div>
  <div class="photo-box">${photoHtml}<div class="shade"></div></div>
  <div class="text">
    <div class="cat"><i></i><span>${categoryName}</span></div>
    <h1>${headline}</h1>
    <p>${subHeadline}</p>
    <div class="foot"><span>FUENTE: ${sourceName}</span><span>ANÁLISIS COMPLETO · LINK EN BIO</span></div>
  </div>
</body></html>`;

  await renderHtmlToJpeg(html, outputPath, 1080, 1350);
  return `/news-cards/${fileName}`;
}
