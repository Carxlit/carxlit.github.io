import path from 'path';
import { readJsonFile, writeJsonFileAtomic } from '@/lib/storage/json-store';

const PDS = 'https://bsky.social/xrpc';
const SESSION_PATH = path.join(process.cwd(), 'storage', '.bluesky-session.json');
/** El accessJwt dura ~2 h; se renueva antes */
const ACCESS_TTL_MS = 90 * 60 * 1000;

export interface BlueskySession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  identifier: string;
  createdAt: number;
}

let memorySession: BlueskySession | null = null;

function loadSession(identifier: string): BlueskySession | null {
  const s = memorySession || readJsonFile<BlueskySession | null>(SESSION_PATH, null);
  return s && s.identifier === identifier ? s : null;
}

function storeSession(s: BlueskySession) {
  memorySession = s;
  try { writeJsonFileAtomic(SESSION_PATH, s); } catch {}
}

/**
 * Devuelve una sesión válida reutilizándola entre publicaciones y auditorías.
 * Bluesky limita createSession (~30 cada 5 min y ~300 al día): antes se creaba una
 * sesión nueva en cada auditoría (cada 5 min) y en cada post.
 */
export async function getBlueskySession(identifier: string, password: string): Promise<BlueskySession> {
  const cached = loadSession(identifier);
  if (cached && Date.now() - cached.createdAt < ACCESS_TTL_MS) return cached;

  if (cached?.refreshJwt) {
    const res = await fetch(`${PDS}/com.atproto.server.refreshSession`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cached.refreshJwt}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      const s: BlueskySession = { ...data, identifier, createdAt: Date.now() };
      storeSession(s);
      return s;
    }
  }

  const res = await fetch(`${PDS}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error autenticando en Bluesky');
  const s: BlueskySession = { ...data, identifier, createdAt: Date.now() };
  storeSession(s);
  return s;
}

export function invalidateBlueskySession() {
  memorySession = null;
  try { writeJsonFileAtomic(SESSION_PATH, null); } catch {}
}

/**
 * Comprueba la sesión sin crear una nueva si la guardada sigue viva
 */
export async function checkBlueskySession(identifier: string, password: string) {
  const s = await getBlueskySession(identifier, password);
  const res = await fetch(`${PDS}/com.atproto.server.getSession`, {
    headers: { Authorization: `Bearer ${s.accessJwt}` },
    signal: AbortSignal.timeout(6000),
  });
  if (res.status === 401) {
    invalidateBlueskySession();
    return getBlueskySession(identifier, password);
  }
  return s;
}

const segmenter = typeof Intl !== 'undefined' && (Intl as any).Segmenter
  ? new (Intl as any).Segmenter('es', { granularity: 'grapheme' })
  : null;

function graphemes(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (s: any) => s.segment) : Array.from(text);
}

/**
 * Recorta a `max` grafemas (lo que cuenta Bluesky) sin partir palabras ni emojis
 */
export function truncateGraphemes(text: string, max = 300): string {
  const g = graphemes(text);
  if (g.length <= max) return text;
  const cut = g.slice(0, max - 1).join('');
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Facets de AT Protocol para que hashtags y enlaces sean clicables.
 * Los índices son en bytes UTF-8, no en caracteres.
 */
export function buildFacets(text: string) {
  const encoder = new TextEncoder();
  const byteIndex = (charIndex: number) => encoder.encode(text.slice(0, charIndex)).length;
  const facets: any[] = [];

  const urlRe = /https?:\/\/[^\s)]+/g;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(text))) {
    const uri = m[0].replace(/[.,;:!?]+$/, '');
    facets.push({
      index: { byteStart: byteIndex(m.index), byteEnd: byteIndex(m.index + uri.length) },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri }],
    });
  }

  const tagRe = new RegExp('(^|\\s)#([\\p{L}\\p{N}_]+)', 'gu');
  while ((m = tagRe.exec(text))) {
    const start = m.index + m[1].length;
    const tag = m[2];
    if (/^\d+$/.test(tag)) continue;
    facets.push({
      index: { byteStart: byteIndex(start), byteEnd: byteIndex(start + 1 + tag.length) },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag }],
    });
  }

  return facets;
}

export { PDS as BLUESKY_PDS };
