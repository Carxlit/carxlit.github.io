import path from 'path';
import { z } from 'zod';
import { readJsonFile, writeJsonFileAtomic } from '@/lib/storage/json-store';
import { getStoredCredentials } from '@/lib/config/credentials-manager';
import { generateObjectWithFallback } from '@/lib/ai/gemini';

/**
 * Respuestas automáticas a comentarios de Instagram y Facebook: responder rápido le dice al algoritmo que la
 * publicación conversa y sube su alcance. Una sola llamada a la IA por ciclo, máximo MAX_REPLIES respuestas.
 *
 * Permisos del token: instagram_manage_comments (Instagram) y pages_manage_engagement + pages_read_user_content (Facebook).
 * Si faltan, el ciclo lo avisa en el log y sigue (no rompe nada). Desactivar con COMMENT_REPLIES=false.
 * En storage/replied_comments.json solo se guardan los ids ya atendidos.
 */
const GRAPH = 'https://graph.facebook.com/v23.0';
const STORE_PATH = path.join(process.cwd(), 'storage', 'replied_comments.json');
const MAX_REPLIES = 6;
const MAX_AGE_MS = 3 * 86_400_000;

interface Pending { key: string; network: 'instagram' | 'facebook'; commentId: string; text: string; author: string; post: string }

async function api(method: 'GET' | 'POST', url: string, token: string, body?: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: body ? new URLSearchParams(body).toString() : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  return res.json();
}

const permissionError = (r: any) => r?.error && [10, 200, 190].includes(r.error.code);

async function collectInstagram(igId: string, token: string, done: Set<string>): Promise<Pending[]> {
  const out: Pending[] = [];
  const me = await api('GET', `${GRAPH}/${igId}?fields=username`, token);
  const media = await api('GET', `${GRAPH}/${igId}/media?fields=id,caption&limit=8`, token);
  for (const m of media.data || []) {
    const cs = await api('GET', `${GRAPH}/${m.id}/comments?fields=id,text,username,timestamp,replies.limit(1){id}&limit=25`, token);
    if (permissionError(cs)) {
      console.warn('[Comentarios] Instagram sin permiso instagram_manage_comments:', cs.error.message);
      return out;
    }
    for (const c of cs.data || []) {
      const key = `ig:${c.id}`;
      if (done.has(key) || c.replies?.data?.length || c.username === me.username) continue;
      if (Date.now() - new Date(c.timestamp).getTime() > MAX_AGE_MS) continue;
      out.push({ key, network: 'instagram', commentId: c.id, text: String(c.text || ''), author: c.username || '', post: String(m.caption || '').slice(0, 300) });
    }
  }
  return out;
}

async function collectFacebook(pageId: string, token: string, done: Set<string>): Promise<Pending[]> {
  const out: Pending[] = [];
  const posts = await api('GET', `${GRAPH}/${pageId}/posts?fields=id,message&limit=8`, token);
  for (const p of posts.data || []) {
    const cs = await api('GET', `${GRAPH}/${p.id}/comments?fields=id,message,from,created_time,comment_count&filter=toplevel&limit=25`, token);
    if (permissionError(cs)) {
      console.warn('[Comentarios] Facebook sin permiso pages_manage_engagement:', cs.error.message);
      return out;
    }
    for (const c of cs.data || []) {
      const key = `fb:${c.id}`;
      if (done.has(key) || c.comment_count > 0 || c.from?.id === pageId) continue;
      if (Date.now() - new Date(c.created_time).getTime() > MAX_AGE_MS) continue;
      out.push({ key, network: 'facebook', commentId: c.id, text: String(c.message || ''), author: c.from?.name || '', post: String(p.message || '').slice(0, 300) });
    }
  }
  return out;
}

const ReplySchema = z.object({
  replies: z.array(z.object({ index: z.number(), reply: z.string() })),
});

/** Redacta las respuestas de un lote de comentarios. reply vacío = no responder (insultos, spam, publicidad) */
async function draftReplies(items: Pending[]): Promise<Map<number, string>> {
  const { replies } = await generateObjectWithFallback({
    schema: ReplySchema,
    label: 'Respuestas a comentarios',
    temperature: 0.6,
    system:
      'Eres el community manager de "Punto Ciego", un medio de noticias y análisis. Respondes comentarios de redes sociales en el MISMO idioma del comentario. ' +
      'Tono cercano, respetuoso y breve (máximo 180 caracteres, como mucho un emoji). Agradece, aporta una idea o invita a leer el análisis completo en el enlace de la biografía. ' +
      'NUNCA inventes datos, cifras ni hechos que no estén en el texto de la publicación. No tomes partido político ni discutas. No pongas enlaces. ' +
      'Si el comentario es un insulto, spam, publicidad, una estafa, o no tiene contenido (solo etiquetas o emojis sueltos), devuelve reply vacío para no responder.',
    prompt:
      items.map((c, i) => `[${i}] Publicación: "${c.post}"\nComentario de ${c.author}: "${c.text.slice(0, 400)}"`).join('\n\n') +
      '\n\nDevuelve una respuesta por cada índice.',
  });
  return new Map(replies.map((r) => [r.index, r.reply.trim().slice(0, 220)]));
}

export async function replyToComments(): Promise<void> {
  if (process.env.COMMENT_REPLIES === 'false') return;
  const creds = getStoredCredentials();
  const token = creds.facebookAccessToken;
  if (!token) return;
  const state = readJsonFile<{ ids: string[] }>(STORE_PATH, { ids: [] });
  const done = new Set(state.ids);

  const igId = (process.env.INSTAGRAM_USER_ID || '').trim();
  const pending = [
    ...(igId ? await collectInstagram(igId, token, done).catch((e) => (console.warn('[Comentarios] Instagram:', e?.message), [] as Pending[])) : []),
    ...(creds.facebookPageId
      ? await collectFacebook(creds.facebookPageId, token, done).catch((e) => (console.warn('[Comentarios] Facebook:', e?.message), [] as Pending[]))
      : []),
  ].slice(0, MAX_REPLIES * 2);
  if (!pending.length) {
    console.log('[Comentarios] Sin comentarios nuevos');
    return;
  }

  const drafts = await draftReplies(pending);
  // Lo que la IA decide no responder se marca como atendido para no evaluarlo otra vez
  pending.forEach((c, i) => {
    if (!drafts.get(i)) done.add(c.key);
  });
  let sent = 0;
  for (let i = 0; i < pending.length && sent < MAX_REPLIES; i++) {
    const reply = drafts.get(i);
    const c = pending[i];
    if (!reply) continue;
    const r =
      c.network === 'instagram'
        ? await api('POST', `${GRAPH}/${c.commentId}/replies`, token, { message: reply })
        : await api('POST', `${GRAPH}/${c.commentId}/comments`, token, { message: reply });
    if (r.id) {
      sent++;
      done.add(c.key);
      console.log(`[Comentarios] ${c.network}: respondido a ${c.author}`);
    } else {
      console.warn(`[Comentarios] ${c.network}: no se pudo responder:`, r.error?.message);
      if (permissionError(r)) break;
    }
  }
  writeJsonFileAtomic(STORE_PATH, { ids: Array.from(done).slice(-600) });
  console.log(`[Comentarios] ${sent} respuestas enviadas`);
}
