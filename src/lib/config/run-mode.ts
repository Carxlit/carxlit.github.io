import fs from 'fs';
import path from 'path';

/**
 * RUN_MODE=cloud en .env.local: la redacción corre en GitHub Actions y el servidor local
 * no debe ejecutar ciclos ni auto-sanación (publicaría cada historia dos veces).
 * Se lee el archivo en cada llamada para que surta efecto sin reiniciar el servidor.
 */
export function isLocalCloudMode(): boolean {
  if (process.env.GITHUB_ACTIONS === 'true') return false;
  try {
    return /^RUN_MODE=cloud\s*$/m.test(fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8'));
  } catch {
    return process.env.RUN_MODE === 'cloud';
  }
}

export const CLOUD_MODE_MESSAGE = 'La redacción corre en la nube (RUN_MODE=cloud): el servidor local no publica.';
