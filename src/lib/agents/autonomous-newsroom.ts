import path from 'path';
import {
  ProcessedNews,
  QueuedPublication,
  EditorialCategory,
  RawArticle
} from '@/types/news';
import { runNewsScout, SEVERE_EVENT } from './news-scout';
import { runEditorialPipeline } from './orchestrator';
import {
  getPublicationQueue,
  enqueuePublication,
  dispatchDueItems,
  forcePublishQueuedItem
} from './queue-dispatcher';
import { readJsonFile, writeJsonFileAtomic, localDateKey, withFileLock, LockBusyError } from '@/lib/storage/json-store';
import { getAiCooldownUntil, AiUnavailableError } from '@/lib/ai/gemini';
import { publishArticleToSite } from '@/lib/site/static-site';
import { findNewsVideo } from '@/lib/news/news-video';
import { resolveGoogleNewsUrl } from '@/lib/news/article-image';
import { fetchArticlePage } from './deep-researcher';
import { dropSemanticDuplicates } from './semantic-dedupe';

const PUBLISHED_STORE_PATH = path.join(process.cwd(), 'storage', 'published_news.json');

export const CORE_EDITORIAL_CATEGORIES: EditorialCategory[] = [
  'TECNOLOGÍA & IA',
  'GEOPOLÍTICA',
  'ECONOMÍA GLOBAL',
  'SEGURIDAD & DEFENSA',
  'PODER & SOCIEDAD'
];

export interface AutonomousConfig {
  maxDailyPosts: number; // Configurable: 4, 6, 8, 10 o 12 publicaciones al día
  minSpacingHours: number; // Mínimo de horas entre publicaciones (ej: 1 hora = 60 min)
  maxPendingInQueue: number; // Cuántas historias pueden esperar en cola a la vez (evita colas infinitas)
  activeHoursStart: number; // Hora local (0-23) desde la que se publica
  activeHoursEnd: number; // Hora local (1-24) hasta la que se publica
  breakingThreshold: number; // Urgencia mínima para saltar la cola (Protocolo de Urgencia Máxima)
  maxBreakingPerDay: number; // Tope diario de urgencias para que no se convierta en spam
  maxArticleAgeHours: number; // No se cubren noticias más viejas que esto
  requireVideo?: boolean; // Solo historias con video libre (Creative Commons) del hecho (pruebas a mano; no gasta IA en las que no tienen)
  activeChannels: {
    facebook: boolean;
    telegram: boolean;
    bluesky: boolean;
    linkedIn: boolean;
    instagram?: boolean;
    facebookReel?: boolean;
    mastodon?: boolean;
    threads?: boolean;
    youtube?: boolean;
  };
}

export const DEFAULT_AUTONOMOUS_CONFIG: AutonomousConfig = {
  maxDailyPosts: 16, // Lo máximo sostenible con la cuota gratis de IA (Gemini + respaldos) y sin saturar las redes
  minSpacingHours: 0.75, // 45-70 min en horas pico; fuera de ellas casi el doble
  maxPendingInQueue: 3,
  activeHoursStart: 6,
  activeHoursEnd: 23,
  breakingThreshold: 90, // con el refuerzo por cobertura y hechos graves del Scout, 90 deja pasar los accidentes y tragedias con varios medios detrás
  maxBreakingPerDay: 4,
  maxArticleAgeHours: 24,
  activeChannels: {
    facebook: true,
    telegram: true,
    bluesky: true,
    linkedIn: false, // Desactivado: publicar en páginas de empresa exige una app aprobada o Make
    // Se usan solo si tienen credenciales (INSTAGRAM_USER_ID / MASTODON_*); si no, se omiten
    instagram: true,
    facebookReel: true,
    mastodon: true,
    threads: true,
    youtube: true, // solo con YOUTUBE_* configurados y video real de la noticia
  },
};

const CONFIG_FILE_PATH = path.join(process.cwd(), 'storage', 'autonomous_config.json');

/**
 * Obtiene la configuración de autonomía persistente (o la predeterminada)
 */
