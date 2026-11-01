import fs from 'fs';
import path from 'path';

export const STORAGE_DIR = path.join(process.cwd(), 'storage');

/**
 * Lee un JSON de disco devolviendo un valor por defecto si no existe o está corrupto
 */
export function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch (err) {
    console.error(`[JsonStore] Error al leer ${path.basename(filePath)}:`, err);
    return fallback;
  }
}

/**
 * Escritura atómica: escribe a un temporal y lo renombra, para que un corte
 * a mitad de escritura nunca deje el JSON corrupto.
 */
export function writeJsonFileAtomic(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

/**
 * Fecha local (zona horaria de la máquina) en formato YYYY-MM-DD.
 * La cuota diaria se mide en hora local, no en UTC.
 */
export function localDateKey(date: Date | string | number = new Date()): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export class LockBusyError extends Error {
  constructor(name: string) {
    super(`Ya hay un ciclo "${name}" en ejecución. Se omite este turno.`);
    this.name = 'LockBusyError';
  }
}

/**
 * Candado entre procesos basado en archivo. Evita que dos ciclos (demonio + panel,
 * o dos ticks solapados) modifiquen la cola al mismo tiempo.
 * Si el candado tiene más de `staleMs` se considera abandonado y se reclama.
 */
export async function withFileLock<T>(
  name: string,
  fn: () => Promise<T>,
  staleMs: number = 15 * 60 * 1000
): Promise<T> {
  const lockPath = path.join(STORAGE_DIR, `.${name}.lock`);
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

  const tryAcquire = () => {
    try {
      fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: Date.now() }), { flag: 'wx' });
      return true;
    } catch {
      return false;
    }
  };

  if (!tryAcquire()) {
    const info = readJsonFile<{ at?: number }>(lockPath, {});
    if (info.at && Date.now() - info.at > staleMs) {
      console.warn(`[JsonStore] Candado "${name}" abandonado, reclamándolo.`);
      try { fs.unlinkSync(lockPath); } catch {}
      if (!tryAcquire()) throw new LockBusyError(name);
    } else {
      throw new LockBusyError(name);
    }
  }

  try {
    return await fn();
  } finally {
    try { fs.unlinkSync(lockPath); } catch {}
  }
}
