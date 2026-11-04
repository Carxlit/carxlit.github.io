import { NewsArticle, NewsVideo } from '@/types/news';
import { SiteConfig, needsConsent } from './site-config';
import { SITE_CATEGORIES, categoryLabel, categoryPath } from './categories';

export interface SiteEntry {
  slug: string;
  path: string; // relativo a la raíz del sitio, p. ej. "noticias/<slug>/"
  title: string;
  headline: string;
  dek: string;
  category: string;
  sourceName: string;
  image?: string; // tarjeta de redes (con titular), relativa a la raíz: "img/<slug>.jpg"
  photo?: string; // foto limpia 16:9 sin textos: "img/<slug>-foto.jpg" (portada y artículo)
  video?: NewsVideo; // video real del hecho (YouTube)
  reelUrl?: string; // Reel publicado en Instagram
  publishedAt: string;
  article: NewsArticle;
  blindSpot?: string;
}

export const SITE_NAME = 'Punto Ciego';
const TAGLINE = 'Lo que la cobertura dominante no te cuenta';
const DEFAULT_DESCRIPTION = 'Análisis independiente de geopolítica, economía global, seguridad, tecnología y poder.';

export function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
}

function readingMinutes(words: number): number {
  return Math.max(2, Math.round(words / 220));
}

const abs = (baseUrl: string, rel?: string) => (baseUrl && rel !== undefined ? `${baseUrl}/${rel}` : undefined);

/** Imagen para mostrar en el sitio: la foto limpia si existe; si no, la tarjeta */
const pic = (e: SiteEntry) => e.photo || e.image;

/** Fecha que el navegador convierte en "hace 2 h" (la página es estática) */
const timeTag = (iso: string) => `<time datetime="${esc(iso)}" data-rel>${formatDateTime(iso)}</time>`;