export function getAutonomousConfig(): AutonomousConfig {
  const data = readJsonFile<Partial<AutonomousConfig>>(CONFIG_FILE_PATH, {});
  return {
    ...DEFAULT_AUTONOMOUS_CONFIG,
    ...data,
    activeChannels: {
      ...DEFAULT_AUTONOMOUS_CONFIG.activeChannels,
      ...(data.activeChannels || {}),
    },
  };
}

/**
 * Guarda y actualiza la configuración de autonomía en storage/autonomous_config.json
 */
export function saveAutonomousConfig(cfg: Partial<AutonomousConfig>): AutonomousConfig {
  try {
    const current = getAutonomousConfig();
    const updated: AutonomousConfig = {
      ...current,
      ...cfg,
      activeChannels: {
        ...current.activeChannels,
        ...(cfg.activeChannels || {}),
      },
    };
    writeJsonFileAtomic(CONFIG_FILE_PATH, updated);
    return updated;
  } catch (err) {
    console.error('[AutonomousNewsroom] Error al guardar autonomous_config.json:', err);
    return DEFAULT_AUTONOMOUS_CONFIG;
  }
}

export interface DailyEditorialReport {
  date: string;
  totalToday: number;
  maxDailyPosts: number;
  quotaReached: boolean;
  publishedToday: number;
  queuedToday: number;
  pendingInQueue: number;
  breakingToday: number;
  categoryDistribution: Record<EditorialCategory, number>;
  nextScheduledTime?: string;
  recommendedNextCategory: EditorialCategory;
}

/**
 * Noticias publicadas hoy (hora local): las de la cola y las publicadas a mano desde el panel
 */
