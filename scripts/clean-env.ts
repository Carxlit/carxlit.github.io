/**
 * Limpia las variables de entorno ANTES de que se cargue cualquier otro módulo.
 * Los secretos guardados desde PowerShell 5.1 pueden llegar con BOM (U+FEFF) o saltos de línea
 * al principio/final, y rompen las cabeceras HTTP ("Cannot convert argument to a ByteString").
 * Debe ser el PRIMER import de cloud-run.ts: los imports se evalúan en orden y algunos módulos
 * (p. ej. el cliente de Gemini) leen su clave al cargarse.
 */
for (const [key, value] of Object.entries(process.env)) {
  if (typeof value === 'string') {
    const clean = value.replace(/^﻿+/, '').trim();
    if (clean !== value) process.env[key] = clean;
  }
}

export {};
