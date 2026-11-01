import { NextResponse } from 'next/server';
import { runNewsScout } from '@/lib/agents/news-scout';
import { fetchLatestNews } from '@/lib/news/rss-monitor';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Agente 1: News Scout con fuentes ampliadas y deduplicación semántica
    let rawArticles = await runNewsScout(3);

    // Fallback de seguridad en caso de fallo en feeds externos
    if (!rawArticles || rawArticles.length === 0) {
      rawArticles = await fetchLatestNews(4);
    }

    return NextResponse.json({
      success: true,
      articles: rawArticles,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error al consultar radar de noticias:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al obtener fuentes RSS' },
      { status: 500 }
    );
  }
}
