import fs from 'fs';

/**
 * Música de fondo ORIGINAL para los Reels, sintetizada aquí mismo (sin bibliotecas ni canciones de terceros):
 * así Instagram/Facebook no pueden reclamar derechos de autor.
 *
 * Estilo "noticia seria / dramática" (tipo tráiler): ostinato grave de cuerdas en corcheas, colchón de cuerdas
 * oscuro, "braams" de metales graves saturados, golpes de tambor grave (taiko), subida de tensión antes de cada
 * golpe y un tic-tac tenue. Todo pasa por una reverberación de sala grande, que es lo que quita el sonido "de juguete".
 * Siempre en menor. Cada noticia varía progresión, tonalidad y tempo (según su id).
 */
const SR = 44100;
/** Volumen medio (RMS) antes de mezclar: el que el dueño aprobó (≈ -16 dBFS) */
const TARGET_RMS = 0.158;

const NOTE = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);

/** Progresiones menores y oscuras (semitonos sobre la tónica); el II bemol y el VI dan dramatismo */
const PROGRESSIONS: number[][][] = [
  [[0, 3, 7], [-4, 0, 3], [-5, -1, 2], [0, 3, 7]], // i – VI – V – i
  [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-4, 0, 3]], // i – bII – i – VI (frigio, muy tenso)
  [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], // i – VI – VII – V
  [[0, 3, 7], [0, 3, 8], [0, 3, 7], [-5, -1, 2]], // i – i(b6) – i – V
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Diente de sierra limitado en banda (sin alias): base de cuerdas y metales */
function saw(f: number, t: number, k = 12) {
  let v = 0;
  const maxK = Math.min(k, Math.floor(SR / 2 / f));
  for (let j = 1; j <= maxK; j++) v += Math.sin(2 * Math.PI * f * j * t) / j;
  return v;
}

/** "Supersierra": tres sierras desafinadas = sección de cuerdas en vez de un solo oscilador */
const ensemble = (f: number, t: number, k = 10) => (saw(f * 0.996, t, k) + saw(f, t, k) + saw(f * 1.004, t, k)) / 3;

/** Reverberación tipo Freeverb (8 filtros peine + 4 pasa-todo por canal) */
function reverb(input: Float32Array, roomSize: number, damp: number, spread: number): Float32Array {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((l) => ({ buf: new Float32Array(l + spread), i: 0, store: 0 }));
  const alls = [556, 441, 341, 225].map((l) => ({ buf: new Float32Array(l + spread), i: 0 }));
  const out = new Float32Array(input.length);
  for (let n = 0; n < input.length; n++) {
    const x = input[n] * 0.015;
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.i] = x + c.store * roomSize;
      c.i = (c.i + 1) % c.buf.length;
      acc += y;
    }
    for (const a of alls) {
      const b = a.buf[a.i];
      a.buf[a.i] = acc + b * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      acc = b - acc;
    }
    out[n] = acc;
  }
  return out;
}

/** Paso bajo de un polo (in situ) */
function lowpass(x: Float32Array, cutoff: number) {
  const a = Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    y = (1 - a) * x[i] + a * y;
    x[i] = y;
  }
}

