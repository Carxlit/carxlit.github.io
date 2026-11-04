import { ProcessedNews } from '@/types/news';
import { escapeHtml } from '@/lib/news/card-generator';
import { SEVERE_EVENT } from '@/lib/agents/news-scout';

/**
 * Formato "infografía animada" de los Reels (el que más engancha en Instagram): fondo azul oscuro con rayas suaves,
 * foto enmarcada que entra deslizándose, dato clave con cifra que cuenta hacia arriba (anillo en porcentajes,
 * puntos en recuentos pequeños) y subtítulos palabra por palabra. Sin zoom sobre la foto.
 *
 * Las noticias graves (muertes, guerra, atentados, tragedias) NO usan este formato: llevan el formato serio de siempre.
 * REEL_STYLE=serio | infografia fuerza uno; por defecto (auto) se elige según la gravedad.
 */
export type ReelStyle = 'serio' | 'infografia';

const SENSITIVE = new RegExp(
  '\\b(v[ií]ctimas?|tragedia|guerra|bombardeo|ataque armado|conflicto armado|feminicidio|asesinat|secuestr|violaci[oó]n|abuso sexual|suicidi|' +
    'masacre|atentado|genocidio|crimen|cad[aá]ver|homicidi|terrorism|war|victims?|tragedy|massacre|murder|kidnap)\\w*',
  'i'
);

/** Serio para lo grave o sensible; infografía para el resto (política, economía, tecnología, ciencia, sociedad) */
export function chooseReelStyle(news: ProcessedNews): ReelStyle {
  const forced = (process.env.REEL_STYLE || '').toLowerCase();
  if (forced === 'serio' || forced === 'infografia') return forced;
  const text = [news.headline, news.originalTitle, news.subHeadline, news.article?.title].filter(Boolean).join(' ');
  if (SEVERE_EVENT.test(text) || SENSITIVE.test(text)) return 'serio';
  return 'infografia';
}

export interface Stat {
  value: number;
  decimals: number;
  kind: 'pct' | 'count' | 'big';
  /** Texto junto a la cifra: "%", "millones", "mil millones"… */
  suffix: string;
  /** Contexto corto bajo la cifra */
  context: string;
}

const SCALE = new RegExp('^\\s*(mil millones|miles de millones|millones|mill[oó]n|billones|bill[oó]n|miles|mil)\\b', 'i');
const PCT = new RegExp('^\\s*(%|por ciento)');

const TRAILING = new RegExp('^(el|la|los|las|un|una|unos|unas|de|del|al|que|y|e|o|u|en|a|con|por|para|sin|sobre|se|su|sus|lo|le|les|como|más|ha|han)$', 'i');

function parseNumber(raw: string): { value: number; decimals: number } | null {
  let s = raw.replace(/[.,]+$/, '');
  if (!s) return null;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const grp = dec === '.' ? ',' : '.';
    s = s.split(grp).join('').replace(dec, '.');
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const parts = s.split(sep);
    // "1.200" / "12,345,678" → miles; "3,5" / "2.75" → decimales
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3 && parts[0] !== '0')) s = parts.join('');
    else s = `${parts[0]}.${parts[1]}`;
  }
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  const decimals = s.includes('.') ? Math.min(2, s.split('.')[1].length) : 0;
  return { value, decimals };
}

