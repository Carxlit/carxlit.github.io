import './clean-env';
import { execSync } from 'child_process';
import { localDateKey } from '../src/lib/storage/json-store';
import { getPublicationQueue } from '../src/lib/agents/queue-dispatcher';
import { getSiteEntries } from '../src/lib/site/static-site';
import { getMetricsHistory, recordDailyMetrics } from '../src/lib/agents/audience-metrics';

/**
 * Panel de progreso en la terminal: seguidores por red y su crecimiento, publicaciones de los últimos días,
 * cola, artículos del sitio y el estado de la nube. Doble clic en PROGRESO.bat.
 */
async function main() {
  if (!process.env.INSTAGRAM_USER_ID) {
    try {
      process.env.INSTAGRAM_USER_ID = execSync('gh variable get INSTAGRAM_USER_ID', { encoding: 'utf8' }).trim();
    } catch {
      // sin gh: se omite Instagram
    }
  }
  const strip = (s: string) => s.replace(/<[^>]+>/g, '');
  const snap = await recordDailyMetrics();
  const history = getMetricsHistory();

  console.log('\n══════════ PUNTO CIEGO · PROGRESO ══════════');
  console.log(`Hoy: ${new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}\n`);

  console.log('AUDIENCIA');
  const { progressLines } = await import('../src/lib/agents/audience-metrics');
  const lines = progressLines(snap, history);
  console.log(lines.length ? lines.map((l) => `  ${strip(l)}`).join('\n') : '  (sin datos: revisa las credenciales)');
  if (snap.topPost) console.log(`  🏆 Mejor publicación (3 días): ${snap.topPost.url} — ${snap.topPost.likes} me gusta, ${snap.topPost.comments} comentarios`);

  const queue = getPublicationQueue();
  const days: Record<string, { posts: number; reels: number; threads: number }> = {};
  for (const q of queue) {
    if (q.status !== 'published' || !q.publishedAt) continue;
    const d = localDateKey(new Date(q.publishedAt));
    days[d] = days[d] || { posts: 0, reels: 0, threads: 0 };
    days[d].posts++;
    if (q.results?.instagram?.success && q.news.videoScript) days[d].reels++;
    if (q.results?.threads?.success) days[d].threads++;
  }
  console.log('\nPUBLICACIONES (últimos 7 días)');
  for (const d of Object.keys(days).sort().slice(-7)) console.log(`  ${d}: ${days[d].posts} noticias · ${days[d].reels} Reels en Instagram · ${days[d].threads} en Threads`);
  console.log(`  En cola: ${queue.filter((q) => q.status === 'queued').length} · Fallidas: ${queue.filter((q) => q.status === 'failed').length}`);

  console.log(`\nSITIO: ${getSiteEntries().length} artículos publicados · ${process.env.PUBLIC_SITE_URL || 'https://puntociegoglobal.pages.dev'}`);

  try {
    const runs = JSON.parse(
      execSync('gh run list --workflow redaccion.yml --limit 20 --json conclusion,createdAt', { encoding: 'utf8' })
    ) as { conclusion: string; createdAt: string }[];
    const ok = runs.filter((r) => r.conclusion === 'success').length;
    console.log(`NUBE: ${ok}/${runs.length} de las últimas ejecuciones salieron bien · última: ${new Date(runs[0]?.createdAt).toLocaleString('es-CO')}`);
  } catch {
    console.log('NUBE: (instala/activa gh para ver el estado de las ejecuciones)');
  }
  console.log('\nNota: el alcance y las reproducciones de Instagram necesitan el permiso instagram_manage_insights.');
  console.log('══════════════════════════════════════════\n');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
