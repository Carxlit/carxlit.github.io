import { NextRequest, NextResponse } from 'next/server';
import { 
  getPublicationQueue, 
  enqueuePublication, 
  cancelQueuedPublication, 
  forcePublishQueuedItem,
  dispatchDueItems 
} from '@/lib/agents/queue-dispatcher';
import { ProcessedNews, ChannelSelection } from '@/types/news';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const queue = getPublicationQueue();

    // Ordenar: primero los encolados pendientes por fecha, luego publicados/fallidos
    const sortedQueue = [...queue].sort((a, b) => {
      if (a.status === 'queued' && b.status === 'queued') {
        return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const pending = sortedQueue.filter((q) => q.status === 'queued');
    const nextItem = pending[0] || null;

    let nextEtaMinutes: number | null = null;
    if (nextItem) {
      const diffMs = new Date(nextItem.scheduledFor).getTime() - Date.now();
      nextEtaMinutes = Math.max(0, Math.round(diffMs / (60 * 1000)));
    }

    return NextResponse.json({
      success: true,
      queue: sortedQueue,
      totalCount: queue.length,
      pendingCount: pending.length,
      nextEtaMinutes,
      nextItem,
    });
  } catch (error: any) {
    console.error('[API /api/news/queue] Error al obtener cola:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al leer la cola' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      action, 
      news, 
      channels, 
      customCopies, 
      options, 
      id,
      credentials 
    } = body as {
      action?: 'enqueue' | 'dispatch_due' | 'force_publish';
      news?: ProcessedNews;
      channels?: ChannelSelection;
      customCopies?: { facebook?: string; twitter?: string; telegram?: string; linkedIn?: string };
      options?: { forceImmediate?: boolean; minJitterMinutes?: number; maxJitterMinutes?: number };
      id?: string;
      credentials?: {
        facebookPageId?: string;
        facebookAccessToken?: string;
        telegramBotToken?: string;
        telegramChatId?: string;
      };
    };

    // 1. Forzar publicación inmediata de un elemento existente en cola
    if (action === 'force_publish' && id) {
      const updated = await forcePublishQueuedItem(id, credentials);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: 'Elemento no encontrado en la cola' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, item: updated });
    }

    // 2. Procesar ítems vencidos en la cola
    if (action === 'dispatch_due') {
      const result = await dispatchDueItems(credentials);
      return NextResponse.json({ success: true, ...result });
    }

    // 3. Encolar nueva noticia con Anti-Spam Jitter
    if (!news) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el objeto "news" para encolar' },
        { status: 400 }
      );
    }

    const selectedChannels: ChannelSelection = channels || {
      facebook: true,
      telegram: false,
      bluesky: true,
      linkedIn: false,
    };

    const queuedItem = enqueuePublication(
      news, 
      selectedChannels, 
      customCopies, 
      options || { minJitterMinutes: 45, maxJitterMinutes: 75 }
    );

    return NextResponse.json({
      success: true,
      message: options?.forceImmediate 
        ? 'Publicación programada de inmediato.' 
        : `Encolado con éxito. Hora estimada: ${new Date(queuedItem.scheduledFor).toLocaleTimeString()}`,
      queuedItem,
    });
  } catch (error: any) {
    console.error('[API /api/news/queue POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error en la cola' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Parámetro id es obligatorio' },
        { status: 400 }
      );
    }

    const removed = cancelQueuedPublication(id);
    if (!removed) {
      return NextResponse.json(
        { success: false, error: 'No se encontró el elemento a cancelar' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Elemento cancelado y eliminado de la cola' });
  } catch (error: any) {
    console.error('[API /api/news/queue DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al eliminar de la cola' },
      { status: 500 }
    );
  }
}
