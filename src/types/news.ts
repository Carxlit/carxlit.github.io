export type EditorialCategory = 
  | 'GEOPOLÍTICA'
  | 'SEGURIDAD & DEFENSA'
  | 'ECONOMÍA GLOBAL'
  | 'PODER & SOCIEDAD'
  | 'TECNOLOGÍA & IA';

export type LegacyCategory = 
  | 'mundo' 
  | 'tecnologia' 
  | 'deportes' 
  | 'economia' 
  | 'insolito' 
  | 'seguridad';

export type NewsCategory = LegacyCategory | EditorialCategory | string;

export interface RawArticle {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  sourceName: string;
  category: NewsCategory;
  imageUrl?: string;
  urgencyScore?: number;
  geopoliticalImpact?: number;
  /** Cuántos medios publicaron el mismo hecho en la ronda del Scout */
  coverageCount?: number;
}

export interface MultiPlatformCopies {
  facebook: string; // 2-3 párrafos de contexto + pregunta reflexiva
  telegram: string; // Formato ejecutivo con viñetas HTML
  linkedIn: string; // Análisis macroeconómico/estratégico
  bluesky: string; // Micro-análisis con gancho y hashtags (<300 caracteres para AT Protocol)
  x?: string; // Opcional (deprecado)
}

export interface ProcessedNews {
  id: string;
  originalUrl: string;
  originalTitle: string;
  sourceName: string;
  category: NewsCategory;
  urgencyScore: number; // 60-99
  headline: string; // Titular corto en mayúsculas para la imagen
  subHeadline: string; // Bajada de título para la imagen
  blindSpotAngle?: string; // Lo que otros medios pasan por alto
  facebookPost: string; // Texto completo para Facebook
  xPost?: string; // Hook directo de alto impacto (<240 caracteres) para X
  telegramPost?: string; // Briefing ejecutivo estructurado para Telegram
  linkedInPost?: string; // Análisis estratégico y geopolítico para LinkedIn
  blueskyPost?: string; // Post analítico para Bluesky
  copies?: MultiPlatformCopies; // Conjunto unificado de copies
  cardImageUrl?: string; // Ruta de la imagen editorial generada
  rawImageUrl?: string;
  publishedAt?: string;
  facebookPostId?: string;
  telegramMessageId?: string;
  xTweetId?: string;
  linkedInPostId?: string;
  blueskyPostId?: string;
  article?: NewsArticle; // Artículo completo para el sitio web
  articleUrl?: string; // URL pública del artículo (se adjunta en los posts si está en línea)
  status: 'pending' | 'approved' | 'published' | 'rejected';
  createdAt: string;
}

export interface NewsArticle {
  slug: string;
  title: string;
  dek: string;
  keyFacts: string[];
  sections: { heading: string; paragraphs: string[] }[];
  tags: string[];
  sources: { name: string; title: string; url: string }[];
  wordCount: number;
}

export interface ChannelSelection {
  facebook: boolean;
  telegram: boolean;
  bluesky: boolean;
  linkedIn: boolean;
  twitter?: boolean;
}

export interface ChannelResult {
  success: boolean;
  simulated?: boolean;
  skipped?: boolean; // Canal sin credenciales: no se intentó y no bloquea la publicación
  error?: string;
}

export interface QueuedPublication {
  id: string;
  news: ProcessedNews;
  channels: ChannelSelection;
  customCopies?: {
    facebook?: string;
    twitter?: string;
    telegram?: string;
    linkedIn?: string;
    bluesky?: string;
  };
  scheduledFor: string; // Fecha ISO calculada con anti-spam jitter (45 a 75 min)
  status: 'queued' | 'publishing' | 'published' | 'failed' | 'expired';
  healAttempts?: number; // Reintentos del Auditor tras agotar maxAttempts
  isBreaking?: boolean; // Publicada por el Protocolo de Urgencia Máxima
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  publishedAt?: string;
  error?: string;
  results?: {
    facebook?: ChannelResult & { postId?: string };
    telegram?: ChannelResult & { messageId?: string };
    twitter?: ChannelResult & { tweetId?: string };
    linkedIn?: ChannelResult & { postId?: string };
    bluesky?: ChannelResult & { uri?: string };
  };
  createdAt: string;
}

export interface NewsConfig {
  autoPilot: boolean;
  checkIntervalMinutes: number;
  brandName: string;
  badgeText: string;
  badgeColor: string;
  selectedCategories: NewsCategory[];
  facebookPageId?: string;
  facebookAccessToken?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  xApiKey?: string;
  xApiSecret?: string;
  xAccessToken?: string;
  xAccessSecret?: string;
  linkedInAccessToken?: string;
  linkedInOrganizationId?: string;
  blueskyHandle?: string;
  blueskyPassword?: string;
}
