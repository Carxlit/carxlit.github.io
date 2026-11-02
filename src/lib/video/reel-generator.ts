import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { ProcessedNews, VideoScript } from '@/types/news';
import { renderHtmlToJpeg, escapeHtml } from '@/lib/news/card-generator';

/**
 * Reels narrados (1080×1920, 25–45 s) sin servicios de pago:
 *  - diapositivas HTML renderizadas con el mismo Chromium de las tarjetas,
 *  - voz en español con Piper (TTS de código abierto que corre en GitHub Actions),
 *  - montaje con ffmpeg (zoom suave, una diapositiva por frase: el texto en pantalla ES el subtítulo).
 *
 * Configuración (variables de entorno):
 *  PIPER_PYTHON   intérprete con `piper-tts` instalado (por defecto python3 / python en Windows)
 *  PIPER_VOICE    voz (por defecto es_MX-claude-high) · PIPER_DATA_DIR carpeta de voces (~/.cache/piper)
 *  FFMPEG_PATH    binario de ffmpeg (por defecto "ffmpeg")
 */

const W = 1080;
const H = 1920;
const FPS = 30;
/** Silencio tras cada frase para que respire */
const PAD_SECONDS = 0.45;

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

const sentenceCase = (s: string) => {
  const lower = s.toLocaleLowerCase('es');
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
};

/** Guion de la IA; si la noticia es anterior a esta función, se arma con el titular y los datos clave */
export function scriptFor(news: ProcessedNews): VideoScript {
  if (news.videoScript && news.videoScript.hook && news.videoScript.beats?.length) return news.videoScript;
  const facts = (news.article?.keyFacts || []).filter(Boolean).slice(0, 3);
  const beats = facts.length >= 2 ? facts : [news.subHeadline, news.blindSpotAngle].filter(Boolean).slice(0, 3) as string[];
  return {
    hook: news.article?.title || sentenceCase(news.headline || 'Lo que los titulares no te cuentan'),
    beats: beats.length ? beats : [news.subHeadline || news.headline],
    close: 'Lee el análisis completo en el enlace de nuestro perfil.',
  };
}

