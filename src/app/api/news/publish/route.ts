import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { publishOmnichannel } from '@/lib/news/multi-publisher';
import { markUrlAsSeen } from '@/lib/news/rss-monitor';
import { recordNewsInHistory } from '@/lib/agents/news-scout';
import { ProcessedNews, ChannelSelection } from '@/types/news';

const PUBLISHED_STORE_PATH = path.join(process.cwd(), 'storage', 'published_news.json');

function saveToPublishedHistory(news: ProcessedNews) {
  try {
    const dir = path.dirname(PUBLISHED_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let history: ProcessedNews[] = [];
    if (fs.existsSync(PUBLISHED_STORE_PATH)) {
      history = JSON.parse(fs.readFileSync(PUBLISHED_STORE_PATH, 'utf-8'));
    }
    history.unshift(news);
    if (history.length > 200) history = history.slice(0, 200);

    fs.writeFileSync(PUBLISHED_STORE_PATH, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('Error al guardar en historial de publicados:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      news, 
      channels, 
      customCopies, 
      pageId, 
      accessToken, 
      telegramToken, 
      telegramChatId,
      blueskyHandle,
      blueskyPassword
    } = body as {
      news: ProcessedNews;
      channels?: ChannelSelection;
      customCopies?: { facebook?: string; telegram?: string; linkedIn?: string; bluesky?: string };
      pageId?: string;
      accessToken?: string;
      telegramToken?: string;
      telegramChatId?: string;
      blueskyHandle?: string;
      blueskyPassword?: string;
    };

    if (!news) {
      return NextResponse.json(
        { error: 'Se requiere el objeto de noticia para publicar.' },
        { status: 400 }
      );
    }

    // Configurar copies específicos por red
    const newsToPublish: ProcessedNews = {
      ...news,
      facebookPost: customCopies?.facebook || news.facebookPost,
      telegramPost: customCopies?.telegram || news.telegramPost,
      linkedInPost: customCopies?.linkedIn || news.linkedInPost,
      blueskyPost: customCopies?.bluesky || news.blueskyPost,
    };

    const targetChannels: ChannelSelection = channels || {
      facebook: true,
      telegram: Boolean(telegramToken || process.env.TELEGRAM_BOT_TOKEN),
      bluesky: Boolean(blueskyHandle || process.env.BLUESKY_HANDLE),
      linkedIn: true,
    };

    const results = await publishOmnichannel(newsToPublish, {
      facebook: {
        enabled: targetChannels.facebook,
        pageId,
        accessToken,
      },
      telegram: {
        enabled: targetChannels.telegram && Boolean(telegramToken || process.env.TELEGRAM_BOT_TOKEN),
        botToken: telegramToken,
        chatId: telegramChatId,
      },
      bluesky: {
        enabled: Boolean(targetChannels.bluesky),
        handle: blueskyHandle || process.env.BLUESKY_HANDLE,
        password: blueskyPassword || process.env.BLUESKY_APP_PASSWORD,
      },
      linkedIn: {
        enabled: targetChannels.linkedIn,
      },
    });

    const fbSuccess = !targetChannels.facebook || results.facebook?.success;

    if (fbSuccess) {
      newsToPublish.status = 'published';
      newsToPublish.publishedAt = new Date().toISOString();
      if (results.facebook?.postId) {
        newsToPublish.facebookPostId = results.facebook.postId;
      }
      if (results.telegram?.messageId) {
        newsToPublish.telegramMessageId = results.telegram.messageId;
      }
      if (results.linkedIn?.postId) {
        newsToPublish.linkedInPostId = results.linkedIn.postId;
      }
      if (results.bluesky?.uri) {
        newsToPublish.blueskyPostId = results.bluesky.uri;
      }

      // Marcar URL y firma temática en el historial
      if (newsToPublish.originalUrl) {
        markUrlAsSeen(newsToPublish.originalUrl);
        recordNewsInHistory(newsToPublish.originalUrl, newsToPublish.headline || newsToPublish.originalTitle);
      }

      saveToPublishedHistory(newsToPublish);

      return NextResponse.json({
        success: true,
        postId: results.facebook?.postId,
        simulated: results.facebook?.simulated,
        telegram: results.telegram,
        bluesky: results.bluesky,
        twitter: results.twitter,
        linkedIn: results.linkedIn,
        news: newsToPublish,
      });
    } else {
      return NextResponse.json(
        { success: false, error: results.facebook?.error || 'Error al publicar en las redes seleccionadas' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error al publicar noticia:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno al publicar' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    if (!fs.existsSync(PUBLISHED_STORE_PATH)) {
      return NextResponse.json({ history: [] });
    }
    const history = JSON.parse(fs.readFileSync(PUBLISHED_STORE_PATH, 'utf-8'));
    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ history: [] });
  }
}
