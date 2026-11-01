import path from 'path';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import type { z } from 'zod';
import { readJsonFile, writeJsonFileAtomic } from '@/lib/storage/json-store';

// Inicialización del cliente de Google AI Studio con la clave de entorno
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

/**
 * Nombre del modelo configurado en .env.local
 */
export const defaultGeminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

/**
 * Modelos de respaldo (separados por coma). Cada modelo tiene su propia cuota diaria
 * en el plan gratuito, así que encadenarlos multiplica la capacidad.
 */
export const fallbackGeminiModels = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite')
  .split(',')
  .map((m) => m.trim())
  .filter((m) => m && m !== defaultGeminiModel);

const COOLDOWN_PATH = path.join(process.cwd(), 'storage', '.ai-cooldown.json');
/** Si todos los modelos están sin cuota, se pausa la producción este tiempo */
const QUOTA_COOLDOWN_MS = 60 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class AiUnavailableError extends Error {
  constructor(message: string, public readonly until?: number) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

/**
 * Hora (ms) hasta la que la IA está en pausa por cuota agotada, o 0
 */
export function getAiCooldownUntil(): number {
  const data = readJsonFile<{ until?: number }>(COOLDOWN_PATH, {});
  return data.until && data.until > Date.now() ? data.until : 0;
}

function setAiCooldown(reason: string) {
  const until = Date.now() + QUOTA_COOLDOWN_MS;
  try { writeJsonFileAtomic(COOLDOWN_PATH, { until, reason, at: new Date().toISOString() }); } catch {}
  return until;
}

/** 429 = cuota/limite; 404 = modelo retirado o inexistente. En ambos casos no sirve reintentar el mismo modelo */
function isQuotaOrMissing(err: any): { quota: boolean; missing: boolean } {
  const status = err?.statusCode ?? err?.lastError?.statusCode;
  const msg = String(err?.message || '');
  return {
    quota: status === 429 || /quota|rate.?limit|exhausted/i.test(msg),
    missing: status === 404 || /not found|no longer available/i.test(msg),
  };
}

/**
 * generateObject con cadena de modelos de respaldo.
 * - Error de cuota o modelo retirado: salta al siguiente modelo sin esperar.
 * - Otros errores (red, JSON inválido): un reintento con el mismo modelo.
 * - Si todos se quedan sin cuota: pausa la IA una hora y lanza AiUnavailableError.
 * Nunca devuelve texto de plantilla: el ciclo autónomo reintenta más tarde.
 */
export async function generateObjectWithFallback<T extends z.ZodTypeAny>(args: {
  schema: T;
  system: string;
  prompt: string;
  label: string;
  temperature?: number;
}): Promise<z.infer<T>> {
  const cooldown = getAiCooldownUntil();
  if (cooldown) {
    throw new AiUnavailableError(`IA en pausa por cuota agotada hasta las ${new Date(cooldown).toLocaleTimeString('es-CO')}`, cooldown);
  }

  const models = [defaultGeminiModel, ...fallbackGeminiModels];
  let lastError: any;
  let allQuota = true;

  for (const modelName of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { object } = await generateObject({
          model: google(modelName),
          schema: args.schema,
          system: args.system,
          prompt: args.prompt,
          temperature: args.temperature ?? 0.7,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(90_000),
        });
        return object as z.infer<T>;
      } catch (err: any) {
        lastError = err;
        const { quota, missing } = isQuotaOrMissing(err);
        console.warn(`[Gemini] ${args.label} falló con ${modelName} (intento ${attempt}):`, String(err?.message || '').slice(0, 160));
        if (!quota) allQuota = false;
        if (quota || missing) break; // siguiente modelo
        await sleep(2000);
      }
    }
  }

  if (allQuota) {
    const until = setAiCooldown(String(lastError?.message || '').slice(0, 200));
    throw new AiUnavailableError(`${args.label}: cuota de IA agotada en todos los modelos. Pausa hasta las ${new Date(until).toLocaleTimeString('es-CO')}.`, until);
  }
  throw new Error(`${args.label}: todos los modelos de IA fallaron (${String(lastError?.message || 'sin detalle').slice(0, 200)})`);
}
