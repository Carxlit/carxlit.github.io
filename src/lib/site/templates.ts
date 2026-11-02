import { NewsArticle } from '@/types/news';
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
  image?: string; // relativo a la raíz, p. ej. "img/<slug>.jpg"
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

function readingMinutes(words: number): number {
  return Math.max(2, Math.round(words / 220));
}

const abs = (baseUrl: string, rel?: string) => (baseUrl && rel !== undefined ? `${baseUrl}/${rel}` : undefined);

const STYLES = `
:root{--paper:#f6f3ec;--ink:#14161a;--muted:#5d6168;--rule:#d9d4c7;--accent:#b4152b;--card:#fffdf8}
@media (prefers-color-scheme:dark){:root{--paper:#0e1116;--ink:#ecebe6;--muted:#9aa0a8;--rule:#262b33;--accent:#e2475b;--card:#151a21}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:18px/1.65 "Source Serif 4",Georgia,"Times New Roman",serif;overflow-x:hidden}
a{color:inherit}img{max-width:100%}
.wrap{max-width:1080px;margin:0 auto;padding:0 16px}
.masthead{border-bottom:3px double var(--ink);padding:22px 0 0;text-align:center}
.masthead a{text-decoration:none}
.brand{font:900 clamp(34px,7vw,64px)/1 "Playfair Display",Georgia,serif;letter-spacing:-.01em;text-transform:uppercase}
.brand span{color:var(--accent)}
.tagline{font:500 13px/1.4 Inter,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-top:8px}
.masthead.small{padding-top:12px}.masthead.small .brand{font-size:30px}
.nav{display:flex;gap:4px 22px;justify-content:center;flex-wrap:wrap;padding:12px 0;margin-top:12px;border-top:1px solid var(--rule);font:700 12px/1.2 Inter,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase}
.nav a{text-decoration:none;color:var(--muted);padding:4px 0}.nav a:hover,.nav a.on{color:var(--accent)}
.kicker{font:800 12px/1 Inter,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);text-decoration:none}
.meta{font:500 13px/1.5 Inter,system-ui,sans-serif;color:var(--muted)}
.crumbs{font:500 13px/1.4 Inter,system-ui,sans-serif;color:var(--muted);margin-bottom:14px}.crumbs a{text-decoration:none}.crumbs a:hover{text-decoration:underline}
.lead{display:grid;grid-template-columns:1.4fr 1fr;gap:28px;padding:28px 0;border-bottom:1px solid var(--rule)}
.lead h2{font:800 clamp(26px,3.6vw,40px)/1.12 "Playfair Display",Georgia,serif;margin:10px 0}
.lead img,.card img{width:100%;height:auto;display:block;border:1px solid var(--rule)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:26px;padding:26px 0}
.card{border-top:2px solid var(--ink);padding-top:12px;min-width:0}
.card h3{font:700 21px/1.25 "Playfair Display",Georgia,serif;margin:8px 0}
.card p,.lead p{margin:0;color:var(--muted);font-size:16px}
.card a,.lead a{text-decoration:none}.card a:hover h3,.lead a:hover h2{text-decoration:underline}
.grid .ad{grid-column:1/-1}
.section-head{padding:26px 0 0;border-bottom:1px solid var(--rule)}
.section-head h1{font:800 clamp(28px,4.5vw,42px)/1.1 "Playfair Display",Georgia,serif;margin:8px 0 16px}
.layout{display:grid;grid-template-columns:minmax(0,720px) 280px;gap:48px;justify-content:center}
.layout>aside{padding-top:30px}
.sticky{position:sticky;top:20px}
.side-box{border-top:2px solid var(--ink);padding-top:10px;margin-bottom:26px}
.side-box h2{font:800 12px/1 Inter,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;margin:0 0 10px}
.side-box ol{margin:0;padding:0;list-style:none;counter-reset:n}
.side-box li{counter-increment:n;display:grid;grid-template-columns:26px 1fr;gap:4px;padding:8px 0;border-bottom:1px solid var(--rule);font:700 16px/1.3 "Playfair Display",Georgia,serif}
.side-box li::before{content:counter(n);color:var(--accent);font-family:Inter,system-ui,sans-serif;font-size:14px}
.side-box a{text-decoration:none}.side-box a:hover{text-decoration:underline}
article.story{max-width:720px;margin:0 auto;padding:30px 0 50px;min-width:0}
article.story h1{font:800 clamp(30px,5vw,46px)/1.1 "Playfair Display",Georgia,serif;margin:12px 0}
.dek{font-size:21px;line-height:1.5;color:var(--muted);margin:0 0 14px}
.hero{margin:22px 0}.hero img{width:100%;height:auto;display:block}
.facts{background:var(--card);border:1px solid var(--rule);border-left:4px solid var(--accent);padding:16px 20px;margin:26px 0}
.facts h2{font:800 13px/1 Inter,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;margin:0 0 10px}
.facts ul{margin:0;padding-left:20px}.facts li{margin:4px 0;font-size:17px}
article.story h2.section{font:700 25px/1.25 "Playfair Display",Georgia,serif;margin:34px 0 8px}
.blind{border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);padding:16px 0;margin:30px 0;font-size:20px;font-style:italic}
.blind strong{font-style:normal;color:var(--accent);font-family:Inter,system-ui,sans-serif;font-size:12px;letter-spacing:.16em;text-transform:uppercase;display:block;margin-bottom:6px}
.sources{border-top:1px solid var(--rule);margin-top:36px;padding-top:16px;font:15px/1.6 Inter,system-ui,sans-serif;overflow-wrap:anywhere}
.sources h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px}
.tags{margin-top:18px}.tags span{display:inline-block;font:600 12px/1 Inter,system-ui,sans-serif;border:1px solid var(--rule);padding:6px 10px;margin:0 6px 6px 0}
.share{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:26px 0 0;font:600 13px/1 Inter,system-ui,sans-serif}
.share span{color:var(--muted);margin-right:4px}
.share a,.share button{border:1px solid var(--rule);background:var(--card);color:var(--ink);padding:9px 12px;text-decoration:none;font:inherit;cursor:pointer;border-radius:2px}
.share a:hover,.share button:hover{border-color:var(--accent);color:var(--accent)}
.donate{display:block;text-align:center;margin:30px 0 0;padding:18px;background:var(--card);border:1px solid var(--rule);font:600 15px/1.5 Inter,system-ui,sans-serif}
.donate a{display:inline-block;margin-top:8px;background:var(--accent);color:#fff;text-decoration:none;padding:10px 18px;border-radius:2px}
.related{border-top:3px double var(--ink);margin-top:40px;padding-top:6px}
.related>h2{font:800 13px/1 Inter,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;margin:14px 0 0}
.related .grid{padding-top:16px}
.pager{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;padding:10px 0 40px;font:600 14px/1 Inter,system-ui,sans-serif}
.pager a,.pager span{border:1px solid var(--rule);padding:10px 14px;text-decoration:none}
.pager span.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.page{max-width:720px;margin:0 auto;padding:30px 0 50px}
.page h1{font:800 clamp(30px,5vw,42px)/1.1 "Playfair Display",Georgia,serif;margin:0 0 16px}
.page h2{font:700 23px/1.3 "Playfair Display",Georgia,serif;margin:30px 0 8px}
.page .updated{font:500 13px/1.5 Inter,system-ui,sans-serif;color:var(--muted)}
.page button{font:600 14px/1 Inter,system-ui,sans-serif;padding:10px 16px;border:1px solid var(--ink);background:transparent;color:var(--ink);cursor:pointer}
.ad{margin:28px 0;text-align:center;overflow:hidden}.ad:not(.on){display:none}
.ad::before{content:"Publicidad";display:block;font:600 10px/1 Inter,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
footer{border-top:3px double var(--ink);padding:24px 0 40px;font:13px/1.7 Inter,system-ui,sans-serif;color:var(--muted);text-align:center}
footer nav{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 18px;margin-bottom:12px}
footer nav a{text-decoration:none;color:var(--ink)}footer nav a:hover{color:var(--accent)}
.consent{position:fixed;left:12px;right:12px;bottom:12px;z-index:50;max-width:760px;margin:0 auto;background:var(--card);color:var(--ink);border:1px solid var(--rule);border-top:3px solid var(--accent);box-shadow:0 8px 30px rgba(0,0,0,.18);padding:16px 18px;font:14px/1.5 Inter,system-ui,sans-serif;display:none}
.consent.show{display:block}
.consent .btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.consent button{font:700 13px/1 Inter,system-ui,sans-serif;padding:10px 16px;cursor:pointer;border:1px solid var(--ink);background:transparent;color:var(--ink)}
.consent button.yes{background:var(--ink);color:var(--paper)}
.notfound{text-align:center;padding:70px 0}.notfound h1{font:900 64px/1 "Playfair Display",Georgia,serif;margin:0}
@media (max-width:1000px){.layout{grid-template-columns:minmax(0,1fr)}.layout>aside{display:none}}
@media (max-width:820px){.lead{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.grid{grid-template-columns:minmax(0,1fr)}body{font-size:17px}.dek{font-size:18px}.nav{gap:2px 14px;font-size:11px}}
`;

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
<meta name="theme-color" content="#b4152b">
${o.config.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(o.config.googleSiteVerification)}">` : ''}
${o.config.bingSiteVerification ? `<meta name="msvalidate.01" content="${esc(o.config.bingSiteVerification)}">` : ''}
<link rel="icon" href="${o.root}favicon.svg" type="image/svg+xml">
<link rel="manifest" href="${o.root}site.webmanifest">
<link rel="alternate" type="application/rss+xml" title="${SITE_NAME}" href="${o.root}rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&family=Playfair+Display:wght@700;800;900&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>${STYLES}</style>
${(o.jsonLd || []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
${masthead(o.root, o.small, o.activeCategory)}
${o.body}
${footer(o.root, o.config)}
${consent ? consentBlock(o.root, o.config) : ''}
</body>
</html>`;
}

function masthead(root: string, small = false, active?: string) {
  const nav = SITE_CATEGORIES.map(
    (c) => `<a href="${root}${categoryPath(c)}"${active === c ? ' class="on" aria-current="page"' : ''}>${esc(categoryLabel(c))}</a>`
  ).join('');
  return `<header class="masthead${small ? ' small' : ''}"><div class="wrap"><a href="${root}"><div class="brand">Punto <span>Ciego</span></div></a>${small ? '' : `<div class="tagline">${TAGLINE}</div>`}<nav class="nav" aria-label="Secciones">${nav}</nav></div></header>`;
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
  return `<footer><div class="wrap">
<nav aria-label="Información"><a href="${root}quienes-somos/">Quiénes somos</a><a href="${root}contacto/">Contacto</a><a href="${root}aviso-legal/">Aviso legal</a><a href="${root}privacidad/">Privacidad</a><a href="${root}cookies/">Cookies</a><a href="${root}rss.xml">RSS</a>${
    config.donationUrl ? `<a href="${esc(config.donationUrl)}" rel="noopener" target="_blank">Apóyanos</a>` : ''
  }</nav>
${socialLinks ? `<nav aria-label="Redes">${socialLinks}</nav>` : ''}
© ${new Date().getFullYear()} ${SITE_NAME} · ${esc(config.siteDescription || DEFAULT_DESCRIPTION)}<br>Piezas elaboradas con asistencia de inteligencia artificial a partir de las fuentes citadas en cada artículo.
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

function card(root: string, e: SiteEntry, lazy = true) {
  return `<div class="card"><a href="${root}${esc(e.path)}">${
    e.image ? `<img src="${root}${esc(e.image)}" alt="" ${lazy ? 'loading="lazy" ' : ''}width="1200" height="630">` : ''
  }<div class="kicker" style="margin-top:10px">${esc(categoryLabel(e.category))}</div><h3>${esc(e.title)}</h3></a><p>${esc(e.dek)}</p></div>`;
}

function cardsWithAds(root: string, entries: SiteEntry[], config: SiteConfig) {
  const every = config.adEveryNCards || 6;
  const slot = config.adSlots?.indexInline;
  return entries
    .map((e, i) => card(root, e, i > 2) + (slot && (i + 1) % every === 0 && i < entries.length - 1 ? adSlot(slot, 'inline') : ''))
    .join('\n');
}

function shareBlock(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links: [string, string][] = [
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['X', `https://x.com/intent/post?text=${t}&url=${u}`],
    ['Telegram', `https://t.me/share/url?url=${u}&text=${t}`],
    ['WhatsApp', `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`],
    ['Bluesky', `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${url}`)}`],
  ];
  return `<div class="share"><span>Compartir:</span>${links
    .map(([n, href]) => `<a href="${esc(href)}" rel="noopener nofollow" target="_blank">${n}</a>`)
    .join('')}<button type="button" data-url="${esc(url)}" onclick="var b=this;try{navigator.clipboard.writeText(b.getAttribute('data-url')).then(function(){b.textContent='¡Copiado!'})}catch(e){}">Copiar enlace</button></div>`;
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
  const all = (ctx.entries || []).filter((e) => e.slug !== entry.slug);
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
    ...(image ? { image: [image] } : {}),
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
  // El anuncio intermedio va tras la segunda sección.
  const hasBlindSection = a.sections.some((s) => /punto ciego/i.test(s.heading));
  const sectionsHtml = a.sections
    .map((s, i) => {
      let block = `<h2 class="section">${esc(s.heading)}</h2>${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}`;
      if (i === 0 && entry.blindSpot && !hasBlindSection) {
        block += `<aside class="blind"><strong>El punto ciego</strong>${esc(entry.blindSpot)}</aside>`;
      }
      if (i === 1 && a.sections.length > 2) block += adSlot(config.adSlots?.articleMiddle, 'middle');
      return block;
    })
    .join('\n');

  const sameCat = all.filter((e) => e.category === entry.category);
  const related = [...sameCat, ...all.filter((e) => e.category !== entry.category)].slice(0, 3);
  const recent = all.slice(0, 6);

  const body = `<main class="wrap"><div class="layout">
<article class="story">
  <nav class="crumbs" aria-label="Ruta"><a href="${root}">Portada</a> › <a href="${root}${categoryPath(entry.category)}">${esc(catLabel)}</a></nav>
  <a class="kicker" href="${root}${categoryPath(entry.category)}">${esc(catLabel)}</a>
  <h1>${esc(a.title)}</h1>
  <p class="dek">${esc(a.dek)}</p>
  <div class="meta">Por Redacción ${SITE_NAME} · <time datetime="${esc(entry.publishedAt)}">${formatDate(entry.publishedAt)}</time> · ${readingMinutes(a.wordCount)} min de lectura · Fuente principal: ${esc(entry.sourceName)}</div>
  ${entry.image ? `<figure class="hero"><img src="${root}${esc(entry.image)}" alt="${esc(entry.headline)}" width="1200" height="630" fetchpriority="high"></figure>` : ''}
  ${adSlot(config.adSlots?.articleTop, 'top')}
  ${a.keyFacts.length ? `<section class="facts"><h2>Datos clave</h2><ul>${a.keyFacts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
  ${sectionsHtml}
  ${canonical ? shareBlock(canonical, a.title) : ''}
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
  ${related.length ? `<section class="related"><h2>Te puede interesar</h2><div class="grid">${related.map((e) => card(root, e)).join('')}</div></section>` : ''}
</article>
<aside><div class="sticky">
  ${recent.length ? `<div class="side-box"><h2>Lo último</h2><ol>${recent.map((e) => `<li><a href="${root}${esc(e.path)}">${esc(e.title)}</a></li>`).join('')}</ol></div>` : ''}
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
  opts: { page?: number; totalPages?: number; config?: SiteConfig } = {}
): string {
  const page = opts.page || 1;
  const totalPages = opts.totalPages || 1;
  const config = opts.config || {};
  const root = page === 1 ? './' : '../../';
  const description = config.siteDescription || DEFAULT_DESCRIPTION;
  const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const [lead, ...rest] = page === 1 ? entries : [undefined, ...entries];

  const leadHtml = lead
    ? `<section class="lead"><a href="${root}${esc(lead.path)}">${lead.image ? `<img src="${root}${esc(lead.image)}" alt="${esc(lead.headline)}" width="1200" height="630" fetchpriority="high">` : ''}</a>
<div><a class="kicker" href="${root}${categoryPath(lead.category)}">${esc(categoryLabel(lead.category))}</a><a href="${root}${esc(lead.path)}"><h2>${esc(lead.title)}</h2></a><p>${esc(lead.dek)}</p><div class="meta" style="margin-top:10px">${formatDate(lead.publishedAt)} · ${readingMinutes(lead.article.wordCount)} min de lectura</div></div></section>`
    : page === 1
      ? `<p style="padding:40px 0;text-align:center" class="meta">Aún no hay artículos publicados.</p>`
      : '';

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

  const body = `<main class="wrap">
<div class="meta" style="text-align:center;padding:10px 0;border-bottom:1px solid var(--rule);text-transform:capitalize">${page === 1 ? esc(today) : `Archivo · página ${page} de ${totalPages}`}</div>
${leadHtml}
<section class="grid">${cardsWithAds(root, rest as SiteEntry[], config)}</section>
${pager(root, page, totalPages, indexPageRel)}
</main>`;

  return layout({
    root,
    title: page === 1 ? `${SITE_NAME} | ${TAGLINE}` : `Archivo, página ${page} | ${SITE_NAME}`,
    description,
    canonical: abs(baseUrl, indexPageRel(page)),
    image: abs(baseUrl, (lead || entries[0])?.image),
    type: 'website',
    jsonLd: page === 1 && websiteLd ? [websiteLd] : [],
    body,
    config,
  });
}

export function renderCategoryPage(category: string, entries: SiteEntry[], baseUrl: string, config: SiteConfig = {}): string {
  const root = '../../';
  const label = categoryLabel(category);
  const rel = categoryPath(category);
  const crumbs = breadcrumbLd(baseUrl, [
    { name: 'Portada', rel: '' },
    { name: label, rel },
  ]);
  const body = `<main class="wrap">
<div class="section-head"><nav class="crumbs" aria-label="Ruta"><a href="${root}">Portada</a> › ${esc(label)}</nav><h1>${esc(label)}</h1></div>
${entries.length ? `<section class="grid">${cardsWithAds(root, entries, config)}</section>` : `<p class="meta" style="padding:40px 0;text-align:center">Todavía no hay artículos en esta sección.</p>`}
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