/** Escribe un WAV (16 bits, estéreo) de `seconds` segundos con la música de fondo */
export function generateBackgroundMusic(outPath: string, seconds: number, seed = 'punto-ciego') {
  const h = hash(seed);
  const prog = PROGRESSIONS[h % PROGRESSIONS.length];
  const tonic = [-26, -24, -22, -21, -19][(h >>> 3) % 5]; // G2, A2, B2, C3, D3 (relativo a A4)
  const bpm = 84 + ((h >>> 6) % 3) * 6; // 84–96: pesado, no saltarín
  const beat = 60 / bpm;
  const bar = beat * 4;
  const eighth = beat / 2;
  const n = Math.ceil(seconds * SR);

  // Buses separados: lo tonal se oscurece con un filtro; la percusión conserva su ataque
  const tonalL = new Float32Array(n);
  const tonalR = new Float32Array(n);
  const perc = new Float32Array(n);
  let noise = h || 1;
  let noiseLp = 0;

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const barIdx = Math.floor(t / bar);
    const inBar = Math.max(0, t - barIdx * bar); // max(0): el redondeo puede dar -0,0000001 al cambiar de compás
    const chord = prog[barIdx % prog.length];
    const prev = prog[(barIdx + prog.length - 1) % prog.length];
    const xf = Math.min(1, inBar / 1.2);
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    const white = (noise / 4294967296) * 2 - 1;
    noiseLp = noiseLp * 0.97 + white * 0.03; // ruido grave para los tambores

    // 1) Ostinato grave en corcheas: la raíz del acorde, cuerdas "chug" con acento en cada tiempo
    const step = Math.floor(inBar / eighth);
    const sinceStep = inBar - step * eighth;
    const chug = ensemble(NOTE(tonic + chord[0]), t, 14) * Math.min(1, sinceStep / 0.004) * Math.exp(-sinceStep / 0.16) * (step % 2 === 0 ? 0.11 : 0.075);

    // 2) Colchón de cuerdas oscuro con ataque lento (una octava arriba de la raíz)
    let pad = 0;
    for (const s of chord) pad += ensemble(NOTE(tonic + 12 + s), t, 8) * xf;
    if (xf < 1) for (const s of prev) pad += ensemble(NOTE(tonic + 12 + s), t, 8) * (1 - xf);
    pad *= 0.022;

    // 3) "Braam" de metales graves saturados cada dos compases (el golpe dramático)
    const sinceBraam = t % (bar * 2);
    let braam = 0;
    if (sinceBraam < bar * 1.6) {
      for (const s of [0, 7, 12]) braam += ensemble(NOTE(tonic - 12 + chord[0] + s), t, 16);
      braam = Math.tanh(braam * 1.8) * Math.min(1, sinceBraam / 0.06) * Math.exp(-sinceBraam / 1.6) * 0.12;
    }

    // 4) Sub grave sostenido
    const sub = Math.sin(2 * Math.PI * NOTE(tonic - 12 + chord[0]) * t) * 0.07 * xf + Math.sin(2 * Math.PI * NOTE(tonic - 12 + prev[0]) * t) * 0.07 * (1 - xf);

    tonalL[i] = chug + pad * 1.05 + braam + sub;
    tonalR[i] = chug * 0.95 + pad + braam + sub;

    // 5) Tambor grave (taiko) en el tiempo 1 y en el "y" del 3; golpe más grande junto al braam
    const hit = (start: number, gain: number) => {
      const s = inBar - start;
      if (s < 0 || s > 1) return 0;
      return (Math.sin(2 * Math.PI * (42 + 70 * Math.exp(-s / 0.03)) * s) * 0.8 + noiseLp * 6) * Math.exp(-s / 0.28) * gain;
    };
    const big = sinceBraam < 1 ? (Math.sin(2 * Math.PI * (32 + 60 * Math.exp(-sinceBraam / 0.06)) * sinceBraam) + noiseLp * 8) * Math.exp(-sinceBraam / 0.7) * 0.22 : 0;
    // 6) Subida de tensión (ruido que crece) en el último tiempo y medio antes del braam
    const toBraam = bar * 2 - sinceBraam;
    const riser = toBraam < beat * 1.5 ? white * Math.pow(1 - toBraam / (beat * 1.5), 2.5) * 0.05 : 0;
    // 7) Tic-tac tenue en corcheas
    const tick = white * Math.exp(-sinceStep / 0.006) * (step % 2 === 0 ? 0.018 : 0.009);

    perc[i] = hit(0, 0.16) + hit(beat * 2.5, 0.11) + big + riser + tick;
  }

  lowpass(tonalL, 1500);
  lowpass(tonalR, 1500);

  const dryL = new Float32Array(n);
  const dryR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    dryL[i] = tonalL[i] + perc[i];
    dryR[i] = tonalR[i] + perc[i];
  }
  // Reverberación de sala grande (estéreo con longitudes ligeramente distintas)
  const wetL = reverb(dryL, 0.88, 0.4, 0);
  const wetR = reverb(dryR, 0.88, 0.4, 23);

  const left = new Float32Array(n);
  const right = new Float32Array(n);
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fade = Math.max(0, Math.min(1, t / 1.5, (seconds - t) / 2.2));
    left[i] = (dryL[i] * 0.75 + wetL[i] * 2.2) * fade;
    right[i] = (dryR[i] * 0.75 + wetR[i] * 2.2) * fade;
    sumSq += left[i] * left[i] + right[i] * right[i];
  }
  // Mismo volumen medio que la versión aprobada; picos redondeados suavemente (sin recortes ásperos)
  const norm = TARGET_RMS / (Math.sqrt(sumSq / (2 * n)) || 1);

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
    const l = Math.tanh(left[i] * norm * 1.1) / 1.1;
    const r = Math.tanh(right[i] * norm * 1.1) / 1.1;
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(outPath, buf);
}
