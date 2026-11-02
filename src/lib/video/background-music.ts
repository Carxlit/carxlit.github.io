import fs from 'fs';

/**
 * Música de fondo ORIGINAL para los Reels, sintetizada aquí mismo (sin bibliotecas ni canciones de terceros):
 * así Instagram/Facebook no pueden reclamar derechos de autor. Estilo "fondo de noticiero": pad suave,
 * arpegio tenue y un pulso grave. Cada noticia usa una progresión, tonalidad y tempo distintos (según su id).
 */
const SR = 44100;

const NOTE = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);

/** Progresiones (grados en semitonos sobre la tónica): sobrias, ni alegres ni dramáticas */
const PROGRESSIONS: number[][][] = [
  // i – VI – III – VII (menor, tensión suave)
  [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
  // i – iv – VI – v
  [[0, 3, 7], [5, 8, 12], [-4, 0, 3], [7, 10, 14]],
  // I – V – vi – IV (mayor, neutro)
  [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]],
  // vi – IV – I – V
  [[-3, 0, 4], [-7, -3, 0], [0, 4, 7], [-5, -1, 2]],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Escribe un WAV (16 bits, estéreo) de `seconds` segundos con la música de fondo */
export function generateBackgroundMusic(outPath: string, seconds: number, seed = 'punto-ciego') {
  const h = hash(seed);
  const prog = PROGRESSIONS[h % PROGRESSIONS.length];
  const tonic = [-12, -10, -9, -7, -5][(h >>> 3) % 5]; // A3, B3, C4, D4, E4 (relativo a A4)
  const bpm = 84 + ((h >>> 6) % 4) * 6; // 84–102
  const beat = 60 / bpm;
  const bar = beat * 4;
  const n = Math.ceil(seconds * SR);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const barIdx = Math.floor(t / bar);
    const inBar = t - barIdx * bar;
    const chord = prog[barIdx % prog.length];
    const prev = prog[(barIdx + prog.length - 1) % prog.length];
    // Fundido entre acordes en el primer medio segundo del compás
    const xf = Math.min(1, inBar / 0.6);

    let pad = 0;
    const padVoice = (semis: number[], gain: number) => {
      let v = 0;
      for (const s of semis) {
        const f = NOTE(tonic + s);
        v += Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.003 * t) * 0.8 + Math.sin(2 * Math.PI * f * 2 * t) * 0.12;
      }
      return v * gain;
    };
    pad = padVoice(chord, xf) + padVoice(prev, 1 - xf);
    // Respiración lenta del pad
    pad *= 0.045 * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.11 * t));

    // Arpegio en corcheas, una octava arriba, con ataque de "pulsación"
    const eighth = beat / 2;
    const step = Math.floor(inBar / eighth);
    const sinceNote = inBar - step * eighth;
    const arpNote = chord[[0, 1, 2, 1, 0, 2, 1, 2][step % 8]] + 12;
    const fa = NOTE(tonic + arpNote);
    const arp = (Math.sin(2 * Math.PI * fa * t) + 0.3 * Math.sin(2 * Math.PI * fa * 2 * t)) * Math.exp(-sinceNote / 0.22) * 0.05;

    // Pulso grave en negras (tónica del acorde, dos octavas abajo)
    const sinceBeat = inBar % beat;
    const fb = NOTE(tonic + chord[0] - 12);
    const bass = Math.sin(2 * Math.PI * fb * t) * Math.exp(-sinceBeat / 0.3) * 0.11;

    // Estéreo: arpegio un poco a la derecha, pad abierto
    left[i] = pad + bass + arp * 0.7;
    right[i] = pad * 0.95 + bass + arp;
  }

  // Suavizado (paso bajo de un polo, ~2,5 kHz), entrada y salida en fundido, normalización
  const a = Math.exp((-2 * Math.PI * 2500) / SR);
  let pl = 0;
  let pr = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    pl = (1 - a) * left[i] + a * pl;
    pr = (1 - a) * right[i] + a * pr;
    const t = i / SR;
    const fade = Math.min(1, t / 1.5, (seconds - t) / 2);
    left[i] = pl * Math.max(0, fade);
    right[i] = pr * Math.max(0, fade);
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