function slideHtml(opts: {
  kind: 'hook' | 'beat' | 'close';
  text: string;
  index: number;
  total: number;
  news: ProcessedNews;
}): string {
  const { kind, text, index, total, news } = opts;
  const photo = news.rawImageUrl ? news.rawImageUrl.replace(/&amp;/g, '&') : '';
  const photoTag = photo && /^https?:\/\//.test(photo)
    ? `<img class="photo" src="${escapeHtml(photo)}" referrerpolicy="no-referrer" onerror="this.remove()">`
    : '';
  const category = escapeHtml(String(news.category || 'ACTUALIDAD').toUpperCase());
  const size = kind === 'hook' ? (text.length > 90 ? 76 : 88) : text.length > 140 ? 58 : text.length > 95 ? 66 : 74;
  const dots = Array.from({ length: total }, (_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('');
  const site = (process.env.PUBLIC_SITE_URL || 'puntociegoglobal.pages.dev').replace(/^https?:\/\//, '').replace(/\/+$/, '');

  if (kind === 'close') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{width:${W}px;height:${H}px;background:radial-gradient(circle at 50% 35%,#1e293b 0%,#050811 70%);color:#fff;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;display:flex;flex-direction:column;
        align-items:center;justify-content:center;text-align:center;padding:0 90px}
      .logo{font-family:Georgia,"Times New Roman",serif;font-size:118px;font-weight:900;line-height:1}
      .logo b{color:#dc2626}
      .rule{width:140px;height:6px;background:#dc2626;margin:56px auto}
      p{font-size:54px;font-weight:700;line-height:1.25;color:#e2e8f0}
      .cta{margin-top:70px;display:inline-block;border:3px solid #f43f5e;color:#f43f5e;border-radius:999px;padding:22px 46px;
        font-size:38px;font-weight:900;letter-spacing:.06em}
      .site{margin-top:34px;color:#94a3b8;font-size:32px;font-weight:600}
    </style></head><body>
      <div class="logo">PUNTO<br>CIEGO<b>.</b></div><div class="rule"></div>
      <p>${escapeHtml(text)}</p>
      <div class="cta">LINK EN EL PERFIL</div><div class="site">${escapeHtml(site)}</div>
    </body></html>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${W}px;height:${H}px;background:#050811;color:#fff;overflow:hidden;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
    .bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 20%,#1e293b 0%,#050811 75%)}
    .media{position:absolute;left:0;right:0;top:200px;height:${kind === 'hook' ? 940 : 780}px;overflow:hidden}
    .photo{width:100%;height:100%;object-fit:cover;object-position:center 30%;filter:contrast(1.05) saturate(1.1)}
    .media:after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,rgba(5,8,17,.35) 0%,transparent 30%,rgba(5,8,17,.97) 100%)}
    .brand{position:absolute;top:110px;left:80px;right:80px;display:flex;justify-content:space-between;align-items:center}
    .logo{font-family:Georgia,"Times New Roman",serif;font-size:44px;font-weight:900}
    .logo b{color:#dc2626}
    .dots{display:flex;gap:10px}.dots i{width:34px;height:8px;border-radius:4px;background:rgba(255,255,255,.25);display:block}
    .dots i.on{background:#f43f5e}
    .text{position:absolute;left:80px;right:110px;top:${kind === 'hook' ? 1080 : 1000}px}
    .cat{display:flex;align-items:center;gap:16px;color:#f43f5e;font-size:30px;font-weight:900;letter-spacing:.16em;margin-bottom:34px}
    .cat i{width:44px;height:5px;background:#f43f5e;display:block}
    h1{font-size:${size}px;line-height:1.14;font-weight:900;letter-spacing:-.01em}
    .num{color:#f43f5e;font-size:30px;font-weight:900;letter-spacing:.12em;margin-bottom:26px}
  </style></head><body>
    <div class="bg"></div>
    <div class="media">${photoTag}</div>
    <div class="brand"><div class="logo">PUNTO CIEGO<b>.</b></div><div class="dots">${dots}</div></div>
    <div class="text">
      ${kind === 'hook' ? `<div class="cat"><i></i>${category}</div>` : `<div class="num">${index} / ${total - 2}</div>`}
      <h1>${escapeHtml(text)}</h1>
    </div>
  </body></html>`;
}

function piperPython(): string {
  return process.env.PIPER_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
}

function synthesize(text: string, outWav: string) {
  const voice = process.env.PIPER_VOICE || 'es_MX-claude-high';
  const dataDir = process.env.PIPER_DATA_DIR || path.join(os.homedir(), '.cache', 'piper');
  const res = spawnSync(piperPython(), ['-m', 'piper', '-m', voice, '--data-dir', dataDir, '-f', outWav, '--', text], {
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (res.status !== 0 || !fs.existsSync(outWav)) {
    throw new Error(`Piper falló: ${(res.stderr || res.error?.message || '').slice(-300)}`);
  }
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

function runFfmpeg(args: string[]) {
  const res = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    encoding: 'utf8',
    timeout: 6 * 60_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`ffmpeg falló: ${(res.stderr || res.error?.message || '').slice(-500)}`);
}

export async function generateNewsReel(news: ProcessedNews): Promise<string> {
  const script = scriptFor(news);
  const lines: { kind: 'hook' | 'beat' | 'close'; text: string }[] = [
    { kind: 'hook', text: script.hook },
    ...script.beats.map((t) => ({ kind: 'beat' as const, text: t })),
    { kind: 'close', text: script.close },
  ];

  const work = fs.mkdtempSync(path.join(os.tmpdir(), `reel-${(news.id || 'x').slice(0, 12)}-`));
  const durations: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    await renderHtmlToJpeg(slideHtml({ ...lines[i], index: i, total: lines.length, news }), path.join(work, `s${i}.jpg`), W, H);
    const wav = path.join(work, `a${i}.wav`);
    synthesize(lines[i].text, wav);
    durations.push(wavDurationSeconds(wav) + PAD_SECONDS);
  }

  const n = lines.length;
  const inputs: string[] = [];
  for (let i = 0; i < n; i++) inputs.push('-i', path.join(work, `s${i}.jpg`));
  for (let i = 0; i < n; i++) inputs.push('-i', path.join(work, `a${i}.wav`));

  const filters: string[] = [];
  for (let i = 0; i < n; i++) {
    const frames = Math.round(durations[i] * FPS);
    // Zoom lento (Ken Burns) sobre la imagen ampliada para que no tiemble
    filters.push(
      `[${i}:v]scale=1620:2880:in_range=pc:out_range=tv,zoompan=z='min(zoom+0.0007,1.07)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[v${i}]`
    );
    filters.push(`[${n + i}:a]aresample=44100,apad,atrim=0:${durations[i].toFixed(3)}[a${i}]`);
  }
  filters.push(`${Array.from({ length: n }, (_, i) => `[v${i}][a${i}]`).join('')}concat=n=${n}:v=1:a=1[vout][aout]`);

  const out = path.join(work, 'reel.mp4');
  runFfmpeg([
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-r', String(FPS), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
    '-movflags', '+faststart',
    out,
  ]);
  console.log(`[Reel] Video listo (${durations.reduce((a, b) => a + b, 0).toFixed(1)} s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB): ${out}`);
  return out;
}
