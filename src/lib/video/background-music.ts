import fs from 'fs';

/**
 * Música de fondo ORIGINAL para los Reels, sintetizada aquí mismo (sin bibliotecas ni canciones de terceros):
 * así Instagram/Facebook no pueden reclamar derechos de autor. Estilo "cama de noticiero" seria: cuerdas graves
 * cálidas, un ostinato apagado en corcheas, latido grave y un tic-tac muy tenue. Siempre en menor.
 * Cada noticia usa una progresión, tonalidad y tempo distintos (según su id).
 */
const SR = 44100;

const NOTE = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);

/** Progresiones en menor (grados en semitonos sobre la tónica): serias, con tensión contenida */
const PROGRESSIONS: number[][][] = [
  // i – VI – III – VII
  [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
  // i – iv – VI – V (la dominante mayor da tensión de "última hora")
  [[0, 3, 7], [5, 8, 12], [-4, 0, 3], [-5, -1, 2]],
  // i – VII – VI – VII
  [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-2, 2, 5]],
  // i – i – iv – V
  [[0, 3, 7], [0, 3, 7], [5, 8, 12], [-5, -1, 2]],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Onda tipo cuerda (diente de sierra limitado a 6 armónicos): cálida, nada "de juguete" */
const strings = (f: number, t: number) => {
  let v = 0;
  for (let k = 1; k <= 6; k++) v += Math.sin(2 * Math.PI * f * k * t) / k;
  return v;
};

/** Escribe un WAV (16 bits, estéreo) de `seconds` segundos con la música de fondo */
export function generateBackgroundMusic(outPath: string, seconds: number, seed = 'punto-ciego') {
  const h = hash(seed);
  const prog = PROGRESSIONS[h % PROGRESSIONS.length];
  const tonic = [-24, -22, -21, -19, -17][(h >>> 3) % 5]; // A2, B2, C3, D3, E3 (relativo a A4)
  const bpm = 92 + ((h >>> 6) % 4) * 6; // 92–110
  const beat = 60 / bpm;
  const bar = beat * 4;
  const n = Math.ceil(seconds * SR);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const ticks = new Float32Array(n); // el tic-tac va aparte: no pasa por el filtro que oscurece lo demás
  let noise = h || 1;

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const barIdx = Math.floor(t / bar);
    const inBar = t - barIdx * bar;
    const chord = prog[barIdx % prog.length];
    const prev = prog[(barIdx + prog.length - 1) % prog.length];
    // Fundido lento entre acordes (como un arco de cuerdas)
    const xf = Math.min(1, inBar / 0.9);

    const padVoice = (semis: number[], gain: number, detune: number) => {
      let v = 0;
      for (const s of semis) v += strings(NOTE(tonic + 12 + s) * detune, t);
      return v * gain;
    };
    const swell = 0.8 + 0.2 * Math.sin((2 * Math.PI * t) / bar - Math.PI / 2);
    const padL = (padVoice(chord, xf, 0.998) + padVoice(prev, 1 - xf, 0.998)) * 0.03 * swell;
    const padR = (padVoice(chord, xf, 1.002) + padVoice(prev, 1 - xf, 1.002)) * 0.03 * swell;

    // Ostinato apagado en corcheas: tónica y quinta del acorde en registro medio-grave
    const eighth = beat / 2;
    const step = Math.floor(inBar / eighth);
    const sinceNote = inBar - step * eighth;
    const fo = NOTE(tonic + chord[step % 2 === 0 ? 0 : 2]);
    const ostinato = strings(fo, t) * Math.exp(-sinceNote / 0.09) * 0.045;

    // Latido grave en los tiempos 1 y 3 (seno con caída de tono) y bajo sostenido
    const sinceHalf = inBar % (beat * 2);
    const kick = Math.sin(2 * Math.PI * (48 + 40 * Math.exp(-sinceHalf / 0.04)) * sinceHalf) * Math.exp(-sinceHalf / 0.22) * 0.16;
    const sub = Math.sin(2 * Math.PI * NOTE(tonic - 12 + chord[0]) * t) * 0.07 * xf
      + Math.sin(2 * Math.PI * NOTE(tonic - 12 + prev[0]) * t) * 0.07 * (1 - xf);

    left[i] = padL + ostinato * 0.8 + kick + sub;
    right[i] = padR + ostinato + kick + sub;

    // Tic-tac de reloj en corcheas, muy bajo (sensación de "noticia en desarrollo")
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    ticks[i] = ((noise / 4294967296) * 2 - 1) * Math.exp(-sinceNote / 0.012) * (step % 2 === 0 ? 0.02 : 0.012);
  }

  // Suavizado (paso bajo de un polo, ~1,6 kHz: sonido cálido), entrada y salida en fundido, normalización
  const a = Math.exp((-2 * Math.PI * 1600) / SR);
  let pl = 0;
  let pr = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    pl = (1 - a) * left[i] + a * pl;
    pr = (1 - a) * right[i] + a * pr;
    const t = i / SR;
    const fade = Math.min(1, t / 1.5, (seconds - t) / 2);
    left[i] = (pl + ticks[i]) * Math.max(0, fade);
    right[i] = (pr + ticks[i]) * Math.max(0, fade);
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const norm = peak > 0 ? 0.85 / peak : 1;

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
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * norm)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * norm)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(outPath, buf);
}
