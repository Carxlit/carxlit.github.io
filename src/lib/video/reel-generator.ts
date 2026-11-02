import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { ProcessedNews, VideoScript } from '@/types/news';
import { getBrowser, escapeHtml } from '@/lib/news/card-generator';

/**
 * Reels narrados (1080×1920, 25–45 s) sin servicios de pago:
 *  - voz neuronal de Microsoft Edge (edge-tts, gratis) con los tiempos de cada palabra;
 *    si no hay conexión al servicio, cae a Piper (voz local),
 *  - una página HTML animada fotograma a fotograma en el mismo Chromium de las tarjetas:
 *    foto fija (sin zoom), fundidos entre escenas y subtítulos palabra por palabra al ritmo de la voz,
 *  - ffmpeg recibe los fotogramas por tubería y los une con la narración.
 *
 * Configuración (variables de entorno):
 *  REEL_PYTHON / PIPER_PYTHON  intérprete con `edge-tts` (y `piper-tts` para el respaldo)
 *  REEL_VOICE  voz de Edge (por defecto es-CO-GonzaloNeural) · REEL_RATE velocidad (por defecto +8%)
 *  REEL_CAPTIONS  estilo de subtítulos: box (por defecto, MAYÚSCULAS con recuadro rojo) o karaoke (palabra amarilla)
 *  PIPER_VOICE / PIPER_DATA_DIR  voz local de respaldo · FFMPEG_PATH binario de ffmpeg
 */

const W = 1080;
const H = 1920;
const FPS = 30;
/** Respiro tras cada frase y cola final con el logo */
const GAP_SECONDS = 0.3;
const TAIL_SECONDS = 1.2;
/** Fundido entre escenas */
const FADE_SECONDS = 0.3;

const cache = new Map<string, Promise<string>>();

/** Genera (una sola vez por noticia y proceso) el Reel y devuelve la ruta del MP4 */
export function getNewsReel(news: ProcessedNews): Promise<string> {
  const key = news.id || news.originalUrl;
  if (!cache.has(key)) {
    const p = generateNewsReel(news);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key)!;
}

const FIRST_LOWER = new RegExp('^([¿¡"«]?)(\\p{Ll})', 'u');

const sentenceCase = (s: string) => {
  const lower = s.toLocaleLowerCase('es');
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
};

/** Guion de la IA; si la noticia es anterior a esta función, se arma con el titular y los datos clave */
export function scriptFor(news: ProcessedNews): VideoScript {
  if (news.videoScript && news.videoScript.hook && news.videoScript.beats?.length) {
    // Guiones antiguos llegaron en minúsculas: al menos mayúscula inicial en pantalla
    const cap = (s: string) => s.replace(FIRST_LOWER, (_m, p, c) => p + c.toLocaleUpperCase('es'));
    const v = news.videoScript;
    return { hook: cap(v.hook), beats: v.beats.map(cap), close: cap(v.close || 'Lee el análisis completo en el enlace de nuestro perfil.') };
  }
  const facts = (news.article?.keyFacts || []).filter(Boolean).slice(0, 3);
  const beats = facts.length >= 2 ? facts : [news.subHeadline, news.blindSpotAngle].filter(Boolean).slice(0, 3) as string[];
  return {
    hook: news.article?.title || sentenceCase(news.headline || 'Lo que los titulares no te cuentan'),
    beats: beats.length ? beats : [news.subHeadline || news.headline],
    close: 'Lee el análisis completo en el enlace de nuestro perfil.',
  };
}

interface Word { t: number; text: string }
interface Section { kind: 'hook' | 'beat' | 'close'; start: number; end: number; words: Word[] }

function python(): string {
  return process.env.REEL_PYTHON || process.env.PIPER_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
}

function runFfmpeg(args: string[]) {
  const res = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    encoding: 'utf8',
    timeout: 6 * 60_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`ffmpeg falló: ${(res.stderr || res.error?.message || '').slice(-500)}`);
}

/** Duración exacta de un WAV PCM leyendo su cabecera (sin depender de ffprobe) */
export function wavDurationSeconds(file: string): number {
  const buf = fs.readFileSync(file);
  let offset = 12;
  let byteRate = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') byteRate = buf.readUInt32LE(offset + 16);
    if (id === 'data' && byteRate) return size / byteRate;
    offset += 8 + size + (size % 2);
  }
  throw new Error(`WAV sin datos: ${file}`);
}

