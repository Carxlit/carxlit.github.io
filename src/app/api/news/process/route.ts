import { NextRequest, NextResponse } from 'next/server';
import { runEditorialPipeline } from '@/lib/agents/orchestrator';
import { RawArticle, NewsConfig } from '@/types/news';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { article, config } = body as { article: RawArticle; config?: Partial<NewsConfig> };

    if (!article || !article.title) {
      return NextResponse.json(
        { error: 'El artículo es requerido para procesar.' },
        { status: 400 }
      );
    }

    // Ejecuta el pipeline multi-agente completo (Director Editorial + Redactor Omnicanal + Card Studio)
    const processed = await runEditorialPipeline(article, config);

    return NextResponse.json({
      success: true,
      news: processed,
    });
  } catch (error: any) {
    console.error('[API /api/news/process] Error al procesar noticia:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno en el pipeline multi-agente' },
      { status: 500 }
    );
  }
}
