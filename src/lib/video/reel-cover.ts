import fs from 'fs';
import path from 'path';
import { ProcessedNews } from '@/types/news';
import { escapeHtml, renderHtmlToJpeg } from '@/lib/news/card-generator';
import { isGenericImageUrl } from '@/lib/news/news-images';
import { chooseReelStyle, ACCENTS } from './reel-infographic';

/**
 * Portada del Reel (la que se ve en la cuadrícula del perfil de Instagram): foto + titular grande, con la misma
 * identidad del video. Se genera al producir la noticia y se publica junto al artículo (img/<slug>-cover.jpg), porque
 * Instagram la descarga de una URL pública (cover_url).
 *
 * La cuadrícula recorta el centro en 3:4 (1080×1440): todo lo importante queda entre y=250 y y=1670.
 * Noticias graves → portada sobria (foto a sangre oscurecida, titular abajo); el resto → marco inclinado sobre fondo azul.
 */
export async function generateReelCover(news: ProcessedNews): Promise<string> {
  const outputDir = path.join(process.cwd(), 'public', 'news-cards');
  fs.mkdirSync(outputDir, { recursive: true });
  const fileName = `news-${news.id}-${Date.now()}-cover.jpg`;
  const outputPath = path.join(outputDir, fileName);

  const serious = chooseReelStyle(news) === 'serio';
  const accent = ACCENTS[String(news.category)] || '#ef4444';
  const headline = escapeHtml((news.headline || 'NOTICIA').toUpperCase());
  const category = escapeHtml(String(news.category || 'ACTUALIDAD').toUpperCase());
  const size = headline.length > 80 ? 68 : headline.length > 58 ? 78 : headline.length > 38 ? 90 : 102;
  const photoUrl = news.rawImageUrl ? news.rawImageUrl.replace(/&amp;/g, '&') : '';
  const photo = /^https?:\/\//.test(photoUrl) && !isGenericImageUrl(photoUrl) ? escapeHtml(photoUrl) : '';
  const img = (cls: string) => (photo ? `<img class="${cls}" src="${photo}" referrerpolicy="no-referrer" onerror="this.remove()">` : '');

  const base = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:1080px;height:1920px;overflow:hidden;color:#fff;font-family:Montserrat,"Segoe UI",Arial,sans-serif;position:relative;background:#050811}
    .logo{position:absolute;top:270px;left:70px;font-family:Georgia,"Times New Roman",serif;font-size:54px;font-weight:900;letter-spacing:.01em}
    .logo b{color:#ef4444}
    .tag{display:flex;align-items:center;gap:18px;font-size:40px;font-weight:900;letter-spacing:.12em}
    .tag i{display:block;width:14px;height:52px;background:var(--accent);border-radius:4px}
    h1{font-size:${size}px;line-height:1.05;font-weight:900;letter-spacing:-.01em;text-transform:uppercase;
       display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 6px 28px rgba(0,0,0,.6)}
    .bar{width:170px;height:12px;background:var(--accent);margin-top:34px;border-radius:6px}
    .foot{position:absolute;left:70px;right:70px;top:1640px;font-size:28px;font-weight:700;letter-spacing:.1em;color:rgba(255,255,255,.7)}`;

  const html = serious
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>:root{--accent:#dc2626}${base}
    .bg{position:absolute;inset:-80px;width:calc(100% + 160px);height:calc(100% + 160px);object-fit:cover;filter:blur(46px) saturate(1.1)}
    .dim{position:absolute;inset:0;background:rgba(5,8,17,.7)}
    .tag{position:absolute;left:70px;top:372px;color:#fff}
    .card{position:absolute;left:70px;right:70px;top:470px;height:610px;border-radius:28px;overflow:hidden;background:linear-gradient(135deg,#1e293b,#0f172a);box-shadow:0 30px 80px rgba(0,0,0,.6)}
    .card img{width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block}
    .txt{position:absolute;left:70px;right:70px;top:1150px}
    </style></head><body>${img('bg')}<div class="dim"></div>
    <div class="logo">PUNTO CIEGO<b>.</b></div>
    <div class="tag"><i></i>${category}</div>
    <div class="card">${img('')}</div>
    <div class="txt"><h1>${headline}</h1><div class="bar"></div></div>
    <div class="foot">ANÁLISIS COMPLETO · LINK EN EL PERFIL</div></body></html>`
    : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>:root{--accent:${accent}}${base}
    body{background:radial-gradient(ellipse at 50% 28%,#16264d 0%,#0a1330 55%,#050a1c 100%)}
    body:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.04) 0 110px,rgba(255,255,255,0) 110px 220px)}
    .tag{position:absolute;left:70px;top:372px}
    .frame{position:absolute;left:90px;right:90px;top:470px;height:610px;border:12px solid #fff;border-radius:8px;overflow:hidden;background:linear-gradient(135deg,#1e293b,#0f172a);
      transform:rotate(-2.2deg);box-shadow:0 34px 80px rgba(0,0,0,.55)}
    .frame img{width:100%;height:100%;object-fit:cover;display:block}
    .txt{position:absolute;left:70px;right:70px;top:1150px}
    </style></head><body>
    <div class="logo">PUNTO CIEGO<b>.</b></div>
    <div class="tag"><i></i>${category}</div>
    <div class="frame">${img('')}</div>
    <div class="txt"><h1>${headline}</h1><div class="bar"></div></div>
    <div class="foot">ANÁLISIS COMPLETO · LINK EN EL PERFIL</div></body></html>`;

  await renderHtmlToJpeg(html, outputPath, 1080, 1920);
  return `/news-cards/${fileName}`;
}