const STYLES = `
:root{--bg:#fff;--ink:#111418;--muted:#5f6670;--rule:#e4e6ea;--soft:#f3f4f6;--accent:#d0021b;--accent2:#a10015;--top:#0c0e11;--card:#fff;--shadow:0 1px 2px rgba(0,0,0,.06),0 8px 24px rgba(0,0,0,.06)}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--ink:#eceef1;--muted:#9ba2ac;--rule:#252a31;--soft:#171a20;--accent:#ff3347;--accent2:#d0021b;--top:#000;--card:#151820;--shadow:0 1px 2px rgba(0,0,0,.4)}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-x:hidden}
a{color:inherit;text-decoration:none}img{max-width:100%;display:block}
.wrap{max-width:1200px;margin:0 auto;padding:0 16px}
/* Barra superior con fecha y "Último minuto" */
.topbar{background:var(--top);color:#cfd3d9;font-size:12.5px}
.topbar .wrap{display:flex;align-items:center;gap:16px;height:36px;overflow:hidden}
.today{white-space:nowrap;text-transform:capitalize;flex:none}
.ticker{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
.ticker b{background:var(--accent);color:#fff;font-size:11px;font-weight:800;letter-spacing:.08em;padding:4px 8px;border-radius:3px;white-space:nowrap;flex:none}
.ticker b::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:#fff;margin-right:6px;vertical-align:1px;animation:blink 1.4s infinite}
@keyframes blink{50%{opacity:.25}}
.tk{overflow:hidden;min-width:0;flex:1;mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}
.tk-in{display:inline-flex;gap:36px;white-space:nowrap;animation:tk 60s linear infinite;padding-left:100%}
.tk-in a:hover{color:#fff;text-decoration:underline}
@keyframes tk{to{transform:translateX(-100%)}}
.tk:hover .tk-in{animation-play-state:paused}
/* Cabecera */
.mast{border-bottom:1px solid var(--rule);background:var(--bg)}
.mast .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:18px;padding-bottom:16px}
.logo{font:900 clamp(30px,5vw,46px)/1 "Playfair Display",Georgia,serif;letter-spacing:-.01em;text-transform:uppercase;white-space:nowrap}
.logo span{color:var(--accent)}
.mast .tag{font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);text-align:right;max-width:280px}
.navbar{background:var(--accent);position:sticky;top:0;z-index:40;box-shadow:0 2px 10px rgba(0,0,0,.12)}
.navbar .wrap{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none}
.navbar .wrap::-webkit-scrollbar{display:none}
.navbar a{color:#fff;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:13px 14px;white-space:nowrap;border-bottom:3px solid transparent}
.navbar a:hover,.navbar a.on{background:var(--accent2);border-bottom-color:#fff}
/* Piezas comunes */
.kicker{display:inline-block;font-size:11.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}
.meta{font-size:13px;color:var(--muted)}
.meta time{white-space:nowrap}
.thumb{position:relative;display:block;overflow:hidden;border-radius:6px;background:var(--soft);aspect-ratio:16/9}
.thumb img{width:100%;height:100%;object-fit:cover;transition:transform .5s ease}
a:hover .thumb img,.thumb:hover img{transform:scale(1.04)}
.badge-video{position:absolute;left:10px;bottom:10px;background:rgba(0,0,0,.75);color:#fff;font-size:11px;font-weight:800;letter-spacing:.06em;padding:5px 9px 5px 7px;border-radius:4px;display:flex;align-items:center;gap:6px}
.badge-video::before{content:"";border-left:9px solid #fff;border-top:6px solid transparent;border-bottom:6px solid transparent}
.sec-title{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:2px solid var(--ink);margin:36px 0 18px;padding-bottom:8px}
.sec-title h2{margin:0;font-size:20px;font-weight:900;letter-spacing:-.01em;display:flex;align-items:center;gap:10px}
.sec-title h2::before{content:"";width:6px;height:22px;background:var(--accent);border-radius:2px}
.sec-title a{font-size:13px;font-weight:700;color:var(--accent)}
.sec-title a:hover{text-decoration:underline}
.crumbs{font-size:13px;color:var(--muted);margin-bottom:12px}.crumbs a:hover{text-decoration:underline}
/* Portada: principal + destacadas */
.top{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(0,1fr);gap:24px;padding:24px 0 6px}
.hero{position:relative;display:block;border-radius:8px;overflow:hidden;background:#111;min-height:440px;color:#fff}
.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .6s ease}
.hero:hover img{transform:scale(1.03)}
.hero .shade{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.92) 0%,rgba(0,0,0,.55) 38%,rgba(0,0,0,0) 70%)}
.hero .txt{position:absolute;left:0;right:0;bottom:0;padding:28px}
.hero .kicker{background:var(--accent);color:#fff;padding:5px 9px;border-radius:3px}
.hero h2{font-size:clamp(26px,3.4vw,40px);line-height:1.12;font-weight:900;letter-spacing:-.02em;margin:12px 0 10px;text-shadow:0 2px 12px rgba(0,0,0,.4)}
.hero p{margin:0;color:#e6e8eb;font-size:16px;max-width:680px}
.hero .meta{color:#c9ced5;margin-top:10px}
.side-top{display:flex;flex-direction:column;gap:18px}
.side-top .card h3{font-size:18px}
/* Tarjetas */
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}
.grid.g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.card{min-width:0;display:flex;flex-direction:column;gap:8px}
.card h3{margin:0;font-size:17px;line-height:1.28;font-weight:800;letter-spacing:-.01em}
.card h3 a:hover{color:var(--accent)}
.card p{margin:0;color:var(--muted);font-size:14.5px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card .thumb{margin-bottom:4px}
.grid .ad{grid-column:1/-1}
/* Lo último (lista) + barra lateral */
.cols{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:40px}
.feed{display:flex;flex-direction:column}
.row{display:grid;grid-template-columns:240px minmax(0,1fr);gap:20px;padding:18px 0;border-bottom:1px solid var(--rule)}
.row:first-child{padding-top:0}
.row h3{margin:6px 0;font-size:21px;line-height:1.22;font-weight:800;letter-spacing:-.015em}
.row h3 a:hover{color:var(--accent)}
.row p{margin:0 0 8px;color:var(--muted);font-size:15px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.box{background:var(--soft);border-radius:8px;padding:18px;margin-bottom:24px}
.box h2{margin:0 0 12px;font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;display:flex;align-items:center;gap:8px}
.box h2::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--accent)}
.box ol{list-style:none;margin:0;padding:0;counter-reset:n}
.box li{counter-increment:n;display:grid;grid-template-columns:34px 1fr;gap:6px;padding:11px 0;border-top:1px solid var(--rule);font-size:15px;font-weight:700;line-height:1.32}
.box li:first-child{border-top:0;padding-top:2px}
.box li::before{content:counter(n);font-size:24px;font-weight:900;color:var(--accent);line-height:1}
.box li a:hover{color:var(--accent)}
.box li .meta{display:block;font-weight:500;font-size:12px;margin-top:4px}
.mini{display:grid;grid-template-columns:96px 1fr;gap:12px;padding:11px 0;border-top:1px solid var(--rule);align-items:start}
.mini:first-of-type{border-top:0;padding-top:2px}
.mini .thumb{border-radius:4px}
.mini h3{margin:0;font-size:14.5px;line-height:1.3;font-weight:700}
.mini:hover h3{color:var(--accent)}
.sticky{position:sticky;top:64px}
.section-head{padding:24px 0 0}
.section-head h1{font-size:clamp(30px,4.5vw,44px);line-height:1.08;font-weight:900;letter-spacing:-.02em;margin:4px 0 6px;display:flex;align-items:center;gap:12px}
.section-head h1::before{content:"";width:8px;height:36px;background:var(--accent);border-radius:2px}
/* Artículo */
.layout{display:grid;grid-template-columns:minmax(0,760px) 320px;gap:48px;justify-content:center}
article.story{padding:26px 0 50px;min-width:0}
.story .kicker{background:var(--accent);color:#fff;padding:5px 9px;border-radius:3px}
.story h1{font-size:clamp(30px,4.6vw,46px);line-height:1.1;font-weight:900;letter-spacing:-.025em;margin:14px 0 12px}
.dek{font:400 21px/1.5 "Source Serif 4",Georgia,serif;color:var(--muted);margin:0 0 18px}
.byline{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.avatar{width:40px;height:40px;border-radius:50%;background:var(--ink);color:var(--bg);display:grid;place-items:center;font:900 15px/1 "Playfair Display",Georgia,serif;flex:none}
.avatar i{color:var(--accent);font-style:normal}
.byline strong{display:block;font-size:14px}
.media{margin:22px 0 6px}
.media figure{margin:0}
.media img{width:100%;height:auto;border-radius:6px}
figcaption{font-size:13px;color:var(--muted);margin-top:8px;padding-left:10px;border-left:3px solid var(--accent)}
.yt{position:relative;aspect-ratio:16/9;border-radius:8px;overflow:hidden;background:#000;cursor:pointer}
.yt img{width:100%;height:100%;object-fit:cover;opacity:.88;transition:opacity .2s}
.yt:hover img{opacity:1}
.yt iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.play{position:absolute;left:50%;top:50%;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:var(--accent);box-shadow:0 8px 30px rgba(0,0,0,.45);border:0;cursor:pointer}
.play::after{content:"";position:absolute;left:34px;top:26px;border-left:24px solid #fff;border-top:16px solid transparent;border-bottom:16px solid transparent}
.yt .lbl{position:absolute;left:14px;top:14px;background:rgba(0,0,0,.72);color:#fff;font-size:12px;font-weight:800;letter-spacing:.08em;padding:6px 10px;border-radius:4px}
.body{font:400 19px/1.75 "Source Serif 4",Georgia,serif}
.body p{margin:0 0 1.15em}
.body h2{font:800 25px/1.25 Inter,system-ui,sans-serif;letter-spacing:-.015em;margin:38px 0 12px}
.facts{background:var(--soft);border-radius:8px;padding:18px 22px;margin:26px 0;border-left:5px solid var(--accent)}
.facts h2{font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin:0 0 10px}
.facts ul{margin:0;padding-left:20px}.facts li{margin:6px 0;font-size:16px;line-height:1.5}
.facts li::marker{color:var(--accent)}
.blind{background:var(--ink);color:var(--bg);border-radius:8px;padding:22px 24px;margin:32px 0;font:italic 400 20px/1.6 "Source Serif 4",Georgia,serif}
.blind strong{font:800 12px/1 Inter,system-ui,sans-serif;font-style:normal;color:var(--accent);letter-spacing:.16em;text-transform:uppercase;display:block;margin-bottom:10px}
.reel{display:grid;grid-template-columns:auto 1fr;gap:22px;align-items:center;background:var(--soft);border-radius:10px;padding:18px;margin:34px 0}
.reel .ph{width:150px;aspect-ratio:9/16;border-radius:10px;background:linear-gradient(160deg,#1e293b,#000);position:relative;overflow:hidden;cursor:pointer;color:#fff;display:grid;place-items:center;text-align:center;font:900 15px/1.2 "Playfair Display",Georgia,serif}
.reel .ph span{color:var(--accent)}
.reel .ph .play{width:56px;height:56px;margin:-28px 0 0 -28px;top:62%}
.reel .ph .play::after{left:22px;top:17px;border-left-width:16px;border-top-width:11px;border-bottom-width:11px}
.reel iframe{width:100%;max-width:400px;height:720px;border:0;border-radius:10px;background:#fff}
.reel h2{margin:0 0 6px;font-size:19px;font-weight:900}
.reel p{margin:0 0 12px;color:var(--muted);font-size:15px}
.reel.open{grid-template-columns:1fr;justify-items:center}
.btn{display:inline-block;background:var(--accent);color:#fff;font-size:14px;font-weight:800;padding:11px 16px;border-radius:6px;border:0;cursor:pointer}
.btn:hover{background:var(--accent2)}
.sources{border-top:1px solid var(--rule);margin-top:36px;padding-top:16px;font-size:14.5px;line-height:1.6;overflow-wrap:anywhere}
.sources h2{font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin:0 0 8px}
.sources a{color:var(--accent);font-weight:600}.sources a:hover{text-decoration:underline}
.tags{margin-top:18px}.tags span{display:inline-block;font-size:12px;font-weight:600;background:var(--soft);padding:7px 11px;margin:0 6px 6px 0;border-radius:999px}
.share{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:26px 0 0}
.share span{font-size:13px;font-weight:700;color:var(--muted);margin-right:4px}
.share a,.share button{font:700 13px/1 Inter,system-ui,sans-serif;border:0;color:#fff;padding:10px 14px;cursor:pointer;border-radius:999px;background:#334155}
.share a.fb{background:#1877f2}.share a.wa{background:#25d366}.share a.tg{background:#229ed9}.share a.x{background:#000}.share a.bs{background:#0085ff}
.share a:hover,.share button:hover{filter:brightness(1.1)}
.follow{display:flex;align-items:center;gap:14px;margin:22px 0 0;padding:16px 18px;border-radius:10px;background:#229ed9;color:#fff}
.follow b{font-size:26px;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;flex:none}
.follow span{flex:1;font-size:14px;line-height:1.4}.follow strong{display:block;font-size:16px}
.follow em{font-style:normal;font-weight:800;background:#fff;color:#229ed9;padding:9px 14px;border-radius:999px;white-space:nowrap}
.follow:hover{filter:brightness(1.05)}
.next{display:grid;grid-template-columns:200px 1fr;gap:18px;align-items:center;margin:38px 0 0;padding:16px;border:1px solid var(--rule);border-radius:10px;background:var(--card);box-shadow:var(--shadow)}
.next .lbl{font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
.next h3{margin:6px 0 0;font-size:20px;line-height:1.25;font-weight:800}
.next:hover h3{color:var(--accent)}
.donate{display:block;text-align:center;margin:30px 0 0;padding:20px;background:var(--soft);border-radius:8px;font-size:15px;font-weight:600}
.donate a{display:inline-block;margin-top:10px;background:var(--accent);color:#fff;padding:11px 18px;border-radius:6px}
.related{margin-top:30px}
.pager{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;padding:30px 0 50px;font-size:14px;font-weight:700}
.pager a,.pager span{border:1px solid var(--rule);padding:10px 14px;border-radius:6px}
.pager a:hover{border-color:var(--accent);color:var(--accent)}
.pager span.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.page{max-width:760px;margin:0 auto;padding:30px 0 50px}
.page h1{font-size:clamp(30px,5vw,42px);line-height:1.1;font-weight:900;letter-spacing:-.02em;margin:0 0 16px}
.page h2{font-size:22px;font-weight:800;margin:30px 0 8px}
.page p,.page li{font:400 18px/1.7 "Source Serif 4",Georgia,serif}
.page .updated{font-size:13px;color:var(--muted)}
.page button{font:700 14px/1 Inter,system-ui,sans-serif;padding:10px 16px;border:1px solid var(--ink);background:transparent;color:var(--ink);cursor:pointer;border-radius:6px}
.ad{margin:28px 0;text-align:center;overflow:hidden}.ad:not(.on){display:none}
.ad::before{content:"Publicidad";display:block;font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
footer{background:var(--top);color:#9ba2ac;margin-top:40px;padding:36px 0 40px;font-size:13.5px;line-height:1.7}
footer .logo{color:#fff;font-size:32px}
footer .cols3{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:30px;margin-bottom:24px}
footer h4{color:#fff;font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin:4px 0 10px}
footer nav{display:flex;flex-direction:column;gap:4px}
footer nav a{color:#d6d9de}footer nav a:hover{color:#fff;text-decoration:underline}
footer .legal{border-top:1px solid #23272e;padding-top:18px;font-size:12.5px}
.consent{position:fixed;left:12px;right:12px;bottom:12px;z-index:50;max-width:760px;margin:0 auto;background:var(--card);color:var(--ink);border:1px solid var(--rule);border-top:3px solid var(--accent);box-shadow:0 8px 30px rgba(0,0,0,.18);padding:16px 18px;font-size:14px;line-height:1.5;display:none;border-radius:8px}
.consent.show{display:block}
.consent .btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.consent button{font:700 13px/1 Inter,system-ui,sans-serif;padding:10px 16px;cursor:pointer;border:1px solid var(--ink);background:transparent;color:var(--ink);border-radius:6px}
.consent button.yes{background:var(--accent);border-color:var(--accent);color:#fff}
.consent a{color:var(--accent)}
.notfound{text-align:center;padding:70px 0}.notfound h1{font:900 72px/1 "Playfair Display",Georgia,serif;margin:0;color:var(--accent)}
@media (max-width:1040px){.layout,.cols{grid-template-columns:minmax(0,1fr)}.layout>aside,.cols>aside{display:none}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:860px){.top{grid-template-columns:minmax(0,1fr)}.side-top{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.grid.g3{grid-template-columns:repeat(2,minmax(0,1fr))}.mast .tag{display:none}footer .cols3{grid-template-columns:1fr 1fr}}
@media (max-width:600px){.hero{min-height:360px}.hero .txt{padding:18px}.hero p{display:none}.side-top,.grid,.grid.g3{grid-template-columns:minmax(0,1fr)}
  .row{grid-template-columns:120px minmax(0,1fr);gap:12px}.row h3{font-size:17px}.row p{display:none}
  .today{display:none}.mast .wrap{justify-content:center;padding-top:14px;padding-bottom:12px}.body{font-size:18px}.dek{font-size:18px}
  .next{grid-template-columns:110px 1fr}.next h3{font-size:16px}.reel{grid-template-columns:1fr;justify-items:center;text-align:center}footer .cols3{grid-template-columns:1fr}}
`;