const WORDLIKE = new RegExp('[\\p{L}\\p{N}]', 'u');

/** Palabras del texto en pantalla (los signos sueltos se pegan a la palabra anterior) */
function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const tok of text.split(/\s+/).filter(Boolean)) {
    if (!WORDLIKE.test(tok) && out.length) out[out.length - 1] += ` ${tok}`;
    else out.push(tok);
  }
  return out;
}

/** Reparte el tiempo de habla en proporción a la longitud de cada palabra */
function proportionalTimes(tokens: string[], from: number, to: number): Word[] {
  const total = tokens.reduce((s, w) => s + w.length + 1, 0) || 1;
  let acc = 0;
  return tokens.map((text) => {
    const t = from + ((to - from) * acc) / total;
    acc += text.length + 1;
    return { t, text };
  });
}

/**
 * Empareja los tiempos que da Edge con las palabras en pantalla. Edge a veces agrupa
 * ("28 años" llega como una sola marca) y omite signos: se cuenta por palabras.
 */
function alignWords(text: string, marks: { t: number; d: number; text: string }[], speechEnd: number): Word[] {
  const tokens = tokenize(text);
  const words: Word[] = [];
  let k = 0;
  for (const m of marks) {
    const n = Math.max(1, m.text.split(/\s+/).filter(Boolean).length);
    for (let j = 0; j < n && k < tokens.length; j++, k++) words.push({ t: m.t + (m.d * j) / n, text: tokens[k] });
  }
  if (k < tokens.length) {
    const from = words.length ? words[words.length - 1].t + 0.2 : 0;
    words.push(...proportionalTimes(tokens.slice(k), from, Math.max(from + 0.3, speechEnd)));
  }
  return words;
}

/** Voz neuronal (Edge): devuelve los WAV por línea y las marcas de tiempo de cada palabra */
function narrateWithEdge(lines: string[], work: string): { wavs: string[]; marks: { t: number; d: number; text: string }[][] } {
  const cfg = path.join(work, 'tts.json');
  fs.writeFileSync(cfg, JSON.stringify({
    voice: process.env.REEL_VOICE || 'es-CO-GonzaloNeural',
    rate: process.env.REEL_RATE || '+8%',
    pitch: process.env.REEL_PITCH || '+0Hz',
    lines,
  }));
  const script = path.join(process.cwd(), 'scripts', 'reel_tts.py');
  const res = spawnSync(python(), [script, cfg, work], { encoding: 'utf8', timeout: 180_000 });
  if (res.status !== 0) throw new Error((res.stderr || res.error?.message || 'sin salida').slice(-300));
  const marks = JSON.parse(fs.readFileSync(path.join(work, 'timings.json'), 'utf8'));
  const wavs = lines.map((_, i) => {
    const wav = path.join(work, `a${i}.wav`);
    runFfmpeg(['-i', path.join(work, `a${i}.mp3`), '-ar', '44100', '-ac', '1', wav]);
    return wav;
  });
  return { wavs, marks };
}

/** Respaldo local sin red: Piper (los tiempos de palabra se estiman) */
function narrateWithPiper(lines: string[], work: string): string[] {
  const voice = process.env.PIPER_VOICE || 'es_MX-claude-high';
  const dataDir = process.env.PIPER_DATA_DIR || path.join(os.homedir(), '.cache', 'piper');
  return lines.map((text, i) => {
    const wav = path.join(work, `p${i}.wav`);
    const res = spawnSync(python(), ['-m', 'piper', '-m', voice, '--data-dir', dataDir, '-f', wav, '--', text], {
      encoding: 'utf8',
      timeout: 120_000,
    });
    if (res.status !== 0 || !fs.existsSync(wav)) throw new Error(`Piper falló: ${(res.stderr || res.error?.message || '').slice(-300)}`);
    return wav;
  });
}

