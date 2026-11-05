import { z } from 'zod';
import { RawArticle, EditorialCategory } from '@/types/news';

export interface EditorialBrief {
  category: EditorialCategory;
  headline: string;
  subHeadline: string;
  blindSpotAngle: string; // El "Punto Ciego": qué están pasando por alto los medios oficiales
  geopoliticalImplication: string; // Quién gana, quién pierde, qué precedente se crea
  urgencyScore: number;
}

export const EDITORIAL_CATEGORIES: EditorialCategory[] = [
  'GEOPOLÍTICA',
  'SEGURIDAD & DEFENSA',
  'ECONOMÍA GLOBAL',
  'PODER & SOCIEDAD',
  'TECNOLOGÍA & IA',
];

const fold = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z&]/g, '');

/**
 * Lleva lo que diga el modelo a una de las 5 categorías (tolera tildes, espacios o "Y" en vez de "&")
 */
export function normalizeCategory(value: unknown, fallback: EditorialCategory = 'GEOPOLÍTICA'): EditorialCategory {
  const v = fold(String(value || '')).replace(/Y/g, '&');
  const exact = EDITORIAL_CATEGORIES.find((c) => fold(c).replace(/Y/g, '&') === v);
  if (exact) return exact;
  if (v.includes('ECONOM')) return 'ECONOMÍA GLOBAL';
  if (v.includes('SEGUR') || v.includes('DEFENS')) return 'SEGURIDAD & DEFENSA';
  if (v.includes('PODER') || v.includes('SOCIED')) return 'PODER & SOCIEDAD';
  if (v.includes('GEOPOL')) return 'GEOPOLÍTICA';
  if (v.includes('TECNO') || v.endsWith('&IA') || v === 'IA') return 'TECNOLOGÍA & IA';
  return fallback;
}

/**
 * Urgencia a la escala 60-99 (el modelo a veces responde 7, 0.85 u 850)
 */
export function normalizeUrgency(value: unknown, fallback = 80): number {
  let n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n > 0 && n <= 1) n *= 100;
  else if (n > 0 && n <= 10) n *= 10;
  else if (n > 100) n = 99;
  return Math.round(Math.min(99, Math.max(60, n)));
}

// Esquema tolerante: valida forma, no rangos. Los rangos se corrigen después (un "7" ya no tumba la historia).
export const EditorialBriefSchema = z.object({
  category: z.string().describe(
    "Una de: 'GEOPOLÍTICA', 'SEGURIDAD & DEFENSA', 'ECONOMÍA GLOBAL', 'PODER & SOCIEDAD', 'TECNOLOGÍA & IA'"
  ),
  headline: z.string().describe(
    'Titular de prensa riguroso en MAYÚSCULAS, de 6 a 10 palabras. Directo a los hechos, sin signos de exclamación ni sensacionalismo.'
  ),
  subHeadline: z.string().describe(
    'Bajada periodística de una o dos oraciones completas con contexto duro y un dato verificable del dossier.'
  ),
  blindSpotAngle: z.string().describe(
    'El "Punto Ciego" ESPECÍFICO de esta noticia (2-3 oraciones): trasfondo estratégico, intereses no revelados, precedentes o consecuencias que la prensa está ignorando. Nada genérico que sirva para cualquier noticia.'
  ),
  geopoliticalImplication: z.string().describe(
    'Implicación directa: quién gana poder o capital, quién asume el costo y qué cambia en el tablero.'
  ),
  urgencyScore: z.coerce.number().describe('Urgencia e impacto de 60 a 99 (número entero).'),
});

export const DIRECTOR_SYSTEM_PROMPT = `ROL 1 - DIRECTOR EDITORIAL de "Punto Ciego", publicación de inteligencia periodística, análisis geopolítico y economía crítica (inspirada en la prosa afilada de Foreign Affairs, Semafor, The Atlantic y el periodismo de corresponsalía curtido).

FILOSOFÍA EDITORIAL:
Los medios masivos repiten comunicados oficiales. "Punto Ciego" desentraña lo que nadie dice: consecuencias de segundo orden, intereses financieros o militares ocultos, y cómo cambia realmente el equilibrio de poder.

VOZ:
- Tono maduro, incisivo, sobrio e hiperlúcido. Cero ingenuidad diplomática.
- Oraciones con músculo y precisión. Cero relleno ni verborrea de "inteligencia artificial".
- PROHIBIDO: sirenas (🚨, 🔴), signos de exclamación, "Última Hora", "¡Impactante!", "Un giro inesperado", "En un acontecimiento sin precedentes", "En un mundo cada vez más...", "Es fundamental recordar...".
- Categorías permitidas (elige exactamente una):
  - 'GEOPOLÍTICA' (disputas territoriales, diplomacia dura, alianzas, elecciones con impacto internacional)
  - 'SEGURIDAD & DEFENSA' (fuerzas armadas, armamento, inteligencia, conflictos, ciberataques de Estado)
  - 'ECONOMÍA GLOBAL' (comercio, aranceles, deuda, bancos centrales, energía, cripto y mercados)
  - 'TECNOLOGÍA & IA' (modelos de IA, microchips, soberanía digital, cuántica, Big Tech, ciberseguridad)
  - 'PODER & SOCIEDAD' (control institucional, regulación, presión civil, derechos, espionaje)`;

const forbiddenFilter = /(🚨|🔴|📢|⚠️|\b([úu]ltima\s*hora|noticias\s*(en\s*vivo\s*)?24\/7|noticias\s*24\/7|actualizaci[óo]n\s*en\s*vivo|en\s*vivo\s*24\/7|urgente|alerta)\b:?)/gi;

/**
 * Normaliza la salida del modelo al brief definitivo
 */
export function finalizeBrief(raw: z.infer<typeof EditorialBriefSchema>, article: RawArticle): EditorialBrief {
  let headline = raw.headline.replace(forbiddenFilter, '').replace(/!/g, '').trim().toUpperCase();
  if (article.updateOf) {
    headline = headline.replace(/^ACTUALIZACI[ÓO]N\s*[:\-–—]?\s*/i, '').trim();
    headline = `ACTUALIZACIÓN: ${headline}`;
  }
  return {
    category: normalizeCategory(raw.category, normalizeCategory(article.category)),
    headline,
    subHeadline: raw.subHeadline.replace(forbiddenFilter, '').trim(),
    blindSpotAngle: raw.blindSpotAngle.trim(),
    geopoliticalImplication: raw.geopoliticalImplication.trim(),
    urgencyScore: normalizeUrgency(raw.urgencyScore, article.urgencyScore || 80),
  };
}
