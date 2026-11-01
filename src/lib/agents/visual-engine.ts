import { ProcessedNews, NewsConfig } from '@/types/news';
import { generateNewsCardImage } from '@/lib/news/card-generator';

export interface CardGenerationOptions {
  width?: number;
  height?: number;
  quality?: number;
  brandName?: string;
}

/**
 * Agente 4: Director de Arte / Card Studio
 * Mantiene la probada composición visual split-screen de Punto Ciego (62% foto limpia, 38% editorial)
 * con renderizado de alta velocidad y fidelidad en Playwright.
 */
export async function runVisualEngine(
  news: ProcessedNews,
  options?: CardGenerationOptions,
  config?: Partial<NewsConfig>
): Promise<string> {
  return generateNewsCardImage(news, config);
}
