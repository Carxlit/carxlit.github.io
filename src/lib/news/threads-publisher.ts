import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ProcessedNews, ChannelResult } from '@/types/news';
import { readJsonFile, writeJsonFileAtomic } from '@/lib/storage/json-store';
import { normalizeCaptionForDedupe } from './extra-publishers';

/**
 * Threads (API oficial de Meta, gratis): post con la tarjeta y el enlace al artículo (en Threads los enlaces sí son clicables).
 *
 * El token de Threads dura 60 días y se renueva con la propia API. Como el repositorio es público, el token
 * renovado se guarda CIFRADO (AES-256-GCM) en storage/threads_token.json con la clave THREADS_ENC_KEY (secreto de GitHub).
 * Así se renueva solo, sin que tengas que volver a generarlo.
 *
 * Secretos: THREADS_USER_ID, THREADS_ACCESS_TOKEN (el primero, de THREADS_TOKEN.bat) y THREADS_ENC_KEY.
 */
const API = 'https://graph.threads.net/v1.0';
const STORE_PATH = path.join(process.cwd(), 'storage', 'threads_token.json');
/** Se renueva si el token tiene más de una semana (la API exige al menos 24 h de antigüedad) */
const REFRESH_AFTER_MS = 7 * 86_400_000;

interface StoredToken { iv: string; tag: string; data: string; refreshedAt: string }

const encKey = () => {
  const raw = (process.env.THREADS_ENC_KEY || '').trim();
  return raw ? crypto.createHash('sha256').update(raw).digest() : null;
};

function encrypt(token: string, key: Buffer): StoredToken {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64'), refreshedAt: new Date().toISOString() };
}

function decrypt(s: StoredToken, key: Buffer): string | null {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(s.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(s.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(s.data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function threadsConfigured(): boolean {
  return !!(process.env.THREADS_USER_ID || '').trim() && !!((process.env.THREADS_ACCESS_TOKEN || '').trim() || fs.existsSync(STORE_PATH));
}

/** Token vigente (el guardado cifrado si existe; si no, el del secreto) y renovación semanal */
export async function getThreadsToken(): Promise<string | null> {
  const key = encKey();
  const stored = key ? readJsonFile<StoredToken | null>(STORE_PATH, null) : null;
  let token = (stored && key && decrypt(stored, key)) || (process.env.THREADS_ACCESS_TOKEN || '').trim() || null;
  if (!token) return null;
  const age = stored ? Date.now() - new Date(stored.refreshedAt).getTime() : Infinity;
  if (key && age > REFRESH_AFTER_MS) {
    try {
      const res = await fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(token)}`, {
        signal: AbortSignal.timeout(15_000),
      });
      const data: any = await res.json();
      if (data.access_token) {
        token = data.access_token as string;
        writeJsonFileAtomic(STORE_PATH, encrypt(token, key));
        console.log(`[Threads] Token renovado (vence en ${Math.round((data.expires_in || 0) / 86400)} días)`);
      } else {
        console.warn('[Threads] No se pudo renovar el token:', data.error?.message);
      }
    } catch (err: any) {
      console.warn('[Threads] Renovación del token falló:', err?.message);
    }
  }
  return token;
}

/** Texto: el post corto + el enlace (máx. 500 caracteres) */
export function buildThreadsText(news: ProcessedNews): string {
  const body = (news.blueskyPost || news.subHeadline || news.headline).trim();
  const link = news.articleUrl ? `\n\n🔗 ${news.articleUrl}` : '';
  const room = 500 - link.length;
  return `${body.length > room ? `${body.slice(0, room - 1).replace(/\s+\S*$/, '')}…` : body}${link}`;
}

function publicImageUrl(news: ProcessedNews): string | undefined {
  const site = (process.env.PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  const slug = news.article?.slug;
  if (!site || !slug) return undefined;
  return fs.existsSync(path.join(process.cwd(), 'site', 'img', `${slug}-ig.jpg`)) ? `${site}/img/${slug}-ig.jpg` : `${site}/img/${slug}.jpg`;
}

export interface RecentThreadsPost {
  id: string;
  text?: string;
  timestamp?: string;
  permalink?: string;
}

/** Consulta los últimos posts publicados en Threads */
export async function getRecentThreadsPosts(
  userId: string,
  token: string,
  limit = 15
): Promise<RecentThreadsPost[]> {
  try {
    const res = await fetch(
      `${API}/${userId}/threads?fields=id,text,timestamp,permalink&limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }
    );
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.data)) return [];
    return data.data;
  } catch (err: any) {
    console.warn('[Threads] Error consultando posts recientes:', err?.message);
    return [];
  }
}

