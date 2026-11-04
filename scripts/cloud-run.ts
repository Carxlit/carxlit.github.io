/**
 * Un ciclo completo de la redacción SIN servidor Next (para GitHub Actions o tareas programadas).
 * Hace lo mismo que el demonio local en cada tick: auditoría + auto-sanación y ciclo autónomo
 * (publicar lo que toque, buscar y encolar una historia nueva).
 *
 * Uso: npm run cloud:run
 */
// Primero: limpia BOM/espacios de los secretos antes de que otros módulos los lean al cargarse
import './clean-env';
import fs from 'fs';
import path from 'path';
import { runFullNewsroomAudit } from '../src/lib/agents/newsroom-auditor';
import { runAutonomousNewsroomCycle, getAutonomousConfig } from '../src/lib/agents/autonomous-newsroom';
import { getPublicationQueue, dispatchDueItems, forcePublishQueuedItem, makeDueNow } from '../src/lib/agents/queue-dispatcher';
import { waitUntilLive } from '../src/lib/site/static-site';
import { maybeSendDailyReport } from '../src/lib/agents/daily-report';
import { replyToComments } from '../src/lib/agents/comment-replies';

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

const ACTION_LABELS: Record<string, string> = {
  published_due: '📤 Publicó una historia',
  queued_new: '📝 Escribió y programó una historia nueva',
  breaking_emergency_published: '🚨 Publicó una noticia de última hora',
  queue_full: '⏳ Cola llena, esperando su turno',
  quota_reached: '✅ Cupo del día completo',
  quiet_hours: '🌙 Fuera del horario de publicación',
  no_candidates: '🔎 Sin noticias nuevas que valgan la pena',
  ai_unavailable: '⏸️ Gemini sin cuota, se reintenta más tarde',
  busy: '⏳ Otro ciclo en curso',
  error: '❌ Error en el ciclo',
};

/** Resumen legible en la página de cada ejecución de GitHub Actions (se ve bien desde el celular) */
function writeRunSummary(result: Awaited<ReturnType<typeof runAutonomousNewsroomCycle>>, auditLine: string) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const r = result.report;
  const upcoming = getPublicationQueue()
    .filter((i) => i.status === 'queued')
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    .map((i) => `- ${new Date(i.scheduledFor).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} · ${i.news.headline}`);
  const lines = [
    `## ${ACTION_LABELS[result.actionTaken] || result.actionTaken}`,
    result.message,
    '',
    auditLine,
    '',
    `**Hoy:** ${r.totalToday}/${r.maxDailyPosts} (publicadas ${r.publishedToday}, en cola ${r.pendingInQueue})`,
    '',
    upcoming.length ? `**Próximas publicaciones:**\n${upcoming.join('\n')}` : '**Próximas publicaciones:** ninguna en cola',
    '',
  ];
  try {
    fs.appendFileSync(file, lines.join('\n') + '\n');
  } catch {
    // El resumen es opcional
  }
}

/** GitHub no garantiza los cron (a veces pasan horas sin ejecutar): si una publicación vence pronto, se espera aquí */
const WAIT_FOR_DUE_MINUTES = 25;
/** Margen para que GitHub Pages sirva el artículo recién desplegado antes de enlazarlo */
const LIVE_WAIT_MS = 4 * 60_000;

const queuedItems = () => getPublicationQueue().filter((i) => i.status === 'queued');

/**
 * Fase "dispatch" (después de desplegar el sitio): publica lo vencido cuando su artículo ya responde,
 * para que el post salga con el enlace. Si algo vence en menos de 25 min, lo espera.
 */
async function dispatchPhase() {
  await publishForcedItems();

  const next = queuedItems()
    .map((i) => new Date(i.scheduledFor).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0];
  if (!next) {
    console.log('[CLOUD] Nada en cola para publicar.');
    return;
  }
  const waitMs = next - Date.now();
  if (waitMs > WAIT_FOR_DUE_MINUTES * 60_000) {
    console.log(`[CLOUD] Próxima publicación a las ${new Date(next).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}: la publicará un ciclo posterior.`);
    return;
  }
  if (waitMs > 0) {
    console.log(`[CLOUD] Próxima publicación en ${Math.ceil(waitMs / 60_000)} min: se espera para no depender del siguiente cron.`);
    await new Promise((r) => setTimeout(r, waitMs + 15_000));
  }

  for (const item of queuedItems().filter((i) => new Date(i.scheduledFor).getTime() <= Date.now())) {
    const url = item.news.articleUrl;
    if (!url) continue;
    const live = await waitUntilLive(url, LIVE_WAIT_MS);
    console.log(`[CLOUD] Artículo ${live ? 'en línea' : 'AÚN NO responde (saldrá sin enlace)'}: ${url}`);
  }

  let total = 0;
  for (let i = 0; i < 3; i++) {
    const { processed } = await dispatchDueItems();
    if (!processed) break;
    total += processed;
  }
  console.log(`[CLOUD] Publicaciones enviadas a las redes: ${total}`);
  appendSummary(total ? `**📤 Publicadas en redes en este ciclo:** ${total}` : '');
}

/** Historias que se publican YA sin pasar por el espaciado: urgencias y las extra pedidas a mano */
const FORCE_FILE = path.join(process.cwd(), 'storage', 'force_publish.json');

