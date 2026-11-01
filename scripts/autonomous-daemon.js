/**
 * Autonomous Newsroom Daemon - "Punto Ciego"
 *
 * Proceso en segundo plano que mantiene la redacción funcionando 24/7:
 * - Cada 5 minutos audita la salud de los canales y cura publicaciones fallidas.
 * - Despacha lo que esté programado, investiga temas nuevos y los encola con
 *   rotación temática, cupo diario y horario activo (configurables en el panel).
 * - Nunca solapa ciclos: el siguiente empieza 5 minutos después de que termine el anterior.
 * - Deja un registro diario en storage/logs y el último estado en storage/daemon_status.json.
 */

const fs = require('fs');
const path = require('path');

// Si la redacción ya corre en la nube, dos demonios publicarían cada historia dos veces
try {
  if (/^RUN_MODE=cloud\s*$/m.test(fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8'))) {
    console.log('[AUTOPILOT-DAEMON] RUN_MODE=cloud: la redacción corre en la nube. Demonio local desactivado.');
    process.exit(0);
  }
} catch {
  // Sin .env.local: modo local
}

const BASE_URL = process.env.PUNTO_CIEGO_URL || 'http://localhost:3000';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const AUDIT_TIMEOUT_MS = 60 * 1000;
// Un ciclo completo (investigar + 2 llamadas a IA + tarjeta + publicar en 4 redes) puede tardar varios minutos
const CYCLE_TIMEOUT_MS = 10 * 60 * 1000;

const STORAGE_DIR = path.join(__dirname, '..', 'storage');
const LOG_DIR = path.join(STORAGE_DIR, 'logs');
const STATUS_PATH = path.join(STORAGE_DIR, 'daemon_status.json');

let consecutiveFailures = 0;
let stopping = false;

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function log(msg) {
  const line = `[${new Date().toLocaleString('es-CO')}] [AUTOPILOT-DAEMON] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, `daemon-${localDateKey()}.log`), line + '\n');
  } catch {}
}

function writeStatus(status) {
  try {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    const tmp = `${STATUS_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ ...status, pid: process.pid, updatedAt: new Date().toISOString() }, null, 2));
    fs.renameSync(tmp, STATUS_PATH);
  } catch {}
}

/** Borra registros de más de 14 días */
function pruneLogs() {
  try {
    const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
    for (const f of fs.readdirSync(LOG_DIR)) {
      const full = path.join(LOG_DIR, f);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch {}
}

async function postJson(url, timeoutMs) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no JSON (HTTP ${res.status}): ${text.slice(0, 120)}`);
  }
}

async function waitForServer() {
  for (let i = 0; !stopping; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/news/autonomous`, { signal: AbortSignal.timeout(20000) });
      if (res.ok) return;
    } catch {}
    if (i % 6 === 0) log(`Esperando a que el servidor responda en ${BASE_URL}...`);
    await new Promise((r) => setTimeout(r, 10000));
  }
}

async function runAutonomousTick() {
  const status = { lastTickAt: new Date().toISOString() };

  // 1. Auditoría y Auto-Sanación
  try {
    const auditJson = await postJson(`${BASE_URL}/api/news/audit`, AUDIT_TIMEOUT_MS);
    const r = auditJson.report;
    if (r) {
      (r.healingActions || []).forEach((act) => log(`AUTO-SANADOR: ${act}`));
      const c = r.channels;
      log(`Salud: ${r.overallHealthScore}/100 [FB: ${c.facebook.status}, TG: ${c.telegram.status}, BSKY: ${c.bluesky.status}, LI: ${c.linkedIn.status}]`);
      status.health = r.overallHealthScore;
      status.channels = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.status]));
    }
  } catch (auditErr) {
    log(`Aviso de auditoría: ${auditErr.message}`);
  }

  // 2. Ciclo editorial
  try {
    const json = await postJson(`${BASE_URL}/api/news/autonomous`, CYCLE_TIMEOUT_MS);
    if (json.success) {
      consecutiveFailures = 0;
      log(`Acción: ${json.actionTaken} -> ${json.message}`);
      if (json.report) {
        const r = json.report;
        const d = r.categoryDistribution || {};
        log(`Hoy: ${r.totalToday}/${r.maxDailyPosts} (publicadas ${r.publishedToday}, en cola ${r.pendingInQueue ?? r.queuedToday}) [Tech: ${d['TECNOLOGÍA & IA']}, Geo: ${d['GEOPOLÍTICA']}, Eco: ${d['ECONOMÍA GLOBAL']}, Def: ${d['SEGURIDAD & DEFENSA']}, Poder: ${d['PODER & SOCIEDAD']}]`);
        status.report = r;
      }
      status.lastAction = json.actionTaken;
      status.lastMessage = json.message;
    } else {
      consecutiveFailures++;
      log(`Ciclo con error (${consecutiveFailures} seguidos): ${json.message || json.error || 'Respuesta no exitosa'}`);
      status.lastAction = 'error';
      status.lastMessage = json.message || json.error;
    }
  } catch (err) {
    consecutiveFailures++;
    log(`Servidor no disponible o ciclo demasiado largo (${err.message}). Reintento en el próximo turno.`);
    status.lastAction = 'unreachable';
    status.lastMessage = err.message;
  }

  status.consecutiveFailures = consecutiveFailures;
  writeStatus(status);
}

async function startDaemon() {
  log('========================================================');
  log('  PUNTO CIEGO - REDACCIÓN AUTÓNOMA INICIADA');
  log(`  Servidor: ${BASE_URL} | Intervalo: ${CHECK_INTERVAL_MS / 60000} min`);
  log('  Cupo, horario activo y canales: panel o storage/autonomous_config.json');
  log('========================================================');

  pruneLogs();
  await waitForServer();

  // Bucle secuencial: nunca hay dos ticks a la vez
  while (!stopping) {
    const started = Date.now();
    await runAutonomousTick();
    if (consecutiveFailures >= 3) await waitForServer();
    const elapsed = Date.now() - started;
    await new Promise((r) => setTimeout(r, Math.max(30000, CHECK_INTERVAL_MS - elapsed)));
  }
}

process.on('SIGINT', () => { stopping = true; log('Detenido por el usuario.'); process.exit(0); });
process.on('unhandledRejection', (err) => log(`Error no controlado: ${err && err.message ? err.message : err}`));

startDaemon().catch((err) => {
  log(`Error fatal: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