/** Busca si un texto ya fue publicado en Threads en las últimas 48 horas */
export function findMatchingThreadsPost(
  targetText: string,
  posts: RecentThreadsPost[],
  maxAgeHours = 48,
  altText?: string
): RecentThreadsPost | null {
  const targetNorm = normalizeCaptionForDedupe(targetText);
  const altNorm = altText ? normalizeCaptionForDedupe(altText) : '';
  if (!targetNorm && !altNorm) return null;

  const now = Date.now();
  const maxAgeMs = maxAgeHours * 3600 * 1000;

  for (const post of posts) {
    if (!post.text || !post.timestamp) continue;
    const postTime = new Date(post.timestamp).getTime();
    if (isNaN(postTime) || (now - postTime) > maxAgeMs) continue;

    const postNorm = normalizeCaptionForDedupe(post.text);
    if (!postNorm) continue;

    if (postNorm === targetNorm || (altNorm && postNorm === altNorm)) {
      return post;
    }
  }
  return null;
}

export async function publishToThreads(news: ProcessedNews): Promise<ChannelResult & { postId?: string }> {
  const userId = (process.env.THREADS_USER_ID || '').trim();
  const token = await getThreadsToken();
  if (!userId || !token) return { success: false, skipped: true, error: 'Threads sin configurar' };

  const text = buildThreadsText(news);

  // 1. Guarda de duplicados previa: consultar últimos 15 posts en las últimas 48 h
  const recent = await getRecentThreadsPosts(userId, token, 15);
  const existing = findMatchingThreadsPost(text, recent, 48, news.headline);
  if (existing) {
    console.log('[Threads] Ya publicado, se evita el duplicado');
    return { success: true, postId: existing.id };
  }

  const call = async (url: string, params: Record<string, string>) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(30_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error?.message || `HTTP ${res.status}`);
    return data;
  };

  try {
    const image = publicImageUrl(news);
    const container = await call(`${API}/${userId}/threads`, {
      media_type: image ? 'IMAGE' : 'TEXT',
      text,
      ...(image ? { image_url: image } : {}),
    });
    // Meta pide esperar a que el contenedor termine de procesarse antes de publicar
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 5000 : 4000));
      const st: any = await fetch(`${API}/${container.id}?fields=status,error_message`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .catch(() => ({}));
      if (st.status === 'FINISHED') break;
      if (st.status === 'ERROR' || st.status === 'EXPIRED') throw new Error(`procesamiento ${st.status}: ${st.error_message || ''}`);
    }

    try {
      const published = await call(`${API}/${userId}/threads_publish`, { creation_id: container.id });
      return { success: true, postId: published.id };
    } catch (pubErr: any) {
      console.warn('[Threads] Error en threads_publish:', pubErr?.message);
      // Volver a consultar por si Meta lo publicó pese al error ("An unknown error occurred")
      await new Promise((r) => setTimeout(r, 6000));
      const recheck = await getRecentThreadsPosts(userId, token, 15);
      const matched = findMatchingThreadsPost(text, recheck, 48, news.headline);
      if (matched) {
        console.log('[Threads] Ya publicado, se evita el duplicado');
        return { success: true, postId: matched.id };
      }
      throw pubErr;
    }
  } catch (err: any) {
    return { success: false, error: `Threads: ${err?.message}` };
  }
}