export function getTodayPublishedNews(): ProcessedNews[] {
  const todayStr = localDateKey();
  const fromQueue = getPublicationQueue()
    .filter((q) => q.status === 'published' && q.publishedAt && localDateKey(q.publishedAt) === todayStr)
    .map((q) => q.news);

  const manual = readJsonFile<ProcessedNews[]>(PUBLISHED_STORE_PATH, [])
    .filter((n) => n.publishedAt && localDateKey(n.publishedAt) === todayStr);

  const seen = new Set<string>();
  return [...fromQueue, ...manual].filter((n) => {
    const key = n.originalUrl || n.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Publicaciones aún pendientes en cola (cualquier fecha programada): todas consumen cupo
 */
export function getTodayQueuedPublications(): QueuedPublication[] {
  return getPublicationQueue().filter((item) => item.status === 'queued' || item.status === 'publishing');
}

/**
 * Genera el reporte de estado diario y balance de categorías
 */
export function getDailyEditorialReport(config: AutonomousConfig = getAutonomousConfig()): DailyEditorialReport {
  const todayStr = localDateKey();
  const publishedToday = getTodayPublishedNews();
  const queuedToday = getTodayQueuedPublications();
  const breakingToday = getPublicationQueue().filter(
    (q) => q.isBreaking && localDateKey(q.createdAt) === todayStr
  ).length;

  const categoryDistribution: Record<EditorialCategory, number> = {
    'TECNOLOGÍA & IA': 0,
    'GEOPOLÍTICA': 0,
    'ECONOMÍA GLOBAL': 0,
    'SEGURIDAD & DEFENSA': 0,
    'PODER & SOCIEDAD': 0,
  };

  [...publishedToday, ...queuedToday.map((q) => q.news)].forEach((n) => {
    const cat = n.category as EditorialCategory;
    if (categoryDistribution[cat] !== undefined) {
      categoryDistribution[cat]++;
    }
  });

  const totalToday = publishedToday.length + queuedToday.length;
  const quotaReached = totalToday >= config.maxDailyPosts;

  // Encontrar la categoría menos cubierta hoy para priorizarla
  let minCount = Infinity;
  let recommendedCategory: EditorialCategory = 'TECNOLOGÍA & IA';

  for (const cat of CORE_EDITORIAL_CATEGORIES) {
    if (categoryDistribution[cat] < minCount) {
      minCount = categoryDistribution[cat];
      recommendedCategory = cat;
    }
  }

  // Próxima hora programada en cola si existe
  const nextItem = [...queuedToday].sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
  )[0];

  return {
    date: todayStr,
    totalToday,
    maxDailyPosts: config.maxDailyPosts,
    quotaReached,
    publishedToday: publishedToday.length,
    queuedToday: queuedToday.length,
    pendingInQueue: queuedToday.length,
    breakingToday,
    categoryDistribution,
    nextScheduledTime: nextItem?.scheduledFor,
    recommendedNextCategory: recommendedCategory,
  };
}

/**
 * ¿Está la hora dada dentro del horario activo de publicación?
 */
export function isWithinActiveHours(date: Date, config: AutonomousConfig = getAutonomousConfig()): boolean {
  const h = date.getHours();
  return h >= config.activeHoursStart && h < config.activeHoursEnd;
}

/**
 * Lleva una fecha al horario activo: si cae de noche, la mueve al inicio de la mañana
 */
function clampToActiveHours(date: Date, config: AutonomousConfig): Date {
  if (isWithinActiveHours(date, config)) return date;
  const d = new Date(date);
  if (d.getHours() >= config.activeHoursEnd) d.setDate(d.getDate() + 1);
  d.setHours(config.activeHoursStart, Math.floor(Math.random() * 30), 0, 0);
  return d;
}

/**
 * Calcula la hora programada ideal para el próximo post respetando el espaciado diario
 */
/** Franjas de más audiencia (hora local): mañana, almuerzo y noche */
const PEAK_HOURS: [number, number][] = [
  [7, 10],
  [12, 14],
  [18, 22],
];

export function calculateNextPostSchedule(config: AutonomousConfig = getAutonomousConfig()): Date {
  const now = Date.now();
  const queue = getPublicationQueue();

  // Referencia: lo último programado en cola o lo último publicado
  const lastQueued = queue
    .filter((q) => q.status === 'queued')
    .map((q) => new Date(q.scheduledFor).getTime());
  const lastPublished = queue
    .filter((q) => q.status === 'published' && q.publishedAt)
    .map((q) => new Date(q.publishedAt!).getTime());
  const reference = Math.max(0, ...lastQueued, ...lastPublished);

  // Horas pico (hora local): separación mínima; fuera de ellas, casi el doble. Así el cupo diario
  // se concentra cuando más gente está conectada en Latinoamérica
  const nextHour = new Date(reference + config.minSpacingHours * 3_600_000).getHours();
  const peak = PEAK_HOURS.some(([from, to]) => nextHour >= from && nextHour < to);
  const spacingMinutes = Math.floor(config.minSpacingHours * 60 * (peak ? 1 : 1.9)) + Math.floor(Math.random() * 25);
  const fromReference = reference + spacingMinutes * 60 * 1000;
  // Si no hay nada reciente, salir en 10-25 minutos
  const soonest = now + (Math.floor(Math.random() * 15) + 10) * 60 * 1000;

  return clampToActiveHours(new Date(Math.max(fromReference, soonest)), config);
}

/**
 * Selecciona la mejor noticia del radar aplicando estrictamente la diversidad temática
 */
const LATAM_PATTERN = /\b(colombia|colombian[oa]s?|bogot[aá]|petro|latinoam[eé]rica|am[eé]rica latina|m[eé]xico|venezuela|argentina|brasil|chile|per[uú]|ecuador|bolivia|panam[aá]|cuba|caribe|centroam[eé]rica|mercosur|celac)\b/i;

/**
 * Como selectBestDiverseArticle, pero mira los primeros candidatos (en el mismo orden de prioridad) buscando
 * uno con video LIBRE del hecho, que sale como Reel (en Instagram los Reels tienen mucho más alcance).
 * La búsqueda se hace ANTES de gastar la llamada a la IA y solo cuesta consultas a YouTube.
 *  - required: solo vale una historia con video (pruebas a mano); si no hay, null.
 *  - si no: se revisan los primeros `lookahead` y, si ninguno tiene, gana el primero de siempre.
 */
async function selectPreferringVideo(
  candidates: RawArticle[],
  report: DailyEditorialReport,
  opts: { required?: boolean; lookahead?: number } = {}
): Promise<{ article: RawArticle; rationale: string } | null> {
  const limit = opts.required ? 15 : opts.lookahead ?? Number(process.env.VIDEO_LOOKAHEAD || 4);
  let pool = [...candidates];
  let first: { article: RawArticle; rationale: string } | null = null;
  for (let i = 0; i < limit && pool.length; i++) {
    const pick = selectBestDiverseArticle(pool, report);
    if (!pick) break;
    first = first || pick;
    pool = pool.filter((c) => c !== pick.article);
    const url = pick.article.link ? await resolveGoogleNewsUrl(pick.article.link).catch(() => undefined) : undefined;
    const { html } = url ? await fetchArticlePage(url) : { html: '' };
    const video = await findNewsVideo(pick.article.title, html ? [html] : [], { freeOnly: true }).catch(() => undefined);
    if (video?.license === 'cc-by') {
      console.log(`[AutonomousNewsroom] Con video libre (sale como Reel): "${pick.article.title}" → "${video.title}"`);
      return { article: { ...pick.article, video }, rationale: `${pick.rationale} · tiene video libre del hecho` };
    }
  }
  if (opts.required) return null;
  if (first) console.log('[AutonomousNewsroom] Ningún candidato cercano tiene video libre: sale como post con imagen');
  return first;
}

export function selectBestDiverseArticle(
  candidates: RawArticle[],
  report: DailyEditorialReport
): { article: RawArticle; rationale: string } | null {
  if (candidates.length === 0) return null;

  // Obtener la última categoría publicada o encolada para evitar repeticiones consecutivas
  const queue = [...getPublicationQueue()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const lastQueuedCategory = queue.length > 0 ? (queue[queue.length - 1].news.category as EditorialCategory) : null;

  let bestArticle: RawArticle | null = null;
  let highestScore = -Infinity;
  let bestRationale = '';

  for (const article of candidates) {
    const cat = article.category as EditorialCategory;
    const timesUsedToday = report.categoryDistribution[cat] || 0;

    let score = article.urgencyScore || 70;
    const rationaleParts: string[] = [`Urgencia base: ${score}`];

    // 1. Bono de diversidad temática
    if (timesUsedToday === 0) {
      score += 40; // Máxima prioridad si el tema no ha sido tocado hoy
      rationaleParts.push('+40 (Tema no cubierto hoy)');
    } else if (timesUsedToday === 1) {
      rationaleParts.push('+0 (Tema cubierto una vez)');
    } else {
      score -= 50; // Penalización severa para no monopolizar el día
      rationaleParts.push('-50 (Tema ya sobre-representado hoy)');
    }

    // 2. Penalización por consecutividad inmediata
    if (lastQueuedCategory && cat === lastQueuedCategory) {
      score -= 30;
      rationaleParts.push('-30 (Consecutivo con el último post)');
    }

    // 3. Prioridad especial a Tecnología & IA si está disponible
    if (cat === 'TECNOLOGÍA & IA' && timesUsedToday === 0) {
      score += 15;
      rationaleParts.push('+15 (Pilar Tech & IA prioritario)');
    }

    // 4. Frescura: las noticias de las últimas 3 horas suman
    const ageHours = (Date.now() - new Date(article.pubDate).getTime()) / 3_600_000;
    if (Number.isFinite(ageHours) && ageHours <= 3) {
      score += 10;
      rationaleParts.push('+10 (Publicada hace menos de 3 h)');
    }

    // 5. Relevancia real: cuantos más medios cuentan el mismo hecho, más importa (y más se busca)
    const coverage = article.coverageCount || 1;
    if (coverage > 1) {
      const bonus = Math.min(30, (coverage - 1) * 8);
      score += bonus;
      rationaleParts.push(`+${bonus} (Lo cubren ${coverage} medios)`);
    }

    // 6. Audiencia latinoamericana: los hechos de la región se comparten más
    if (LATAM_PATTERN.test(`${article.title} ${article.contentSnippet || ''}`)) {
      score += 8;
      rationaleParts.push('+8 (Relevante para Latinoamérica)');
    }

    if (score > highestScore) {
      highestScore = score;
      bestArticle = article;
      bestRationale = `Seleccionada [${cat}] con puntuación final ${score} pts. Motivo: ${rationaleParts.join(', ')}`;
    }
  }

  return bestArticle ? { article: bestArticle, rationale: bestRationale } : null;
}

export type CycleAction =
  | 'published_due'
  | 'queued_new'
  | 'quota_reached'
  | 'queue_full'
  | 'quiet_hours'
  | 'no_candidates'
  | 'breaking_emergency_published'
  | 'busy'
  | 'ai_unavailable'
  | 'error';

export interface CycleResult {
  success: boolean;
  actionTaken: CycleAction;
  message: string;
  report: DailyEditorialReport;
  news?: ProcessedNews;
  queuedItem?: QueuedPublication;
  dispatchedCount: number;
}

/**
 * Motor Autónomo Principal (protegido por candado: nunca corren dos ciclos a la vez).
 * Despacha lo vencido, investiga, selecciona con variedad temática, produce y encola.
 */
/** Titulares de análisis, explicadores u opinión: densos en palabras clave pero nunca "última hora" */
const ANALYSIS_MARKERS = /\?|¿|\b(preguntas|claves|qu[eé] significa|por qu[eé]|c[oó]mo|an[aá]lisis|opini[oó]n|lo que (hay que|debe|deber[ií]a)|explicad|guía|cr[oó]nica|entrevista|perfil|radiograf[ií]a)\b|^\s*(las|los)\s+\d+|\b(analysis|opinion|explainer|what to know|how to|why)\b|^\s*(las|los)\s+(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/i;
/** Hechos que sí son de última hora */
const EVENT_MARKERS = /\b([uú]ltima hora|urgente|en directo|en vivo|muere|muri[oó]|muertos?|fallec|asesin|atentado|explosi[oó]n|terremoto|sismo|tsunami|hurac[aá]n|ataque|bombarde|invade|invasi[oó]n|declara la guerra|golpe de estado|dimite|renuncia|destituid|arrestad|detenid|derrumb|desplom|quiebra|se estrell|accidente|evacua|alerta|cierra|suspende|killed|dies|dead|death toll|explosion|earthquake|hurricane|strike on|attack|invades|coup|resigns|arrested|collapse|crash|evacuat|ceasefire|hostages|breaking)\b/i;

/**
 * Última hora de verdad: urgencia alta, publicada hace poco, sin pinta de análisis,
 * y con un hecho concreto en el titular o cubierta por varios medios a la vez.
 * Antes bastaba la urgencia por palabras clave y un análisis sobre elecciones saltaba la cola.
 */
export function isTrueBreakingNews(c: RawArticle, threshold: number): boolean {
  if ((c.urgencyScore || 0) < threshold) return false;
  if (ANALYSIS_MARKERS.test(c.title)) return false;
  const severe = SEVERE_EVENT.test(c.title);
  // Un hecho grave sigue siendo noticia 8 h después; el resto de urgencias solo las primeras 3 h
  const maxAgeMs = (severe ? 8 : 3) * 3_600_000;
  const published = new Date(c.pubDate).getTime();
  if (!Number.isFinite(published) || Date.now() - published > maxAgeMs) return false;
  const coverage = c.coverageCount || 1;
  // Verificación por niveles: hecho grave de una fuente de primer nivel sale ya; de una fuente menor, solo con otro medio detrás
  if (severe && (c.tier1 || coverage >= 2)) return true;
  return coverage >= 3 || (EVENT_MARKERS.test(c.title) && coverage >= 2);
}

export async function runAutonomousNewsroomCycle(
  config: AutonomousConfig = getAutonomousConfig()
): Promise<CycleResult> {
  try {
    return await withFileLock('newsroom', () => runCycleUnlocked(config));
  } catch (err: any) {
    if (err instanceof LockBusyError) {
      return {
        success: true,
        actionTaken: 'busy',
        message: err.message,
        report: getDailyEditorialReport(config),
        dispatchedCount: 0,
      };
    }
    if (err instanceof AiUnavailableError) {
      return {
        success: true,
        actionTaken: 'ai_unavailable',
        message: err.message,
        report: getDailyEditorialReport(config),
        dispatchedCount: 0,
      };
    }
    console.error('[AutonomousNewsroom] Error en el ciclo:', err);
    return {
      success: false,
      actionTaken: 'error',
      message: err?.message || 'Error desconocido en el ciclo autónomo',
      report: getDailyEditorialReport(config),
      dispatchedCount: 0,
    };
  }
}

async function runCycleUnlocked(config: AutonomousConfig): Promise<CycleResult> {
  console.log('[AutonomousNewsroom] Iniciando ciclo de redacción autónoma...');

  // 1. Despachar la publicación en cola cuyo horario ya haya llegado
  const dispatchResult = await dispatchDueItems();
  const dispatchedCount = dispatchResult.processed;
  if (dispatchedCount > 0) {
    console.log(`[AutonomousNewsroom] Se despachó ${dispatchedCount} publicación vencida a las redes.`);
  }

  let report = getDailyEditorialReport(config);
  const now = new Date();
  const activeNow = isWithinActiveHours(now, config);

  // Si no hay nada que producir, no gastamos red ni IA
  const roomForRegular = activeNow && !report.quotaReached && report.pendingInQueue < config.maxPendingInQueue;
  const roomForBreaking = report.breakingToday < config.maxBreakingPerDay;
  if (!roomForRegular && !roomForBreaking) {
    return idle(report, dispatchedCount, config, activeNow);
  }

  // Sin IA no se produce nada (nunca se publican textos de plantilla)
  const aiCooldown = getAiCooldownUntil();
  if (aiCooldown) {
    return {
      success: true,
      actionTaken: 'ai_unavailable',
      message: `IA en pausa por cuota agotada hasta las ${new Date(aiCooldown).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}. Solo se despacha lo ya producido.`,
      report,
      dispatchedCount,
    };
  }

  // 2. Investigar feeds (el Scout ya excluye lo visto, lo encolado y lo repetido entre medios)
  console.log('[AutonomousNewsroom] Investigando feeds internacionales...');
  const maxAgeMs = config.maxArticleAgeHours * 3_600_000;
  let candidates = (await runNewsScout(6)).filter((c) => {
    const t = new Date(c.pubDate).getTime();
    return !Number.isFinite(t) || Date.now() - t <= maxAgeMs;
  });

  // 2.5 Fuera lo que ya cubrimos en las últimas 48 h aunque esté contado con otras palabras
  if (candidates.length && (roomForBreaking || roomForRegular)) {
    const since = Date.now() - 48 * 3_600_000;
    const recent = getPublicationQueue()
      .filter((q) => new Date(q.createdAt).getTime() >= since)
      .flatMap((q) => [q.news.originalTitle, q.news.article?.title || '']);
    candidates = await dropSemanticDuplicates(candidates, recent);
  }

  // 3. PROTOCOLO DE URGENCIA MÁXIMA: urgencia muy alta, con tope diario
  const criticalEmergency = roomForBreaking
    ? candidates.find((c) => isTrueBreakingNews(c, config.breakingThreshold) && (c.tier1 || report.breakingToday < config.maxBreakingPerDay - 1)) // el último cupo del día se reserva a fuentes de primer nivel
    : undefined;

  if (criticalEmergency) {
    console.log(`[AutonomousNewsroom] PROTOCOLO DE URGENCIA MÁXIMA: "${criticalEmergency.title}" [Urgencia: ${criticalEmergency.urgencyScore}%].`);

    const emergencyNews = await runEditorialPipeline(criticalEmergency);
    if (!emergencyNews.cardImageUrl) {
      throw new Error('No se pudo generar la tarjeta visual de la urgencia; se reintentará en el próximo ciclo.');
    }
    emergencyNews.articleUrl = await publishArticleToSite(emergencyNews);

    // Encolar marca la historia como cubierta ANTES de publicar: si falla una red, no se repite en las demás
    const emergencyItem = enqueuePublication(emergencyNews, config.activeChannels, undefined, {
      forceImmediate: true,
      isBreaking: true,
    });

    // En la nube el sitio se despliega DESPUÉS del ciclo: publicar ya dejaría el post sin enlace.
    // Con CLOUD_DEFER_PUBLISH queda vencida en la cola y la publica la fase "dispatch" tras el despliegue.
    const deferred = process.env.CLOUD_DEFER_PUBLISH === 'true';
    const dispatched = deferred ? undefined : await forcePublishQueuedItem(emergencyItem.id);
    report = getDailyEditorialReport(config);

    const emergencyMsg = `URGENCIA MÁXIMA DESPACHADA: "${emergencyNews.headline}" [${emergencyNews.category}] (${criticalEmergency.urgencyScore}%). Estado: ${deferred ? 'se publica en cuanto el artículo esté en línea' : dispatched?.status}.`;
    console.log(`[AutonomousNewsroom] ${emergencyMsg}`);

    return {
      success: true,
      actionTaken: 'breaking_emergency_published',
      message: emergencyMsg,
      report,
      news: emergencyNews,
      queuedItem: dispatched || emergencyItem,
      dispatchedCount: dispatchedCount + 1,
    };
  }

  if (!roomForRegular) {
    return idle(report, dispatchedCount, config, activeNow);
  }

  if (candidates.length === 0) {
    return {
      success: true,
      actionTaken: 'no_candidates',
      message: 'El Scout no encontró temas nuevos y frescos en este momento.',
      report,
      dispatchedCount,
    };
  }

  // 4. Seleccionar la historia óptima aplicando el algoritmo de diversidad temática
  const selection = await selectPreferringVideo(candidates, report, { required: config.requireVideo });
  if (!selection) {
    return {
      success: true,
      actionTaken: 'no_candidates',
      message: 'No se encontraron artículos elegibles tras el filtro de diversidad.',
      report,
      dispatchedCount,
    };
  }

  const { article: chosenArticle, rationale } = selection;
  console.log(`[AutonomousNewsroom] Noticia seleccionada: "${chosenArticle.title}" [${chosenArticle.category}]`);
  console.log(`[AutonomousNewsroom] Criterio: ${rationale}`);

  // 5. Pipeline de producción editorial (Investigador + Director + Redactor + Card Studio)
  const processedNews = await runEditorialPipeline(chosenArticle);
  if (!processedNews.cardImageUrl) {
    throw new Error('No se pudo generar la tarjeta visual; la noticia no se encola y se reintentará.');
  }

  // 5.5. Agente 7 (Editor Web): el artículo completo sale al sitio antes que los posts que lo enlazan
  processedNews.articleUrl = await publishArticleToSite(processedNews);

  // 6. Encolar con el horario calculado (espaciado + jitter + horario activo)
  const scheduledTime = calculateNextPostSchedule(config);
  const queuedItem = enqueuePublication(processedNews, config.activeChannels, undefined, {
    scheduledFor: scheduledTime,
  });

  report = getDailyEditorialReport(config);
  const successMsg = `Historia procesada: "${processedNews.headline}" [${processedNews.category}]. Programada para las ${scheduledTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}. Cupo diario: ${report.totalToday}/${config.maxDailyPosts}.`;
  console.log(`[AutonomousNewsroom] ${successMsg}`);

  return {
    success: true,
    actionTaken: 'queued_new',
    message: successMsg,
    report,
    news: processedNews,
    queuedItem,
    dispatchedCount,
  };
}

function idle(
  report: DailyEditorialReport,
  dispatchedCount: number,
  config: AutonomousConfig,
  activeNow: boolean
): CycleResult {
  let actionTaken: CycleAction;
  let message: string;
  if (!activeNow) {
    actionTaken = 'quiet_hours';
    message = `Fuera del horario activo (${config.activeHoursStart}:00-${config.activeHoursEnd}:00). Solo se vigilan urgencias.`;
  } else if (report.quotaReached) {
    actionTaken = 'quota_reached';
    message = `Cupo diario completado (${report.totalToday}/${report.maxDailyPosts}).`;
  } else {
    actionTaken = 'queue_full';
    message = `Ya hay ${report.pendingInQueue} historias esperando en cola (máx. ${config.maxPendingInQueue}).`;
  }
  if (dispatchedCount > 0) {
    actionTaken = 'published_due';
    message = `Publicación vencida despachada. ${message}`;
  }
  return { success: true, actionTaken, message, report, dispatchedCount };
}
