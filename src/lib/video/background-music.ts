import fs from 'fs';

/**
 * Música de fondo ORIGINAL para los Reels, sintetizada aquí mismo (sin bibliotecas ni canciones de terceros):
 * así Instagram/Facebook no pueden reclamar derechos de autor. Estilo "noticiero serio / última hora", intenso:
 * cuerdas en semicorcheas dobladas a la octava, golpes de bronces con síncopa, bombo y caja de marcha,
 * impacto con redoble cada dos compases, nota pedal grave y tic-tac. Siempre en menor. Cada noticia varía progresión, tonalidad y tempo (según su id).
 */
const SR = 44100;
/** Volumen medio (RMS) de la música antes de mezclarla: calibrado con la versión que el dueño aprobó (≈ -16 dBFS) */
const TARGET_RMS = 0.158;

const NOTE = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);

/** Progresiones en menor (grados en semitonos sobre la tónica) */
const PROGRESSIONS: number[][][] = [
  // i – VI – III – VII
  [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
  // i – iv – VI – V (la dominante mayor da tensión de "última hora")
  [[0, 3, 7], [5, 8, 12], [-4, 0, 3], [-5, -1, 2]],
  // i – VII – VI – V
  [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]],
  // i – i – VI – V
  [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-5, -1, 2]],
];

/** Figura de las semicorcheas (índice de la nota del acorde, -1 = octava grave): el "motor" del noticiero */
const OSTINATO = [0, 0, 2, 0, 1, 0, 2, 0, 0, 0, 2, 0, 1, 2, 1, 2];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Onda tipo cuerda/bronce (diente de sierra limitado a `k` armónicos) */
const saw = (f: number, t: number, k = 6) => {
  let v = 0;
  for (let j = 1; j <= k; j++) v += Math.sin(2 * Math.PI * f * j * t) / j;
  return v;
};

