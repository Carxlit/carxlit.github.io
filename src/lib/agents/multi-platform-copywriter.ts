import { z } from 'zod';
import { MultiPlatformCopies } from '@/types/news';

export const MultiPlatformCopySchema = z.object({
  facebookPost: z.string().describe(
    'Post para Facebook: 2 a 3 párrafos de análisis incisivo y contextual con prosa viva y humana. Cierra con una pregunta reflexiva que invite a posicionarse, seguida de 3 hashtags temáticos.'
  ),
  telegramPost: z.string().describe(
    'Post para Telegram: memorando con etiquetas HTML <b> e <i> únicamente. Abre con el titular en <b> y luego 3 viñetas: • Qué ocurrió, • Por qué importa, • Qué sigue.'
  ),
  linkedInPost: z.string().describe(
    'Post para LinkedIn: análisis estratégico de nivel directivo sobre repercusiones económicas, riesgo geopolítico y cadenas de valor. Prosa sobria y sin clichés. 3 hashtags al final.'
  ),
  blueskyPost: z.string().describe(
    'Post para Bluesky: máximo 230 caracteres contando hashtags (se le añadirá un enlace). Hook directo, dato revelador del "punto ciego" y 2 hashtags: #PuntoCiego y uno acorde a la categoría.'
  ),
});

export const COPYWRITER_SYSTEM_PROMPT = `ROL 2 - EDITOR OMNICANAL de "Punto Ciego".

MISIÓN: textos con PERSONALIDAD, NERVIO PERIODÍSTICO Y VOZ PROPIA. Nada que huela a comunicado o a IA genérica.

LISTA NEGRA (PROHIBIDO):
- "En un mundo cada vez más interconectado / complejo..."
- "Es crucial reflexionar sobre...", "Sin duda alguna...", "Esto marca un antes y un después..."
- "A medida que los acontecimientos se desarrollan...", "En conclusión / En definitiva..."
- Preguntas infantiles como "¿Y tú qué opinas? ¡Déjanos tu comentario abajo!"
- Emojis de sirenas o alarmas: 🚨, 🔴, ⚠️, 💥.

REGLAS POR CANAL:
1. FACEBOOK (comunidad de debate informado): arranca directo en el meollo. Párrafo 1: el hecho duro y la narrativa oficial. Párrafo 2: el quiebre crítico (el punto ciego). Párrafo 3: pregunta incisiva que obligue a posicionarse. 3 hashtags precisos.
2. TELEGRAM (memorando de inteligencia): solo <b> e <i>.
   <b>TITULAR EDITORIAL</b>

   • <b>Qué ocurrió:</b> 1 o 2 oraciones con el hecho
   • <b>Por qué importa:</b> el ángulo de fondo y su peso real
   • <b>Qué sigue:</b> el próximo movimiento en el tablero
3. BLUESKY (micro-análisis): máximo 230 caracteres; el dato incómodo o la contradicción + 2 hashtags.
4. LINKEDIN (análisis macroestratégico): tono de analista senior; cadenas de suministro, riesgo país, estabilidad institucional, flujos de capital e implicaciones regulatorias.

HASHTAGS: acordes a la categoría (no siempre #Geopolítica); #PuntoCiego siempre.`;

const forbiddenFilter = /(🚨|🔴|📢|⚠️|\b([úu]ltima\s*hora|noticias\s*(en\s*vivo\s*)?24\/7|noticias\s*24\/7)\b:?)/gi;

function cleanCopy(text: string): string {
  return text
    .replace(forbiddenFilter, '')
    .replace(/^[\s\|\:\-]+/, '')
    .trim();
}

/**
 * Limpia los 4 copys. El recorte de Bluesky a 300 grafemas se hace al publicar, sin partir palabras.
 */
export function finalizeCopies(raw: z.infer<typeof MultiPlatformCopySchema>): MultiPlatformCopies {
  return {
    facebook: cleanCopy(raw.facebookPost),
    telegram: cleanCopy(raw.telegramPost),
    bluesky: cleanCopy(raw.blueskyPost),
    linkedIn: cleanCopy(raw.linkedInPost),
  };
}
