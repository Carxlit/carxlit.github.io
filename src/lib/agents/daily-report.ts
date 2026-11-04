import path from 'path';
import { readJsonFile, writeJsonFileAtomic, localDateKey } from '@/lib/storage/json-store';
import { getPublicationQueue } from './queue-dispatcher';
import { getAiCooldownUntil } from '@/lib/ai/gemini';
import { MetricsSnapshot, progressLines, recordDailyMetrics } from './audience-metrics';

/**
 * Reporte diario al Telegram PERSONAL del dueño (no al canal de noticias): qué se publicó, qué falló,
 * salud de los canales y avisos (token por vencer, IA sin cuota). Se envía una vez al día a partir de REPORT_HOUR.
 * Necesita TELEGRAM_BOT_TOKEN y TELEGRAM_REPORT_CHAT_ID (lo configura REPORTE_TELEGRAM.bat).
 */
const STATE_PATH = path.join(process.cwd(), 'storage', 'report_state.json');
const REPORT_HOUR = Number(process.env.REPORT_HOUR || 21);

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CHANNEL_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  telegram: 'Telegram',
  bluesky: 'Bluesky',
  instagram: 'Instagram',
  facebookReel: 'Reel FB',
  linkedIn: 'LinkedIn',
  mastodon: 'Mastodon',
  threads: 'Threads',
  youtube: 'YouTube Shorts',
};

export function buildDailyReport(auditLine: string, now = new Date(), metrics?: MetricsSnapshot): string {
  const today = localDateKey(now);
  const queue = getPublicationQueue();
  const published = queue
    .filter((q) => q.status === 'published' && q.publishedAt && localDateKey(new Date(q.publishedAt)) === today)
    .sort((a, b) => a.publishedAt!.localeCompare(b.publishedAt!));
  // Enlaces antiguos (dominio anterior) apuntan al dominio actual
  const site = (process.env.PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  const link = (url?: string) => (url && site ? url.replace(/^https?:\/\/[^/]+/, site) : url);
  const failed = queue.filter((q) => q.status === 'failed' && localDateKey(new Date(q.lastAttemptAt || q.createdAt)) === today);
  const waiting = queue.filter((q) => q.status === 'queued');
  const reels = published.filter((q) => q.results?.facebookReel?.success || (q.results?.instagram as any)?.permalink || q.news.sourceVideo?.license === 'cc-by').length;
  const withVideo = published.filter((q) => q.news.sourceVideo).length;

  const channelFailures: Record<string, number> = {};
  for (const q of [...published, ...failed]) {
    for (const [ch, r] of Object.entries(q.results || {})) {
      if (r && !r.success && !r.skipped) channelFailures[ch] = (channelFailures[ch] || 0) + 1;
    }
  }

  const lines = [
    `<b>📊 Punto Ciego · Reporte del ${now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</b>`,
    '',
    `✅ Publicadas hoy: <b>${published.length}</b>${reels ? ` · 🎬 Reels: ${reels}` : ''}${withVideo ? ` · 🎥 con video: ${withVideo}` : ''}`,
    `⏳ En cola: ${waiting.length}${failed.length ? ` · ❌ Fallidas: ${failed.length}` : ''}`,
  ];
  if (published.length) {
    lines.push('', '<b>Lo publicado:</b>');
    for (const q of published.slice(0, 15)) {
      const t = new Date(q.publishedAt!).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
      const title = q.news.article?.title || q.news.headline;
      const url = link(q.news.articleUrl);
      lines.push(`• ${t} — ${url ? `<a href="${esc(url)}">${esc(title)}</a>` : esc(title)}`);
    }
  }
  const fails = Object.entries(channelFailures);
  if (fails.length) lines.push('', `⚠️ Fallos por canal: ${fails.map(([ch, n]) => `${CHANNEL_NAMES[ch] || ch} ${n}`).join(', ')}`);
  if (metrics) {
    const progress = progressLines(metrics);
    if (progress.length) lines.push('', '<b>📈 Progreso de la audiencia</b>', ...progress);
    if (metrics.topPost) {
      lines.push(`🏆 Mejor publicación (3 días): <a href="${esc(metrics.topPost.url)}">${metrics.topPost.type === 'REELS' ? 'Reel' : 'Post'}</a> con ${metrics.topPost.likes} 👍 y ${metrics.topPost.comments} 💬`);
    }
  }
  if (getAiCooldownUntil()) lines.push('⏸️ La IA está sin cuota en este momento (se reanuda sola).');
  lines.push('', esc(auditLine.replace(/\*\*/g, '')));
  return lines.join('\n').slice(0, 4000);
}

/** Envía el reporte si ya es la hora y no se envió hoy. Nunca lanza. */
export async function maybeSendDailyReport(auditLine: string): Promise<void> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_REPORT_CHAT_ID || '').trim();
  if (!token || !chatId) return;
  const now = new Date();
  const today = localDateKey(now);
  const state = readJsonFile<{ lastSent?: string }>(STATE_PATH, {});
  if (state.lastSent === today || now.getHours() < REPORT_HOUR) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: buildDailyReport(auditLine, now, await recordDailyMetrics(now).catch(() => undefined)), parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(20_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.description || `HTTP ${res.status}`);
    writeJsonFileAtomic(STATE_PATH, { lastSent: today });
    console.log('[Reporte] Reporte diario enviado por Telegram');
  } catch (err: any) {
    console.warn('[Reporte] No se pudo enviar el reporte diario:', err?.message);
  }
}
