/**
 * Un ciclo completo de la redacción SIN servidor Next (para GitHub Actions o tareas programadas).
 * Hace lo mismo que el demonio local en cada tick: auditoría + auto-sanación y ciclo autónomo
 * (publicar lo que toque, buscar y encolar una historia nueva).
 *
 * Uso: npm run cloud:run
 */
import fs from 'fs';
import path from 'path';
import { runFullNewsroomAudit } from '../src/lib/agents/newsroom-auditor';
import { runAutonomousNewsroomCycle, getAutonomousConfig } from '../src/lib/agents/autonomous-newsroom';
import { getPublicationQueue } from '../src/lib/agents/queue-dispatcher';

/** Tarjetas de más de N días que ya no están en cola: el sitio guarda su propia copia en site/img */
const CARD_RETENTION_DAYS = 3;

function pruneOldCards() {
  const dir = path.join(process.cwd(), 'public', 'news-cards');
  if (!fs.existsSync(dir)) return 0;
  const inUse = new Set(
    getPublicationQueue()
      .filter((i) => i.status === 'queued' || i.status === 'publishing' || i.status === 'failed')
      .map((i) => path.basename(i.news.cardImageUrl || ''))
  );
  const limit = Date.now() - CARD_RETENTION_DAYS * 86_400_000;
  let removed = 0;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (inUse.has(file)) continue;
    if (fs.statSync(full).mtimeMs < limit) {
      fs.unlinkSync(full);
      removed++;
    }
  }
  return removed;
}

async function main() {
  const started = Date.now();
  console.log(`[CLOUD] Ciclo iniciado ${new Date().toLocaleString('es-CO')} (TZ=${process.env.TZ || 'sistema'})`);

  try {
    const audit = await runFullNewsroomAudit();
    const summary = Object.entries(audit.channels)
      .filter(([, h]) => h.configured !== false)
      .map(([name, h]) => `${name}: ${h.status}`)
      .join(', ');
    console.log(`[CLOUD] Salud ${audit.overallHealthScore}/100 [${summary}] · reparados: ${audit.healedCount}`);
    for (const rec of audit.recommendations || []) console.log(`[CLOUD]   ⚠ ${rec}`);
  } catch (err: any) {
    console.error('[CLOUD] Auditoría falló (se continúa con el ciclo):', err?.message);
  }

  const result = await runAutonomousNewsroomCycle(getAutonomousConfig());
  console.log(`[CLOUD] Acción: ${result.actionTaken} -> ${result.message}`);
  const r = result.report;
  console.log(`[CLOUD] Hoy: ${r.totalToday}/${r.maxDailyPosts} (publicadas ${r.publishedToday}, en cola ${r.pendingInQueue})`);

  const removed = pruneOldCards();
  if (removed) console.log(`[CLOUD] Tarjetas antiguas eliminadas: ${removed}`);
  console.log(`[CLOUD] Fin en ${Math.round((Date.now() - started) / 1000)} s`);

  // Un error del ciclo se registra pero no marca el job como fallido salvo que sea inesperado
  if (result.actionTaken === 'error') process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('[CLOUD] Error fatal:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    // Playwright o sockets abiertos no deben dejar el proceso colgado en Actions
    setTimeout(() => process.exit(), 2000).unref();
  });