/** Cifra más llamativa de una frase (porcentajes primero; años y números sueltos menores de 2 no cuentan) */
export function extractStat(text: string): Stat | null {
  const re = /\d[\d.,]*/g;
  let best: (Stat & { score: number }) | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const num = parseNumber(m[0]);
    if (!num) continue;
    const after = text.slice(m.index + m[0].length);
    const before = text.slice(0, m.index);
    const pct = PCT.test(after);
    const scale = after.match(SCALE);
    if (!pct && !scale && num.value >= 1900 && num.value <= 2100 && num.decimals === 0) continue; // año
    if (!pct && num.value < 2) continue;
    if (pct && num.value > 100) continue;
    const suffix = pct ? '%' : scale ? scale[1].toLowerCase().replace('miles de millones', 'mil millones') : '';
    const consumed = (pct ? after.match(PCT)![0].length : scale ? scale[0].length : 0);
    const rest = after.slice(consumed).replace(/^[\s,.:;]+/, '');
    const words = (rest || before).replace(/[«»"“”()]/g, '').split(/\s+/).filter(Boolean);
    const pick = rest ? words.slice(0, 6) : words.slice(-6);
    // Sin terminar en artículo o preposición ("de los votantes dijo que la" → "de los votantes dijo")
    while (pick.length > 2 && TRAILING.test(pick[pick.length - 1])) pick.pop();
    const context = pick.join(' ').replace(/[.,;:]+$/, '');
    const kind: Stat['kind'] = pct ? 'pct' : !suffix && num.decimals === 0 && num.value <= 60 ? 'count' : 'big';
    const score = (pct ? 3 : 0) + (suffix ? 2 : 0) + (kind === 'count' ? 1 : 0);
    if (!best || score > best.score) best = { value: num.value, decimals: num.decimals, kind, suffix, context, score };
  }
  if (!best) return null;
  const { score: _s, ...stat } = best;
  return stat;
}

export interface InfoSection {
  kind: 'hook' | 'beat' | 'close';
  start: number;
  end: number;
  chunks: { start: number; end: number; words: { t: number; text: string }[] }[];
  /** Texto de la frase (para buscar su cifra) */
  text: string;
}

export interface Pic { src: string; credit?: string }

interface Opts {
  news: ProcessedNews;
  /** Imágenes verificadas del Reel (la de la noticia primero); cada escena de foto usa una distinta */
  photos: Pic[];
  sections: InfoSection[];
  total: number;
  fade: number;
  W: number;
  H: number;
}

/** Página HTML animada: window.render(t) coloca todo en el instante t y devuelve una clave de "fotograma cambiado" */
/** Color de acento por sección: cada tema se reconoce de un vistazo (los subtítulos conservan el rojo de la marca) */
const ACCENTS: Record<string, string> = {
  'ECONOMÍA GLOBAL': '#22c55e',
  'TECNOLOGÍA & IA': '#38bdf8',
  'SEGURIDAD & DEFENSA': '#f59e0b',
  'PODER & SOCIEDAD': '#a78bfa',
  GEOPOLÍTICA: '#ef4444',
};

export function infographicHtml({ news, sections, total, fade, W, H, photos }: Opts): string {
  const accent = ACCENTS[String(news.category)] || '#ef4444';
  const pics = photos.filter((p) => p && p.src);
  const pic = (k: number) => (pics.length ? pics[k % pics.length] : null);
  const imgTag = (p: Pic | null, pos: string) =>
    p ? `<img src="${escapeHtml(p.src)}" referrerpolicy="no-referrer" style="object-position:${pos}" onerror="this.remove()">` : '';
  // Sin ninguna imagen verificada, el marco muestra la frase en letras grandes (nunca un recuadro vacío ni una imagen que no viene al caso)
  const quote = (text: string) => (pics.length ? '' : `<div class="qt">${escapeHtml(text)}</div>`);
  const creditTag = (p: Pic | null) => (p?.credit ? `<div class="credit">Foto: ${escapeHtml(p.credit)}</div>` : '');
  const category = escapeHtml(String(news.category || 'ACTUALIDAD').toUpperCase());
  const site = (process.env.PUBLIC_SITE_URL || 'puntociegoglobal.pages.dev').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const beatsTotal = sections.filter((s) => s.kind === 'beat').length;
  const framings = pics.length > 1 ? ['50% 30%'] : ['50% 30%', '25% 30%', '75% 30%'];
  const labels = ['EL CONTEXTO', 'LA CLAVE', 'LO QUE SIGUE', 'EL DETALLE'];

  // Hasta 2 escenas de cifra, con las cifras más llamativas de los puntos del guion
  const stats = new Map<number, Stat>();
  sections.forEach((s, i) => {
    if (s.kind !== 'beat') return;
    const st = extractStat(s.text);
    if (st) stats.set(i, st);
  });
  const chosen = new Set(
    Array.from(stats.entries())
      .sort((a, b) => (b[1].kind === 'pct' ? 2 : b[1].suffix ? 1 : 0) - (a[1].kind === 'pct' ? 2 : a[1].suffix ? 1 : 0))
      .slice(0, 2)
      .map(([i]) => i)
  );

  const R = 250; // radio del anillo
  const C = 2 * Math.PI * R;
  let beat = 0;
  const scenes: any[] = [];
  const layers = sections
    .map((s, i) => {
      if (s.kind === 'hook') {
        scenes.push({ type: 'hook' });
        return `<section id="s${i}" class="scene"><div class="kick"><i></i>${category}</div>
          <div class="frame hookf" id="f${i}">${imgTag(pic(0), '50% 30%')}${quote(news.article?.title || news.headline || s.text)}</div>${creditTag(pic(0))}</section>`;
      }
      if (s.kind === 'beat') {
        const label = labels[beat % labels.length];
        const pos = framings[beat % framings.length];
        const side = beat % 2 === 0 ? 1 : -1;
        const p = pic(pics.length > 1 ? beat + 1 : 0);
        beat++;
        const st = chosen.has(i) ? stats.get(i)! : null;
        if (st) {
          scenes.push({ type: 'stat', stat: st });
          const dots = st.kind === 'count' ? Array.from({ length: st.value }, () => '<b class="dot"></b>').join('') : '';
          const ring =
            st.kind === 'pct'
              ? `<svg class="ring" viewBox="0 0 600 600"><circle cx="300" cy="300" r="${R}" class="rbg"/><circle cx="300" cy="300" r="${R}" class="rfg" id="r${i}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/></svg>`
              : '';
          return `<section id="s${i}" class="scene"><div class="kick"><i></i>EL DATO</div>
            <div class="stat ${st.kind}">${ring}<div class="numrow"><span class="num" id="n${i}">0</span><span class="suf">${escapeHtml(st.suffix)}</span></div>
            <div class="ctx">${escapeHtml(st.context)}</div>${dots ? `<div class="dots" id="d${i}">${dots}</div>` : ''}</div>
            <div class="step"><b>${beat}</b> / ${beatsTotal}</div></section>`;
        }
        scenes.push({ type: 'photo', side });
        return `<section id="s${i}" class="scene"><div class="kick"><i></i>${label}</div>
          <div class="frame" id="f${i}">${imgTag(p, pos)}${quote(s.text)}</div>${creditTag(p)}
          <div class="step"><b>${beat}</b> / ${beatsTotal}</div></section>`;
      }
      scenes.push({ type: 'close' });
      return `<section id="s${i}" class="scene close">
        <div class="logo">PUNTO<br>CIEGO<b>.</b></div><div class="rule"></div>
        <div class="cta">LINK EN EL PERFIL</div><div class="site">${escapeHtml(site)}</div></section>`;
    })
    .join('');

  const data = JSON.stringify({
    total,
    fade,
    C,
    scenes,
    sections: sections.map((s) => ({ start: s.start, end: s.end, chunks: s.chunks })),
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;900&family=Playfair+Display:wght@900&display=block">
<style>
  :root{--accent:${accent}}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${W}px;height:${H}px;overflow:hidden;color:#fff;font-family:Montserrat,"DejaVu Sans",Arial,sans-serif;
    background:radial-gradient(ellipse at 50% 28%,#16264d 0%,#0a1330 55%,#050a1c 100%)}
  body:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.04) 0 110px,rgba(255,255,255,0) 110px 220px)}
  .scene{position:absolute;inset:0;opacity:0;overflow:hidden}
  .mark{position:absolute;top:108px;right:64px;font-family:"Playfair Display",Georgia,serif;font-size:40px;font-weight:900;letter-spacing:.01em;opacity:.95}
  .mark b{color:#ef4444}
  .kick{position:absolute;left:70px;right:70px;top:250px;font-size:60px;font-weight:900;letter-spacing:.01em;display:flex;align-items:center;gap:22px;text-transform:uppercase}
  .kick i{display:block;width:14px;height:64px;background:var(--accent);border-radius:4px;flex:none}
  .frame{position:absolute;left:80px;right:80px;top:410px;height:640px;border:12px solid #fff;border-radius:8px;overflow:hidden;background:#1e293b;
    box-shadow:0 34px 80px rgba(0,0,0,.55);will-change:transform}
  .frame.hookf{top:380px;height:700px}
  .frame img{width:100%;height:100%;object-fit:cover;display:block}
  .frame .qt{height:100%;display:flex;align-items:center;padding:56px;font-size:64px;font-weight:800;line-height:1.2;color:#f1f5f9;background:linear-gradient(135deg,#1e293b,#0f172a)}
  .step{position:absolute;top:1648px;left:0;right:0;text-align:center;font-size:30px;font-weight:700;letter-spacing:.2em;color:rgba(255,255,255,.6)}
  .step b{color:var(--accent)}
  .credit{position:absolute;left:80px;right:80px;top:1098px;text-align:center;font-size:26px;font-weight:600;color:rgba(255,255,255,.6)}
  .stat{position:absolute;left:60px;right:60px;top:380px;height:720px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .stat .ring{position:absolute;top:50px;left:50%;width:620px;height:620px;margin-left:-310px;transform:rotate(-90deg)}
  .rbg{fill:none;stroke:rgba(255,255,255,.12);stroke-width:34}
  .rfg{fill:none;stroke:var(--accent);stroke-width:34;stroke-linecap:round}
  .numrow{position:relative;display:flex;align-items:baseline;justify-content:center;gap:16px;white-space:nowrap}
  .num{font-size:250px;line-height:1;font-weight:900;letter-spacing:-.03em;text-shadow:0 8px 30px rgba(0,0,0,.5)}
  .suf{font-size:78px;font-weight:900;color:var(--accent)}
  .stat.pct{justify-content:flex-start;padding-top:50px}
  .stat.pct .num{font-size:200px}
  .stat.pct .numrow{margin-top:210px}
  .ctx{position:relative;margin-top:26px;max-width:900px;font-size:54px;line-height:1.2;font-weight:700;color:rgba(255,255,255,.88)}
  .stat.pct .ctx{margin-top:225px;font-size:50px}
  .dots{position:relative;margin-top:44px;display:flex;flex-wrap:wrap;justify-content:center;gap:14px;max-width:900px}
  .dot{display:block;width:38px;height:38px;border-radius:50%;background:var(--accent);opacity:0;box-shadow:0 0 18px var(--accent)}
  .close{display:flex;flex-direction:column;align-items:center;padding-top:330px;text-align:center}
  .logo{font-family:"Playfair Display",Georgia,serif;font-size:132px;font-weight:900;line-height:1}
  .logo b{color:#ef4444}
  .rule{width:150px;height:7px;background:#ef4444;margin:56px auto 0}
  .cta{position:absolute;top:1560px;left:50%;transform:translateX(-50%);border:4px solid #f87171;color:#f87171;border-radius:999px;padding:22px 48px;font-size:40px;font-weight:900;letter-spacing:.06em;white-space:nowrap}
  .site{position:absolute;top:1690px;left:0;right:0;color:#94a3b8;font-size:34px;font-weight:700}
  .bar{position:absolute;top:0;left:0;height:10px;background:#ef4444;width:0}
  #cap{position:absolute;left:60px;right:60px;top:1170px;height:420px;display:flex;align-items:center;justify-content:center;text-align:center}
  #cap .line{font-size:84px;line-height:1.3;font-weight:900;text-transform:uppercase;transform-origin:50% 60%;
    text-shadow:-4px -4px 0 #000,4px -4px 0 #000,-4px 4px 0 #000,4px 4px 0 #000,0 10px 24px rgba(0,0,0,.6)}
  #cap span{display:inline-block;padding:2px 18px;margin:4px 2px;border-radius:14px;color:#fff;transform-origin:50% 70%}
  #cap span.on{background:#dc2626;text-shadow:0 4px 10px rgba(0,0,0,.35);box-shadow:0 10px 30px rgba(220,38,38,.45)}
</style></head><body>
${layers}
<div class="mark" id="mark">PUNTO CIEGO<b>.</b></div>
<div id="cap"></div>
<div class="bar" id="bar"></div>
<script>
  var D = ${data};
  var N = D.sections.length;
  var scenes = D.sections.map(function (_, i) { return document.getElementById('s' + i); });
  var cap = document.getElementById('cap'), bar = document.getElementById('bar'), mark = document.getElementById('mark');
  var shown = '';
  function ease(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }
  function back(x) { x = Math.max(0, Math.min(1, x)); var c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function fmt(v, dec) { return v.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  window.render = function (t) {
    var cur = 0;
    D.sections.forEach(function (s, i) { if (t >= s.start) cur = i; });
    var key = [cur];
    scenes.forEach(function (el, i) {
      var s = D.sections[i];
      var visible = i <= cur && t < (D.sections[i + 1] ? D.sections[i + 1].start + D.fade : 1e9);
      el.style.opacity = !visible ? 0 : i === 0 ? 1 : ease((t - s.start) / D.fade);
      if (!visible) return;
      var sc = D.scenes[i], p = (t - s.start) / 0.7;
      if (sc.type === 'photo' || sc.type === 'hook') {
        var f = document.getElementById('f' + i), side = sc.side || 1, q = back(p);
        f.style.transform = 'translateX(' + ((1 - Math.min(1, ease(p))) * 900 * side).toFixed(1) + 'px) rotate(' + (side * (2.4 - 0.6 * ease(p)) * (sc.type === 'hook' ? 0.6 : 1)).toFixed(2) + 'deg) scale(' + (0.94 + 0.06 * q).toFixed(3) + ')';
        if (i === cur) key.push(Math.round(Math.min(1, p) * 30));
      } else if (sc.type === 'stat') {
        var st = sc.stat, pp = ease((t - s.start) / 1.0), val = st.value * pp;
        document.getElementById('n' + i).textContent = fmt(val, pp >= 1 ? st.decimals : 0);
        var r = document.getElementById('r' + i);
        if (r) r.setAttribute('stroke-dashoffset', (D.C * (1 - Math.min(100, val) / 100)).toFixed(1));
        var d = document.getElementById('d' + i);
        if (d) {
          var shownDots = Math.floor(val + 0.0001);
          Array.prototype.forEach.call(d.children, function (dot, k) {
            var a = k < shownDots ? 1 : 0;
            dot.style.opacity = a;
            dot.style.transform = 'scale(' + (a ? (k === shownDots - 1 ? 1 + 0.3 * (1 - pp) : 1) : 0.4) + ')';
          });
        }
        if (i === cur) key.push(Math.round(Math.min(1, (t - s.start) / 1.0) * 30));
      }
    });
    bar.style.width = (Math.min(1, t / D.total) * 100).toFixed(2) + '%';
    mark.style.opacity = cur === N - 1 ? 1 - ease((t - D.sections[cur].start) / D.fade) : 0.95;

    var chunk = null, active = -1;
    D.sections[cur].chunks.forEach(function (c) { if (t >= c.start && t < c.end) chunk = c; });
    if (!chunk) { if (shown) { cap.innerHTML = ''; shown = ''; } return key.join(':') + ':nc'; }
    chunk.words.forEach(function (w, i) { if (t >= w.t) active = i; });
    var ck = cur + ':' + chunk.start + ':' + active;
    if (ck !== shown) {
      cap.innerHTML = '<div class="line">' + chunk.words.map(function (w, i) {
        return '<span class="' + (i === active ? 'on' : '') + '">' + esc(w.text) + '</span>';
      }).join('') + '</div>';
      shown = ck;
    }
    var line = cap.firstChild, inP = ease((t - chunk.start) / 0.14);
    line.style.transform = 'translateY(' + ((1 - inP) * 40).toFixed(1) + 'px) scale(' + (0.86 + 0.14 * inP).toFixed(3) + ')';
    line.style.opacity = inP.toFixed(3);
    if (active >= 0) {
      var popP = ease((t - chunk.words[active].t) / 0.16);
      line.children[active].style.transform = 'scale(' + (1.14 - 0.14 * popP).toFixed(3) + ')';
    }
    return key.join(':') + ':' + ck + ':' + Math.round(inP * 20) + ':' + bar.style.width;
  };
</script></body></html>`;
}