/** Subtítulos en grupos cortos (máx. 3 palabras / 18 letras, cortando en los signos) */
function chunkWords(words: Word[], sectionEnd: number) {
  const chunks: { start: number; end: number; words: Word[] }[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) chunks.push({ start: cur[0].t, end: 0, words: cur });
    cur = [];
  };
  for (const w of words) {
    const len = cur.reduce((s, x) => s + x.text.length + 1, 0);
    if (cur.length >= 3 || (cur.length && len + w.text.length > 18)) flush();
    cur.push(w);
    if (/[.,;:?!…]$/.test(w.text)) flush();
  }
  flush();
  chunks.forEach((c, i) => (c.end = i + 1 < chunks.length ? chunks[i + 1].start : sectionEnd));
  return chunks;
}

function reelHtml(news: ProcessedNews, sections: Section[], total: number): string {
  const photo = news.rawImageUrl ? news.rawImageUrl.replace(/&amp;/g, '&') : '';
  const hasPhoto = /^https?:\/\//.test(photo);
  const category = escapeHtml(String(news.category || 'ACTUALIDAD').toUpperCase());
  const site = (process.env.PUBLIC_SITE_URL || 'puntociegoglobal.pages.dev').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const beatsTotal = sections.filter((s) => s.kind === 'beat').length;
  const img = (cls: string) => (hasPhoto ? `<img class="${cls}" src="${escapeHtml(photo)}" referrerpolicy="no-referrer" onerror="this.remove()">` : '');
  // Encuadres distintos de la misma foto para que cada escena se vea diferente (fijos, sin movimiento)
  const framings = ['50% 30%', '22% 30%', '78% 30%'];

  let beat = 0;
  const layers = sections.map((s, i) => {
    if (s.kind === 'hook') {
      return `<section id="s${i}" class="scene hook">${img('full')}<div class="shade"></div>
        <div class="tag">${category}</div></section>`;
    }
    if (s.kind === 'beat') {
      const pos = framings[beat % framings.length];
      beat++;
      return `<section id="s${i}" class="scene beat">${img('blur')}<div class="dim"></div>
        <div class="card">${img('sharp" style="object-position:' + pos)}</div>
        <div class="step"><b>${beat}</b> / ${beatsTotal}</div></section>`;
    }
    return `<section id="s${i}" class="scene close">
      <div class="logo">PUNTO<br>CIEGO<b>.</b></div><div class="rule"></div>
      <div class="cta">LINK EN EL PERFIL</div><div class="site">${escapeHtml(site)}</div></section>`;
  }).join('');

  const data = JSON.stringify({
    total,
    fade: FADE_SECONDS,
    sections: sections.map((s) => ({ start: s.start, end: s.end, chunks: chunkWords(s.words, s.end) })),
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Playfair+Display:wght@900&display=block">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${W}px;height:${H}px;overflow:hidden;background:#050811;color:#fff;font-family:Montserrat,"DejaVu Sans",Arial,sans-serif}
  .scene{position:absolute;inset:0;opacity:0;overflow:hidden;background:radial-gradient(circle at 50% 30%,#1e293b 0%,#050811 75%)}
  .full{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 30%}
  .shade{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(5,8,17,.55) 0%,rgba(5,8,17,.05) 22%,rgba(5,8,17,.25) 50%,rgba(5,8,17,.92) 78%,#050811 100%)}
  .tag{position:absolute;top:190px;left:70px;background:#dc2626;color:#fff;font-weight:900;font-size:30px;letter-spacing:.14em;padding:12px 24px;border-radius:8px}
  .blur{position:absolute;inset:-80px;width:calc(100% + 160px);height:calc(100% + 160px);object-fit:cover;filter:blur(44px) saturate(1.2)}
  .dim{position:absolute;inset:0;background:rgba(5,8,17,.62)}
  .card{position:absolute;left:60px;right:60px;top:250px;height:760px;border-radius:28px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6);background:#111827}
  .sharp{width:100%;height:100%;object-fit:cover}
  .step{position:absolute;top:1050px;left:0;right:0;text-align:center;font-size:30px;font-weight:700;letter-spacing:.2em;color:rgba(255,255,255,.65)}
  .step b{color:#f43f5e}
  .close{display:flex;flex-direction:column;align-items:center;padding-top:330px;text-align:center}
  .logo{font-family:"Playfair Display",Georgia,serif;font-size:132px;font-weight:900;line-height:1}
  .logo b{color:#dc2626}
  .rule{width:150px;height:7px;background:#dc2626;margin:56px auto 0}
  .cta{position:absolute;top:1560px;left:50%;transform:translateX(-50%);border:4px solid #f43f5e;color:#f43f5e;border-radius:999px;padding:22px 48px;font-size:40px;font-weight:900;letter-spacing:.06em;white-space:nowrap}
  .site{position:absolute;top:1690px;left:0;right:0;color:#94a3b8;font-size:34px;font-weight:700}
  .brand{position:absolute;top:96px;left:70px;font-family:"Playfair Display",Georgia,serif;font-size:42px;font-weight:900;text-shadow:0 2px 12px rgba(0,0,0,.6)}
  .brand b{color:#dc2626}
  .bar{position:absolute;top:0;left:0;height:10px;background:#dc2626;width:0}
  #cap{position:absolute;left:60px;right:60px;top:1170px;height:420px;display:flex;align-items:center;justify-content:center;text-align:center}
  #cap .line{font-size:96px;line-height:1.12;font-weight:900;letter-spacing:-.01em;transform-origin:50% 60%;
    text-shadow:0 6px 0 rgba(0,0,0,.55),0 0 30px rgba(0,0,0,.65)}
  #cap span{display:inline-block;margin:0 .12em;transform-origin:50% 70%}
  #cap span.on{color:#ffd400}
  #cap span.next{color:rgba(255,255,255,.92)}
  /* Estilo "caja": MAYÚSCULAS con contorno y la palabra dicha sobre un recuadro rojo de la marca */
  .box #cap .line{font-size:84px;line-height:1.3;text-transform:uppercase;letter-spacing:0;
    text-shadow:-4px -4px 0 #000,4px -4px 0 #000,-4px 4px 0 #000,4px 4px 0 #000,0 10px 24px rgba(0,0,0,.6)}
  .box #cap span{padding:2px 18px;margin:4px 2px;border-radius:14px}
  .box #cap span.on{color:#fff;background:#dc2626;text-shadow:0 4px 10px rgba(0,0,0,.35);box-shadow:0 10px 30px rgba(220,38,38,.45)}
  .box #cap span.next{color:#fff}
</style></head><body class="${process.env.REEL_CAPTIONS === 'karaoke' ? 'karaoke' : 'box'}">
${layers}
<div class="brand" id="brand">PUNTO CIEGO<b>.</b></div>
<div id="cap"></div>
<div class="bar" id="bar"></div>
<script>
  var D = ${data};
  var scenes = D.sections.map(function (_, i) { return document.getElementById('s' + i); });
  var cap = document.getElementById('cap'), bar = document.getElementById('bar'), brand = document.getElementById('brand');
  var shown = '';
  function ease(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  window.render = function (t) {
    var cur = 0;
    D.sections.forEach(function (s, i) { if (t >= s.start) cur = i; });
    scenes.forEach(function (el, i) {
      var s = D.sections[i];
      var visible = i <= cur && t < (D.sections[i + 1] ? D.sections[i + 1].start + D.fade : 1e9);
      el.style.opacity = !visible ? 0 : i === 0 ? 1 : ease((t - s.start) / D.fade);
    });
    bar.style.width = (Math.min(1, t / D.total) * 100).toFixed(2) + '%';
    brand.style.opacity = cur === D.sections.length - 1 ? 1 - ease((t - D.sections[cur].start) / D.fade) : 1;

    var chunk = null, active = -1;
    D.sections[cur].chunks.forEach(function (c) { if (t >= c.start && t < c.end) chunk = c; });
    if (!chunk) { if (shown) { cap.innerHTML = ''; shown = ''; } return ''; }
    chunk.words.forEach(function (w, i) { if (t >= w.t) active = i; });
    var key = cur + ':' + chunk.start + ':' + active;
    if (key !== shown) {
      cap.innerHTML = '<div class="line">' + chunk.words.map(function (w, i) {
        return '<span class="' + (i === active ? 'on' : i > active ? 'next' : '') + '">' + esc(w.text) + '</span>';
      }).join('') + '</div>';
      shown = key;
    }
    // Entrada del grupo (sube y crece) y "pop" de la palabra que se está diciendo
    var line = cap.firstChild, inP = ease((t - chunk.start) / 0.14);
    line.style.transform = 'translateY(' + ((1 - inP) * 40).toFixed(1) + 'px) scale(' + (0.86 + 0.14 * inP).toFixed(3) + ')';
    line.style.opacity = inP.toFixed(3);
    if (active >= 0) {
      var popP = ease((t - chunk.words[active].t) / 0.16);
      line.children[active].style.transform = 'scale(' + (1.14 - 0.14 * popP).toFixed(3) + ')';
    }
    return key + ':' + Math.round(inP * 20) + ':' + bar.style.width;
  };
</script></body></html>`;
}

/** Pinta cada fotograma en Chromium y lo envía a ffmpeg junto con la narración */
async function renderVideo(html: string, total: number, audio: string, out: string) {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const ff = spawn(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', audio,
    '-map', '0:v', '-map', '1:a',
    '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
    '-shortest', '-movflags', '+faststart',
    out,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  ff.stderr.on('data', (d) => (stderr += d));
  const done = new Promise<void>((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg falló: ${stderr.slice(-500)}`))));
  });

  try {
    try {
      await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });
    } catch {
      // Foto o fuente lenta: se sigue con lo que haya cargado (el degradado cubre el hueco)
    }
    await page.evaluate(() => (document as any).fonts?.ready).catch(() => undefined);

    const frames = Math.ceil(total * FPS);
    let lastKey = '';
    let lastFrame: Buffer | null = null;
    for (let f = 0; f < frames; f++) {
      const key = await page.evaluate((t) => (window as any).render(t), f / FPS);
      // Fotograma idéntico al anterior: se reutiliza (ahorra capturas)
      if (key !== lastKey || !lastFrame) lastFrame = await page.screenshot({ type: 'jpeg', quality: 90 });
      lastKey = key;
      if (!ff.stdin.write(lastFrame)) await new Promise((r) => ff.stdin.once('drain', r));
    }
  } finally {
    ff.stdin.end();
    await page.close().catch(() => undefined);
  }
  await done;
}

export async function generateNewsReel(news: ProcessedNews): Promise<string> {
  const script = scriptFor(news);
  const lines: { kind: Section['kind']; text: string }[] = [
    { kind: 'hook', text: script.hook },
    ...script.beats.map((t) => ({ kind: 'beat' as const, text: t })),
    { kind: 'close', text: script.close },
  ];
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `reel-${(news.id || 'x').slice(0, 12)}-`));
  const texts = lines.map((l) => l.text);

  let wavs: string[];
  let marks: { t: number; d: number; text: string }[][] | null = null;
  let voice = 'Edge';
  try {
    ({ wavs, marks } = narrateWithEdge(texts, work));
  } catch (err: any) {
    console.warn(`[Reel] Voz neuronal no disponible (${err?.message}); se usa Piper`);
    wavs = narrateWithPiper(texts, work);
    voice = 'Piper';
  }

  // Línea de tiempo: cada frase ocupa lo que dura su audio + un respiro
  const sections: Section[] = [];
  let clock = 0;
  lines.forEach((l, i) => {
    const speech = wavDurationSeconds(wavs[i]);
    const len = speech + GAP_SECONDS + (l.kind === 'close' ? TAIL_SECONDS : 0);
    const words = marks?.[i]?.length ? alignWords(l.text, marks[i], speech) : proportionalTimes(tokenize(l.text), 0.05, speech * 0.95);
    sections.push({ kind: l.kind, start: clock, end: clock + len, words: words.map((w) => ({ ...w, t: clock + w.t })) });
    clock += len;
  });
  const total = clock;

  // Narración completa en un solo WAV (cada frase rellenada con silencio hasta su duración)
  const narration = path.join(work, 'narracion.wav');
  const filters = sections.map((s, i) => `[${i}:a]aresample=44100,apad,atrim=0:${(s.end - s.start).toFixed(3)}[a${i}]`);
  filters.push(`${sections.map((_, i) => `[a${i}]`).join('')}concat=n=${sections.length}:v=0:a=1[aout]`);
  runFfmpeg([...wavs.flatMap((w) => ['-i', w]), '-filter_complex', filters.join(';'), '-map', '[aout]', narration]);

  const out = path.join(work, 'reel.mp4');
  await renderVideo(reelHtml(news, sections, total), total, narration, out);
  console.log(`[Reel] Video listo (${total.toFixed(1)} s, voz ${voice}, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB): ${out}`);
  return out;
}