/** "hace 5 min / hace 3 h / ayer" en el navegador del lector */
const RELATIVE_TIME_SCRIPT = `<script>(function(){var n=Date.now();document.querySelectorAll('time[data-rel]').forEach(function(t){var d=(n-new Date(t.getAttribute('datetime')).getTime())/6e4;if(isNaN(d)||d<0)return;t.textContent=d<1?'Ahora':d<60?'Hace '+Math.round(d)+' min':d<1440?'Hace '+Math.round(d/60)+' h':d<2880?'Ayer':t.textContent})})();</script>`;

interface PageOpts {
  root: string;
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  type: string;
  jsonLd?: object[];
  body: string;
  config: SiteConfig;
  small?: boolean;
  activeCategory?: string;
  noindex?: boolean;
  /** Últimos titulares para la barra "Último minuto" */
  ticker?: SiteEntry[];
}

function layout(o: PageOpts): string {
  const consent = needsConsent(o.config);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
${o.noindex ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
${o.canonical ? `<link rel="canonical" href="${esc(o.canonical)}">` : ''}
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="es_ES">
<meta property="og:type" content="${o.type}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
${o.canonical ? `<meta property="og:url" content="${esc(o.canonical)}">` : ''}
${o.image ? `<meta property="og:image" content="${esc(o.image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#d0021b">
${o.config.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(o.config.googleSiteVerification)}">` : ''}
${o.config.bingSiteVerification ? `<meta name="msvalidate.01" content="${esc(o.config.bingSiteVerification)}">` : ''}
<link rel="icon" href="${o.root}favicon.svg" type="image/svg+xml">
<link rel="manifest" href="${o.root}site.webmanifest">
<link rel="alternate" type="application/rss+xml" title="${SITE_NAME}" href="${o.root}rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@900&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>${STYLES}</style>
${(o.jsonLd || []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
${masthead(o.root, o.activeCategory, o.ticker)}
${o.body}
${footer(o.root, o.config)}
${consent ? consentBlock(o.root, o.config) : ''}
${RELATIVE_TIME_SCRIPT}
</body>
</html>`;
}

function masthead(root: string, active?: string, ticker: SiteEntry[] = []) {
  const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
  const nav = [
    `<a href="${root}"${!active ? ' class="on"' : ''}>Portada</a>`,
    ...SITE_CATEGORIES.map(
      (c) => `<a href="${root}${categoryPath(c)}"${active === c ? ' class="on" aria-current="page"' : ''}>${esc(categoryLabel(c))}</a>`
    ),
  ].join('');
  const items = ticker.slice(0, 6).map((e) => `<a href="${root}${esc(e.path)}">${esc(e.title)}</a>`).join('');
  return `<div class="topbar"><div class="wrap"><span class="today">${esc(today)}</span>${
    items ? `<div class="ticker"><b>ÚLTIMO MINUTO</b><div class="tk"><div class="tk-in">${items}</div></div></div>` : ''
  }</div></div>
<header class="mast"><div class="wrap"><a class="logo" href="${root}">Punto <span>Ciego</span></a><div class="tag">${TAGLINE}</div></div></header>
<nav class="navbar" aria-label="Secciones"><div class="wrap">${nav}</div></nav>`;
}

function footer(root: string, config: SiteConfig) {
  const social = config.socialLinks || {};
  const socialLinks = (
    [
      ['Facebook', social.facebook],
      ['Instagram', social.instagram],
      ['Telegram', social.telegram],
      ['Bluesky', social.bluesky],
      ['Mastodon', social.mastodon],
      ['LinkedIn', social.linkedin],
      ['X', social.x],
    ] as const
  )
    .filter(([, url]) => url)
    // rel="me": Mastodon marca el enlace del perfil como verificado
    .map(([name, url]) => `<a href="${esc(url)}" rel="${name === 'Mastodon' ? 'me noopener' : 'noopener'}" target="_blank">${name}</a>`)
    .join('');
  const sections = SITE_CATEGORIES.map((c) => `<a href="${root}${categoryPath(c)}">${esc(categoryLabel(c))}</a>`).join('');
  return `<footer><div class="wrap">
<div class="cols3">
<div><div class="logo">Punto <span>Ciego</span></div><p>${esc(config.siteDescription || DEFAULT_DESCRIPTION)}</p></div>
<div><h4>Secciones</h4><nav aria-label="Secciones">${sections}</nav></div>
<div><h4>Información</h4><nav aria-label="Información"><a href="${root}quienes-somos/">Quiénes somos</a><a href="${root}contacto/">Contacto</a><a href="${root}aviso-legal/">Aviso legal</a><a href="${root}privacidad/">Privacidad</a><a href="${root}cookies/">Cookies</a><a href="${root}rss.xml">RSS</a>${
    config.donationUrl ? `<a href="${esc(config.donationUrl)}" rel="noopener" target="_blank">Apóyanos</a>` : ''
  }</nav>${socialLinks ? `<h4 style="margin-top:18px">Síguenos</h4><nav aria-label="Redes">${socialLinks}</nav>` : ''}</div>
</div>
<div class="legal">© ${new Date().getFullYear()} ${SITE_NAME}. Piezas elaboradas con asistencia de inteligencia artificial a partir de las fuentes citadas en cada artículo.</div>
</div></footer>`;
}

/** Hueco publicitario: el código queda inerte en <template> y solo se activa tras aceptar cookies */
function adSlot(html: string | undefined, name: string): string {
  if (!html) return '';
  return `<div class="ad ad-${name}" data-ad><template>${html}</template></div>`;
}

function consentBlock(root: string, config: SiteConfig) {
  const headScripts = `${config.adHeadHtml || ''}${config.analyticsHtml || ''}`;
  return `<template id="pc-head">${headScripts}</template>
<div class="consent" id="pc-consent" role="dialog" aria-label="Preferencias de cookies">
<strong>Tu privacidad</strong><br>
Usamos cookies de terceros para mostrar publicidad y medir audiencia, lo que nos permite mantener ${SITE_NAME} gratis. Solo se activan si aceptas. <a href="${root}cookies/">Más información</a>.
<div class="btns"><button class="yes" type="button" data-c="yes">Aceptar</button><button type="button" data-c="no">Rechazar</button></div>
</div>
<script>
(function(){
var K='pc-consent-v1';
function get(){try{return localStorage.getItem(K)}catch(e){return null}}
function set(v){try{localStorage.setItem(K,v)}catch(e){}}
function mount(tpl,parent,before){
  var f=tpl.content.cloneNode(true);
  Array.prototype.forEach.call(f.querySelectorAll('script'),function(o){
    var n=document.createElement('script');
    for(var i=0;i<o.attributes.length;i++){n.setAttribute(o.attributes[i].name,o.attributes[i].value)}
    n.text=o.text;o.parentNode.replaceChild(n,o);
  });
  parent.insertBefore(f,before||null);
}
function load(){
  var h=document.getElementById('pc-head');if(h){mount(h,document.head)}
  Array.prototype.forEach.call(document.querySelectorAll('[data-ad]'),function(el){
    var t=el.querySelector('template');if(t){mount(t,el,t);el.classList.add('on')}
  });
}
var box=document.getElementById('pc-consent');
var c=get();
if(c==='yes'){load()}else if(c!=='no'&&box){box.classList.add('show')}
if(box){box.addEventListener('click',function(e){
  var v=e.target&&e.target.getAttribute&&e.target.getAttribute('data-c');if(!v)return;
  set(v);box.classList.remove('show');if(v==='yes')load();
})}
})();
</script>`;
}

function thumb(root: string, e: SiteEntry, lazy = true) {
  const img = pic(e);
  return `<a class="thumb" href="${root}${esc(e.path)}" tabindex="-1" aria-hidden="true">${
    img ? `<img src="${root}${esc(img)}" alt="" ${lazy ? 'loading="lazy" ' : ''}width="1200" height="675">` : ''
  }${e.video ? '<span class="badge-video">VIDEO</span>' : ''}</a>`;
}

function card(root: string, e: SiteEntry, opts: { lazy?: boolean; dek?: boolean } = {}) {
  return `<article class="card">${thumb(root, e, opts.lazy !== false)}<a class="kicker" href="${root}${categoryPath(e.category)}">${esc(categoryLabel(e.category))}</a><h3><a href="${root}${esc(e.path)}">${esc(e.title)}</a></h3>${
    opts.dek ? `<p>${esc(e.dek)}</p>` : ''
  }<div class="meta">${timeTag(e.publishedAt)}</div></article>`;
}

function row(root: string, e: SiteEntry) {
  return `<article class="row">${thumb(root, e)}<div><a class="kicker" href="${root}${categoryPath(e.category)}">${esc(categoryLabel(e.category))}</a><h3><a href="${root}${esc(e.path)}">${esc(e.title)}</a></h3><p>${esc(e.dek)}</p><div class="meta">${timeTag(e.publishedAt)} · ${readingMinutes(e.article.wordCount)} min de lectura</div></div></article>`;
}

function heroBlock(root: string, e: SiteEntry) {
  const img = pic(e);
  return `<a class="hero" href="${root}${esc(e.path)}">${img ? `<img src="${root}${esc(img)}" alt="${esc(e.headline)}" width="1200" height="675" fetchpriority="high">` : ''}<div class="shade"></div>
<div class="txt"><span class="kicker">${esc(categoryLabel(e.category))}</span><h2>${esc(e.title)}</h2><p>${esc(e.dek)}</p><div class="meta">${timeTag(e.publishedAt)} · ${readingMinutes(e.article.wordCount)} min de lectura${e.video ? ' · ▶ Con video' : ''}</div></div></a>`;
}

function latestBox(root: string, entries: SiteEntry[], title = 'Lo último') {
  if (!entries.length) return '';
  return `<div class="box"><h2>${esc(title)}</h2>${entries
    .map((e) => `<a class="mini" href="${root}${esc(e.path)}">${thumb(root, e).replace(/^<a /, '<span ').replace(/<\/a>$/, '</span>')}<div><h3>${esc(e.title)}</h3><div class="meta">${timeTag(e.publishedAt)}</div></div></a>`)
    .join('')}</div>`;
}

function numberedBox(root: string, entries: SiteEntry[], title: string) {
  if (!entries.length) return '';
  return `<div class="box"><h2>${esc(title)}</h2><ol>${entries
    .map((e) => `<li><a href="${root}${esc(e.path)}">${esc(e.title)}<span class="meta">${esc(categoryLabel(e.category))}</span></a></li>`)
    .join('')}</ol></div>`;
}

function cardsWithAds(root: string, entries: SiteEntry[], config: SiteConfig, opts: { dek?: boolean } = {}) {
  const every = config.adEveryNCards || 6;
  const slot = config.adSlots?.indexInline;
  return entries
    .map((e, i) => card(root, e, { lazy: i > 3, dek: opts.dek }) + (slot && (i + 1) % every === 0 && i < entries.length - 1 ? adSlot(slot, 'inline') : ''))
    .join('\n');
}

function shareBlock(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links: [string, string, string][] = [
    ['WhatsApp', 'wa', `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`],
    ['Facebook', 'fb', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['Telegram', 'tg', `https://t.me/share/url?url=${u}&text=${t}`],
    ['X', 'x', `https://x.com/intent/post?text=${t}&url=${u}`],
    ['Bluesky', 'bs', `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${url}`)}`],
  ];
  return `<div class="share"><span>Compartir:</span>${links
    .map(([n, cls, href]) => `<a class="${cls}" href="${esc(href)}" rel="noopener nofollow" target="_blank">${n}</a>`)
    .join('')}<button type="button" data-url="${esc(url)}" onclick="var b=this;try{navigator.clipboard.writeText(b.getAttribute('data-url')).then(function(){b.textContent='¡Copiado!'})}catch(e){}">Copiar enlace</button></div>`;
}

/** Video de YouTube con "fachada": solo carga el reproductor al pulsar (página rápida y sin cookies de YouTube) */
function youtubeBlock(v: NewsVideo) {
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0`;
  return `<figure><div class="yt" role="button" tabindex="0" aria-label="Reproducir video: ${esc(v.title)}" data-src="${esc(src)}" onclick="this.innerHTML='<iframe src=&quot;'+this.getAttribute('data-src')+'&quot; allow=&quot;autoplay; encrypted-media; picture-in-picture&quot; allowfullscreen title=&quot;Video&quot;></iframe>'">
<img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="eager" width="480" height="360"><span class="lbl">▶ VIDEO</span><span class="play" aria-hidden="true"></span></div>
<figcaption>Video: ${esc(v.title)}${v.channel ? ` · ${esc(v.channel)}` : ''} (YouTube)</figcaption></figure>`;
}

/** Reel de Instagram: tarjeta que carga el reproductor de Instagram al pulsar */
function reelBlock(reelUrl: string) {
  const embed = `${reelUrl.replace(/\/?(\?.*)?$/, '/')}embed/`;
  return `<section class="reel" id="reel"><div class="ph" role="button" tabindex="0" aria-label="Ver el resumen en video" data-src="${esc(embed)}" onclick="var r=document.getElementById('reel');r.classList.add('open');r.innerHTML='<iframe src=&quot;'+this.getAttribute('data-src')+'&quot; loading=&quot;lazy&quot; allowtransparency=&quot;true&quot; scrolling=&quot;no&quot; title=&quot;Reel&quot;></iframe>'">PUNTO<br>CIEGO<span>.</span><span class="play" aria-hidden="true"></span></div>
<div><h2>La noticia en 30 segundos</h2><p>Mira el resumen en video con lo esencial y el punto ciego de esta historia.</p><a class="btn" href="${esc(reelUrl)}" rel="noopener" target="_blank">Ver en Instagram</a></div></section>`;
}

function breadcrumbLd(baseUrl: string, items: { name: string; rel: string }[]) {
  if (!baseUrl) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${baseUrl}/${it.rel}` })),
  };
}

export interface ArticleContext {
  entries?: SiteEntry[];
  config?: SiteConfig;
}

export function renderArticlePage(entry: SiteEntry, baseUrl: string, ctx: ArticleContext = {}): string {
  const root = '../../';
  const config = ctx.config || {};
  const everything = ctx.entries || [];
  const all = everything.filter((e) => e.slug !== entry.slug);
  const a = entry.article;
  const canonical = abs(baseUrl, entry.path);
  const image = abs(baseUrl, entry.image);
  const catLabel = categoryLabel(entry.category);

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: a.title.slice(0, 110),
    description: a.dek,
    datePublished: entry.publishedAt,
    dateModified: entry.publishedAt,
    articleSection: catLabel,
    keywords: a.tags.join(', '),
    wordCount: a.wordCount,
    inLanguage: 'es',
    ...(image ? { image: [image, ...(entry.photo ? [abs(baseUrl, entry.photo)] : [])] } : {}),
    ...(canonical ? { mainEntityOfPage: canonical, url: canonical } : {}),
    author: { '@type': 'Organization', name: `Redacción ${SITE_NAME}`, ...(baseUrl ? { url: `${baseUrl}/quienes-somos/` } : {}) },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      ...(baseUrl ? { url: `${baseUrl}/`, logo: { '@type': 'ImageObject', url: `${baseUrl}/favicon.svg` } } : {}),
    },
    isBasedOn: a.sources.map((s) => s.url),
  };
  const crumbs = breadcrumbLd(baseUrl, [
    { name: 'Portada', rel: '' },
    { name: catLabel, rel: categoryPath(entry.category) },
    { name: a.title, rel: entry.path },
  ]);

  // El "punto ciego" se destaca tras la primera sección, salvo que el artículo ya tenga una sección con ese nombre.
  // El anuncio intermedio va tras la segunda sección y el Reel tras la tercera.
  const hasBlindSection = a.sections.some((s) => /punto ciego/i.test(s.heading));
  const sectionsHtml = a.sections
    .map((s, i) => {
      let block = `<h2>${esc(s.heading)}</h2>${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}`;
      if (i === 0 && entry.blindSpot && !hasBlindSection) {
        block += `<aside class="blind"><strong>El punto ciego</strong>${esc(entry.blindSpot)}</aside>`;
      }
      if (i === 1 && a.sections.length > 2) block += adSlot(config.adSlots?.articleMiddle, 'middle');
      if (i === 2 && entry.reelUrl) block += reelBlock(entry.reelUrl);
      return block;
    })
    .join('\n');
  const reelAfter = entry.reelUrl && a.sections.length < 3 ? reelBlock(entry.reelUrl) : '';

  // Siguiente noticia: la inmediatamente anterior en el tiempo (o la más reciente si esta es la última)
  const idx = everything.findIndex((e) => e.slug === entry.slug);
  const next = (idx >= 0 ? everything[idx + 1] : undefined) || all[0];

  const sameCat = all.filter((e) => e.category === entry.category && e.slug !== next?.slug);
  const related = [...sameCat, ...all.filter((e) => e.category !== entry.category && e.slug !== next?.slug)].slice(0, 3);
  const recent = all.slice(0, 6);

  const photo = pic(entry);
  const media = entry.video
    ? youtubeBlock(entry.video)
    : photo
      ? `<figure><img src="${root}${esc(photo)}" alt="${esc(entry.headline)}" width="1200" height="${entry.photo ? 675 : 630}" fetchpriority="high"><figcaption>Imagen de referencia · Fuente: ${esc(entry.sourceName)}</figcaption></figure>`
      : '';

  const body = `<main class="wrap"><div class="layout">
<article class="story">
  <nav class="crumbs" aria-label="Ruta"><a href="${root}">Portada</a> › <a href="${root}${categoryPath(entry.category)}">${esc(catLabel)}</a></nav>
  <a class="kicker" href="${root}${categoryPath(entry.category)}">${esc(catLabel)}</a>
  <h1>${esc(a.title)}</h1>
  <p class="dek">${esc(a.dek)}</p>
  <div class="byline"><div class="avatar">P<i>C</i></div><div><strong>Redacción ${SITE_NAME}</strong><span class="meta"><time datetime="${esc(entry.publishedAt)}">${formatDate(entry.publishedAt)}</time> · ${readingMinutes(a.wordCount)} min de lectura · Fuente principal: ${esc(entry.sourceName)}</span></div></div>
  ${media ? `<div class="media">${media}</div>` : ''}
  ${adSlot(config.adSlots?.articleTop, 'top')}
  ${a.keyFacts.length ? `<section class="facts"><h2>Datos clave</h2><ul>${a.keyFacts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
  <div class="body">${sectionsHtml}</div>
  ${reelAfter}
  ${canonical ? shareBlock(canonical, a.title) : ''}
  ${config.socialLinks?.telegram ? `<a class="follow" href="${esc(config.socialLinks.telegram)}" rel="noopener" target="_blank"><b>✈</b><span><strong>Recibe estas noticias en Telegram</strong>Únete gratis al canal de ${SITE_NAME}: lo importante, sin ruido.</span><em>Unirme</em></a>` : ''}
  <section class="sources"><h2>Fuentes consultadas</h2><ul>${a.sources
    .map((s) => `<li><a href="${esc(s.url)}" rel="nofollow noopener" target="_blank">${esc(s.name)}</a>: ${esc(s.title)}</li>`)
    .join('')}</ul></section>
  ${a.tags.length ? `<div class="tags">${a.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
  ${adSlot(config.adSlots?.articleBottom, 'bottom')}
  ${
    config.donationUrl
      ? `<div class="donate">${esc(config.donationLabel || `Apoya el periodismo de ${SITE_NAME}`)}<br><a href="${esc(config.donationUrl)}" rel="noopener" target="_blank">Hacer un aporte</a></div>`
      : ''
  }
  ${next ? `<a class="next" href="${root}${esc(next.path)}">${thumb(root, next).replace(/^<a /, '<span ').replace(/<\/a>$/, '</span>')}<div><div class="lbl">Siguiente noticia →</div><h3>${esc(next.title)}</h3></div></a>` : ''}
  ${related.length ? `<section class="related"><div class="sec-title"><h2>Te puede interesar</h2></div><div class="grid g3">${related.map((e) => card(root, e)).join('')}</div></section>` : ''}
</article>
<aside><div class="sticky" style="padding-top:26px">
  ${latestBox(root, recent)}
  ${adSlot(config.adSlots?.sidebar, 'sidebar')}
</div></aside>
</div></main>`;

  return layout({
    root,
    title: `${a.title} | ${SITE_NAME}`,
    description: a.dek,
    canonical,
    image,
    type: 'article',
    jsonLd: [articleLd, ...(crumbs ? [crumbs] : [])],
    body,
    config,
    small: true,
    activeCategory: entry.category,
    ticker: everything,
  });
}

function pager(root: string, page: number, totalPages: number, pageRel: (n: number) => string) {
  if (totalPages <= 1) return '';
  const items: string[] = [];
  if (page > 1) items.push(`<a href="${root}${pageRel(page - 1)}" rel="prev">← Más recientes</a>`);
  for (let n = 1; n <= totalPages; n++) {
    if (n === 1 || n === totalPages || Math.abs(n - page) <= 2) {
      items.push(n === page ? `<span class="on" aria-current="page">${n}</span>` : `<a href="${root}${pageRel(n)}">${n}</a>`);
    } else if (!items[items.length - 1]?.endsWith('…</span>')) {
      items.push('<span>…</span>');
    }
  }
  if (page < totalPages) items.push(`<a href="${root}${pageRel(page + 1)}" rel="next">Anteriores →</a>`);
  return `<nav class="pager" aria-label="Páginas">${items.join('')}</nav>`;
}

/** Ruta relativa de la página n de la portada ("" para la 1) */
export const indexPageRel = (n: number) => (n <= 1 ? '' : `pagina/${n}/`);

export function renderIndexPage(
  entries: SiteEntry[],
  baseUrl: string,
  opts: { page?: number; totalPages?: number; config?: SiteConfig; all?: SiteEntry[] } = {}
): string {
  const page = opts.page || 1;
  const totalPages = opts.totalPages || 1;
  const config = opts.config || {};
  const all = opts.all || entries;
  const root = page === 1 ? './' : '../../';
  const description = config.siteDescription || DEFAULT_DESCRIPTION;

  const websiteLd = baseUrl
    ? {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: `${baseUrl}/`,
        description,
        inLanguage: 'es',
        publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${baseUrl}/favicon.svg` } },
      }
    : undefined;

  let body: string;
  if (page === 1) {
    const [lead, ...rest] = entries;
    const featured = rest.slice(0, 2);
    const feed = rest.slice(2, 12);
    const shown = new Set([lead, ...featured, ...feed].filter(Boolean).map((e) => e!.slug));
    // Bloques por sección con lo que no salió arriba (o lo más reciente de la sección si ya salió todo)
    const blocks = SITE_CATEGORIES.map((c) => {
      const inCat = all.filter((e) => e.category === c);
      const fresh = inCat.filter((e) => !shown.has(e.slug));
      const items = (fresh.length >= 2 ? fresh : inCat).slice(0, 4);
      return items.length
        ? `<section><div class="sec-title"><h2>${esc(categoryLabel(c))}</h2><a href="${root}${categoryPath(c)}">Ver todo →</a></div><div class="grid">${items.map((e) => card(root, e)).join('')}</div></section>`
        : '';
    }).join('');
    const videos = all.filter((e) => e.video).slice(0, 4);

    body = lead
      ? `<main class="wrap">
<section class="top">${heroBlock(root, lead)}<div class="side-top">${featured.map((e) => card(root, e, { lazy: false })).join('')}</div></section>
${adSlot(config.adSlots?.indexInline, 'inline')}
<div class="cols"><div><div class="sec-title"><h2>Lo más reciente</h2></div><div class="feed">${feed.map((e) => row(root, e)).join('')}</div></div>
<aside><div class="sticky" style="padding-top:36px">${numberedBox(root, all.slice(0, 5), 'Más noticias')}${adSlot(config.adSlots?.sidebar, 'sidebar')}</div></aside></div>
${videos.length ? `<section><div class="sec-title"><h2>Noticias con video</h2></div><div class="grid">${videos.map((e) => card(root, e)).join('')}</div></section>` : ''}
${blocks}
${pager(root, page, totalPages, indexPageRel)}
</main>`
      : `<main class="wrap"><p style="padding:40px 0;text-align:center" class="meta">Aún no hay artículos publicados.</p></main>`;
  } else {
    body = `<main class="wrap">
<div class="section-head"><nav class="crumbs" aria-label="Ruta"><a href="${root}">Portada</a> › Archivo</nav><h1>Archivo</h1><div class="meta">Página ${page} de ${totalPages}</div></div>
<div class="cols" style="margin-top:24px"><div class="feed">${entries.map((e) => row(root, e)).join('')}</div>
<aside><div class="sticky">${numberedBox(root, all.slice(0, 5), 'Lo último')}</div></aside></div>
${pager(root, page, totalPages, indexPageRel)}
</main>`;
  }

  return layout({
    root,
    title: page === 1 ? `${SITE_NAME} | ${TAGLINE}` : `Archivo, página ${page} | ${SITE_NAME}`,
    description,
    canonical: abs(baseUrl, indexPageRel(page)),
    image: abs(baseUrl, entries[0]?.image),
    type: 'website',
    jsonLd: page === 1 && websiteLd ? [websiteLd] : [],
    body,
    config,
    ticker: all,
  });
}

export function renderCategoryPage(category: string, entries: SiteEntry[], baseUrl: string, config: SiteConfig = {}, all: SiteEntry[] = entries): string {
  const root = '../../';
  const label = categoryLabel(category);
  const rel = categoryPath(category);
  const crumbs = breadcrumbLd(baseUrl, [
    { name: 'Portada', rel: '' },
    { name: label, rel },
  ]);
  const [lead, ...rest] = entries;
  const body = `<main class="wrap">
<div class="section-head"><nav class="crumbs" aria-label="Ruta"><a href="${root}">Portada</a> › ${esc(label)}</nav><h1>${esc(label)}</h1></div>
${
  lead
    ? `<section class="top">${heroBlock(root, lead)}<div class="side-top">${rest.slice(0, 2).map((e) => card(root, e, { lazy: false })).join('')}</div></section>
${rest.length > 2 ? `<div class="sec-title"><h2>Más de ${esc(label)}</h2></div><section class="grid">${cardsWithAds(root, rest.slice(2), config, { dek: true })}</section>` : ''}`
    : `<p class="meta" style="padding:40px 0;text-align:center">Todavía no hay artículos en esta sección.</p>`
}
</main>`;
  return layout({
    root,
    title: `${label} | ${SITE_NAME}`,
    description: `Análisis de ${label.toLowerCase()} en ${SITE_NAME}: ${TAGLINE.toLowerCase()}.`,
    canonical: abs(baseUrl, rel),
    image: abs(baseUrl, entries[0]?.image),
    type: 'website',
    jsonLd: crumbs ? [crumbs] : [],
    body,
    config,
    activeCategory: category,
    ticker: all,
  });
}

/** Página informativa (legales, quiénes somos...). `bodyHtml` ya viene escapado/controlado. */
export function renderStaticPage(
  opts: { rel: string; title: string; description: string; bodyHtml: string; updated?: string },
  baseUrl: string,
  config: SiteConfig = {}
): string {
  const root = '../';
  const body = `<main class="wrap"><div class="page">
<nav class="crumbs" aria-label="Ruta"><a href="${root}">Portada</a> › ${esc(opts.title)}</nav>
<h1>${esc(opts.title)}</h1>
${opts.updated ? `<p class="updated">Última actualización: ${esc(opts.updated)}</p>` : ''}
${opts.bodyHtml}
</div></main>`;
  return layout({
    root,
    title: `${opts.title} | ${SITE_NAME}`,
    description: opts.description,
    canonical: abs(baseUrl, opts.rel),
    type: 'website',
    body,
    config,
    small: true,
  });
}

/** 404 servida por Cloudflare Pages desde cualquier ruta: enlaces absolutos a la raíz */
export function renderNotFoundPage(baseUrl: string, config: SiteConfig = {}, latest: SiteEntry[] = []): string {
  const root = baseUrl ? `${baseUrl}/` : '/';
  const body = `<main class="wrap"><div class="notfound">
<h1>404</h1><p class="dek" style="margin:14px auto;max-width:520px">Esta página no existe o fue movida. Pero hay mucho que leer:</p>
<p><a class="kicker" href="${root}">Volver a la portada</a></p>
</div>
${latest.length ? `<section class="grid">${latest.slice(0, 3).map((e) => card(root, e)).join('')}</section>` : ''}
</main>`;
  return layout({ root, title: `Página no encontrada | ${SITE_NAME}`, description: DEFAULT_DESCRIPTION, type: 'website', body, config, small: true, noindex: true });
}

export function renderRss(entries: SiteEntry[], baseUrl: string, config: SiteConfig = {}): string {
  const link = (e: SiteEntry) => (baseUrl ? `${baseUrl}/${e.path}` : e.path);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${SITE_NAME}</title><link>${esc(baseUrl ? `${baseUrl}/` : '/')}</link><description>${esc(config.siteDescription || TAGLINE)}</description><language>es</language>
${baseUrl ? `<atom:link href="${esc(baseUrl)}/rss.xml" rel="self" type="application/rss+xml"/>` : ''}
${entries
  .map(
    (e) =>
      `<item><title>${esc(e.title)}</title><link>${esc(link(e))}</link><guid isPermaLink="true">${esc(link(e))}</guid><pubDate>${new Date(e.publishedAt).toUTCString()}</pubDate><category>${esc(categoryLabel(e.category))}</category><description>${esc(e.dek)}</description>${
        e.image && baseUrl ? `<enclosure url="${esc(`${baseUrl}/${e.image}`)}" type="image/jpeg" length="0"/>` : ''
      }</item>`
  )
  .join('\n')}
</channel></rss>`;
}

export function renderSitemap(entries: SiteEntry[], baseUrl: string, extraRels: string[] = []): string {
  if (!baseUrl) return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
  const newest = entries[0]?.publishedAt.slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${esc(baseUrl)}/</loc>${newest ? `<lastmod>${newest}</lastmod>` : ''}</url>
${extraRels.map((rel) => `<url><loc>${esc(`${baseUrl}/${rel}`)}</loc></url>`).join('\n')}
${entries.map((e) => `<url><loc>${esc(`${baseUrl}/${e.path}`)}</loc><lastmod>${e.publishedAt.slice(0, 10)}</lastmod></url>`).join('\n')}
</urlset>`;
}

/** Sitemap de Google News: solo artículos de las últimas 48 h */
export function renderNewsSitemap(entries: SiteEntry[], baseUrl: string): string {
  const cutoff = Date.now() - 48 * 3600 * 1000;
  const fresh = baseUrl ? entries.filter((e) => new Date(e.publishedAt).getTime() >= cutoff).slice(0, 1000) : [];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${fresh
  .map(
    (e) =>
      `<url><loc>${esc(`${baseUrl}/${e.path}`)}</loc><news:news><news:publication><news:name>${SITE_NAME}</news:name><news:language>es</news:language></news:publication><news:publication_date>${esc(e.publishedAt)}</news:publication_date><news:title>${esc(e.title)}</news:title></news:news></url>`
  )
  .join('\n')}
</urlset>`;
}

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#14161a"/><circle cx="32" cy="32" r="17" fill="none" stroke="#f6f3ec" stroke-width="5"/><circle cx="32" cy="32" r="7" fill="#b4152b"/></svg>`;

export function renderManifest(): string {
  return JSON.stringify(
    {
      name: SITE_NAME,
      short_name: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      lang: 'es',
      start_url: './',
      display: 'standalone',
      background_color: '#f6f3ec',
      theme_color: '#b4152b',
      icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
    },
    null,
    2
  );
}