async function publishForcedItems() {
  let forcedIds: string[] = [];
  try {
    forcedIds = JSON.parse(fs.readFileSync(FORCE_FILE, 'utf8'));
  } catch {
    // Sin publicaciones manuales pendientes
  }
  const now = Date.now();
  const forced = queuedItems().filter(
    (i) => (i.isBreaking || forcedIds.includes(i.id)) && new Date(i.scheduledFor).getTime() <= now
  );
  // Las urgencias primero
  forced.sort((a, b) => Number(Boolean(b.isBreaking)) - Number(Boolean(a.isBreaking)));
  for (const item of forced) {
    if (item.news.articleUrl) {
      const live = await waitUntilLive(item.news.articleUrl, LIVE_WAIT_MS);
      console.log(`[CLOUD] Artículo ${live ? 'en línea' : 'AÚN NO responde (saldrá sin enlace)'}: ${item.news.articleUrl}`);
    }
    const done = await forcePublishQueuedItem(item.id);
    console.log(`[CLOUD] ${item.isBreaking ? 'URGENCIA' : 'Publicación manual'} enviada: "${item.news.headline}" → ${done?.status}`);
  }
  if (forcedIds.length) {
    try {
      fs.unlinkSync(FORCE_FILE);
    } catch {
      // Ya no existía
    }
  }
  if (forced.length) appendSummary(`**⚡ Publicadas al instante:** ${forced.length}`);
}

/** Producción manual de historias extra (workflow_dispatch con historias_extra > 0), sin topes de cola ni cupo */
async function produceExtraStories(count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = await runAutonomousNewsroomCycle({
      ...getAutonomousConfig(),
      maxPendingInQueue: 99,
      maxDailyPosts: 99,
      activeHoursStart: 0,
      activeHoursEnd: 24,
      // "solo_con_video": la PRIMERA historia extra debe tener video libre; las demás, cualquiera
      requireVideo: i === 0 && process.env.EXTRA_REQUIRE_VIDEO === 'true',
      preferStats: i === 0 && process.env.EXTRA_PREFER_STATS === 'true',
    });
    console.log(`[CLOUD] Historia extra ${i + 1}/${count}: ${r.actionTaken} -> ${r.message}`);
    if (r.actionTaken === 'queued_new' && r.queuedItem) ids.push(r.queuedItem.id);
    if (r.actionTaken === 'breaking_emergency_published' && r.queuedItem) ids.push(r.queuedItem.id);
    if (r.actionTaken === 'ai_unavailable' || r.actionTaken === 'error') break;
  }
  if (ids.length) {
    makeDueNow(ids);
    fs.writeFileSync(FORCE_FILE, JSON.stringify(ids));
  }
}

function appendSummary(text: string) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file || !text) return;
  try {
    fs.appendFileSync(file, `\n${text}\n`);
  } catch {
    // El resumen es opcional
  }
}

/**
 * Fases (GitHub Actions las ejecuta por separado, con el despliegue del sitio en medio):
 *  - produce:  auditoría + ciclo (lo nuevo queda en cola, sin publicar todavía)
 *  - dispatch: publica lo vencido cuando su artículo ya está en línea
 *  - all:      ambas seguidas (uso local con un despliegue que ocurre dentro del ciclo)
 */
const PHASE = (process.argv[2] || 'all').toLowerCase();

async function main() {
  if (PHASE === 'dispatch') {
    await dispatchPhase();
    return;
  }
  if (PHASE === 'produce') process.env.CLOUD_DEFER_PUBLISH = 'true';

  const started = Date.now();
  console.log(`[CLOUD] Ciclo iniciado ${new Date().toLocaleString('es-CO')} (TZ=${process.env.TZ || 'sistema'})`);

  let auditLine = 'Auditoría no disponible';
  try {
    const audit = await runFullNewsroomAudit();
    const summary = Object.entries(audit.channels)
      .filter(([, h]) => h.configured !== false)
      .map(([name, h]) => `${name}: ${h.status}`)
      .join(', ');
    console.log(`[CLOUD] Salud ${audit.overallHealthScore}/100 [${summary}] · reparados: ${audit.healedCount}`);
    auditLine = `**Salud ${audit.overallHealthScore}/100** · ${summary}${audit.recommendations?.length ? `\n\n⚠️ ${audit.recommendations.join('\n\n⚠️ ')}` : ''}`;
    for (const rec of audit.recommendations || []) console.log(`[CLOUD]   ⚠ ${rec}`);
  } catch (err: any) {
    console.error('[CLOUD] Auditoría falló (se continúa con el ciclo):', err?.message);
  }

  const result = await runAutonomousNewsroomCycle(getAutonomousConfig());
  console.log(`[CLOUD] Acción: ${result.actionTaken} -> ${result.message}`);
  const r = result.report;
  console.log(`[CLOUD] Hoy: ${r.totalToday}/${r.maxDailyPosts} (publicadas ${r.publishedToday}, en cola ${r.pendingInQueue})`);

  writeRunSummary(result, auditLine);
  await maybeSendDailyReport(auditLine);
  await replyToComments().catch((e) => console.warn('[CLOUD] Respuestas a comentarios:', e?.message));

  const extra = Math.max(0, Math.min(5, Math.floor(Number(process.env.EXTRA_STORIES || 0))));
  if (extra > 0) await produceExtraStories(extra);

  if (PHASE === 'all') await dispatchPhase();

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