/** Escribe un WAV (16 bits, estéreo) de `seconds` segundos con la música de fondo */
export function generateBackgroundMusic(outPath: string, seconds: number, seed = 'punto-ciego') {
  const h = hash(seed);
  const prog = PROGRESSIONS[h % PROGRESSIONS.length];
  const tonic = [-24, -22, -21, -19, -17][(h >>> 3) % 5]; // A2, B2, C3, D3, E3 (relativo a A4)
  const bpm = 120 + ((h >>> 6) % 3) * 4; // 120–128: pulso urgente de "última hora"
  const beat = 60 / bpm;
  const bar = beat * 4;
  const sixteenth = beat / 4;
  const n = Math.ceil(seconds * SR);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const bright = new Float32Array(n); // tic-tac y ataque del timbal: sin el filtro que oscurece lo demás
  let noise = h || 1;

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const barIdx = Math.floor(t / bar);
    // max(0): por redondeo, t - barIdx*bar puede salir -0,0000001 justo al cambiar de compás
    const inBar = Math.max(0, t - barIdx * bar);
    const chord = prog[barIdx % prog.length];
    const prev = prog[(barIdx + prog.length - 1) % prog.length];
    const xf = Math.min(1, inBar / 0.25);
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    const white = (noise / 4294967296) * 2 - 1;

    // Cuerdas staccato en semicorcheas (registro medio), acento en cada tiempo
    const step = Math.floor(inBar / sixteenth);
    const sinceStep = inBar - step * sixteenth;
    const idx = OSTINATO[step % 16];
    const fs = NOTE(tonic + 12 + chord[idx]);
    const accent = step % 4 === 0 ? 1 : 0.7;
    // Cuerdas dobladas a la octava (más cuerpo y brillo) y algo más largas: empujan sin parar
    const strings = (saw(fs, t) + 0.55 * saw(fs * 2, t, 4)) * Math.exp(-sinceStep / 0.065) * 0.055 * accent;

    // Bronces: golpe de acorde en el tiempo 1 (fuerte) y en el "y" del 2 (síncopa), con octava grave
    const stab = (start: number, gain: number) => {
      const since = inBar - start;
      if (since < 0) return 0;
      let v = 0;
      for (const s of chord) v += saw(NOTE(tonic + s), t, 10) + 0.6 * saw(NOTE(tonic - 12 + s), t, 6);
      return v * Math.min(1, since / 0.01) * Math.exp(-since / 0.45) * gain;
    };
    const brass = stab(0, 0.04) + stab(beat * 1.5, 0.025);

    // Nota pedal grave sostenida (tónica de la progresión) y bajo que sigue los acordes
    const pedal = Math.sin(2 * Math.PI * NOTE(tonic - 12) * t) * 0.05;
    const bass = (Math.sin(2 * Math.PI * NOTE(tonic - 12 + chord[0]) * t) * xf + Math.sin(2 * Math.PI * NOTE(tonic - 12 + prev[0]) * t) * (1 - xf)) * 0.06;

    // Latido en cada tiempo (más fuerte en 1 y 3)
    const sinceBeat = inBar % beat;
    const beatNo = Math.floor(inBar / beat);
    const kick = Math.sin(2 * Math.PI * (46 + 60 * Math.exp(-sinceBeat / 0.025)) * sinceBeat) * Math.exp(-sinceBeat / 0.2) * (beatNo % 2 === 0 ? 0.2 : 0.13);
    // Golpe seco en 2 y 4 (como caja de marcha militar), cuerpo tonal; el ruido va en "bright"
    const snareBody = beatNo % 2 === 1 ? Math.sin(2 * Math.PI * 190 * sinceBeat) * Math.exp(-sinceBeat / 0.05) * 0.06 : 0;

    // Impacto cada dos compases: timbal grande + sub que cae de tono
    const sinceTimp = t % (bar * 2);
    const timp = Math.sin(2 * Math.PI * NOTE(tonic - 12) * (1 + 0.2 * Math.exp(-sinceTimp / 0.05)) * sinceTimp) * Math.exp(-sinceTimp / 0.8) * 0.18
      + Math.sin(2 * Math.PI * (35 + 45 * Math.exp(-sinceTimp / 0.08)) * sinceTimp) * Math.exp(-sinceTimp / 0.5) * 0.12;

    // Redoble de timbal que crece en el último tiempo antes de cada impacto
    const toImpact = bar * 2 - sinceTimp;
    const roll = toImpact < beat ? Math.sin(2 * Math.PI * NOTE(tonic - 12) * t) * (1 - toImpact / beat) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 28 * t)) * 0.08 : 0;

    left[i] = strings * 0.85 + brass + pedal + bass + kick + snareBody + timp + roll;
    right[i] = strings + brass * 0.9 + pedal + bass + kick + snareBody + timp + roll;

    // Tic-tac en semicorcheas, ruido de la caja en 2 y 4, golpe del impacto y "subida" de ruido antes de él
    bright[i] =
      white * Math.exp(-sinceStep / 0.008) * (step % 4 === 0 ? 0.03 : 0.013) +
      (beatNo % 2 === 1 ? white * Math.exp(-sinceBeat / 0.07) * 0.07 : 0) +
      white * Math.exp(-sinceTimp / 0.04) * 0.05 +
      (toImpact < beat ? white * Math.pow(1 - toImpact / beat, 2) * 0.035 : 0);
  }

  // Suavizado (paso bajo de un polo, ~3,2 kHz: más presencia), entrada y salida en fundido
  const a = Math.exp((-2 * Math.PI * 3200) / SR);
  let pl = 0;
  let pr = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    pl = (1 - a) * left[i] + a * pl;
    pr = (1 - a) * right[i] + a * pr;
    const t = i / SR;
    const fade = Math.max(0, Math.min(1, t / 1.2, (seconds - t) / 2));
    left[i] = (pl + bright[i]) * fade;
    right[i] = (pr + bright[i]) * fade;
    sumSq += left[i] * left[i] + right[i] * right[i];
  }
  // Mismo volumen medio que la versión aprobada; los picos se redondean suavemente (sin recortes ásperos)
  const rms = Math.sqrt(sumSq / (2 * n)) || 1;
  const norm = TARGET_RMS / rms;
  for (let i = 0; i < n; i++) {
    left[i] = Math.tanh(left[i] * norm * 1.1) / 1.1;
    right[i] = Math.tanh(right[i] * norm * 1.1) / 1.1;
  }

  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(outPath, buf);
}
