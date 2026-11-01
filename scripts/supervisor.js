/**
 * Supervisor de Punto Ciego
 *
 * Mantiene vivos el servidor web (Next.js) y el demonio autónomo: si alguno se cae,
 * lo reinicia con espera creciente. Es lo que ejecuta INICIAR_PUNTO_CIEGO.bat.
 *
 * Modo: producción (`next start`) si existe un build (.next/BUILD_ID), si no `next dev`.
 * Forzar con la variable PUNTO_CIEGO_MODE=dev o PUNTO_CIEGO_MODE=prod.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NEXT_BIN = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const LOG_DIR = path.join(ROOT, 'storage', 'logs');
const hasBuild = fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID'));
const MODE = process.env.PUNTO_CIEGO_MODE || (hasBuild ? 'prod' : 'dev');

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function log(msg) {
  const line = `[${new Date().toLocaleString('es-CO')}] [SUPERVISOR] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, `supervisor-${localDateKey()}.log`), line + '\n');
  } catch {}
}

const children = new Map();
let shuttingDown = false;

function keepAlive(name, args) {
  let restarts = 0;
  let startedAt = 0;

  const start = () => {
    if (shuttingDown) return;
    startedAt = Date.now();
    log(`Iniciando ${name}...`);
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
    children.set(name, child);

    child.on('exit', (code, signal) => {
      children.delete(name);
      if (shuttingDown) return;
      // Si estuvo vivo más de 10 min, se considera estable y se reinicia el contador
      if (Date.now() - startedAt > 10 * 60 * 1000) restarts = 0;
      restarts++;
      const delay = Math.min(5 * 60 * 1000, 5000 * 2 ** Math.min(restarts - 1, 6));
      log(`${name} terminó (código ${code}${signal ? `, señal ${signal}` : ''}). Reinicio #${restarts} en ${Math.round(delay / 1000)} s.`);
      setTimeout(start, delay);
    });
  };

  start();
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Deteniendo servicios...');
  for (const child of children.values()) child.kill();
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

log(`Modo: ${MODE === 'prod' ? 'producción (next start)' : 'desarrollo (next dev)'}`);
keepAlive('Servidor web', [NEXT_BIN, MODE === 'prod' ? 'start' : 'dev', '-p', '3000']);
if (isCloudMode()) {
  log('RUN_MODE=cloud en .env.local: la redacción corre en la nube; el demonio local NO se inicia (evita publicar doble).');
} else {
  keepAlive('Demonio autónomo', [path.join(__dirname, 'autonomous-daemon.js')]);
}

function isCloudMode() {
  try {
    return /^RUN_MODE=cloud\s*$/m.test(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8'));
  } catch {
    return false;
  }
}
