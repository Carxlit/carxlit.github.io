import fs from 'fs';
import path from 'path';
import { ProcessedNews } from '@/types/news';
import { publishToFacebook } from './facebook-publisher';
import { publishToLinkedInCompany } from './linkedin-publisher';
import { getBlueskySession, invalidateBlueskySession, buildFacets } from './bluesky-client';
import { composeBlueskyText } from './post-links';

export interface MultiPublishConfig {
  facebook?: {
    enabled: boolean;
    pageId?: string;
    accessToken?: string;
  };
  telegram?: {
    enabled: boolean;
    botToken?: string;
    chatId?: string; // e.g. @MiCanalDeNoticias
  };
  twitter?: {
    enabled: boolean;
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    accessSecret?: string;
  };
  linkedIn?: {
    enabled: boolean;
    accessToken?: string;
    organizationId?: string;
  };
  bluesky?: {
    enabled: boolean;
    handle?: string;
    password?: string;
  };
}

export interface MultiPublishResult {
  facebook?: { success: boolean; postId?: string; simulated?: boolean; error?: string };
  telegram?: { success: boolean; messageId?: string; simulated?: boolean; error?: string };
  twitter?: { success: boolean; tweetId?: string; simulated?: boolean; error?: string };
  linkedIn?: { success: boolean; postId?: string; simulated?: boolean; error?: string };
  bluesky?: { success: boolean; uri?: string; simulated?: boolean; error?: string };
}

const TELEGRAM_ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'a', 'code', 'pre', 'blockquote']);

function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Deja solo las etiquetas que acepta Telegram (<p>, <br>, <ul>… rompen el parse_mode HTML)
 * y escapa los "<" y "&" sueltos que escriba la IA.
 */
export function sanitizeTelegramHtml(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n');

  const tokens = withBreaks.split(/(<\/?[a-zA-Z][^>]*>)/g);
  const open: string[] = [];
  let out = '';
  for (const token of tokens) {
    const tag = token.match(/^<(\/?)([a-zA-Z]+)([^>]*)>$/);
    if (!tag) {
      out += token.replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      continue;
    }
    const [, closing, rawName, attrs] = tag;
    const name = rawName.toLowerCase();
    if (!TELEGRAM_ALLOWED_TAGS.has(name)) continue;
    if (closing) {
      const idx = open.lastIndexOf(name);
      if (idx === -1) continue;
      while (open.length > idx) out += `</${open.pop()}>`;
    } else if (name === 'a') {
      const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
      if (!href) continue;
      out += `<a href="${escapeTelegramHtml(href)}">`;
      open.push('a');
    } else {
      out += `<${name}>`;
      open.push(name);
    }
  }
  while (open.length) out += `</${open.pop()}>`;
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Publica una noticia con imagen en un Canal de Telegram mediante la Bot API oficial
 */
export async function publishToTelegram(
  news: ProcessedNews,
  botToken?: string,
  chatId?: string
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  const channel = chatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !channel) {
    return {
      success: true,
      simulated: true,
      messageId: `sim-tg-${Date.now()}`,
    };
  }

  try {
    const fullImagePath = news.cardImageUrl
      ? path.join(process.cwd(), 'public', news.cardImageUrl.replace(/^\//, ''))
      : null;

    if (!fullImagePath || !fs.existsSync(fullImagePath)) {
      throw new Error('La imagen de la portada no existe en disco.');
    }

    const imageBuffer = fs.readFileSync(fullImagePath);
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });

    const headline = escapeTelegramHtml(news.headline);
    const body = sanitizeTelegramHtml(news.telegramPost || news.facebookPost || '');
    // El Redactor ya suele abrir el memorando con el titular: no repetirlo
    const bodyHasHeadline = stripTags(body).toUpperCase().includes(news.headline.toUpperCase().slice(0, 40));
    const sourceLine = news.originalUrl
      ? `<i>Fuente: <a href="${escapeTelegramHtml(news.originalUrl)}">${escapeTelegramHtml(news.sourceName)}</a></i>`
      : `<i>Fuente: ${escapeTelegramHtml(news.sourceName)}</i>`;
    const articleLine = news.articleUrl
      ? `<b><a href="${escapeTelegramHtml(news.articleUrl)}">Leer el análisis completo</a></b>`
      : '';
    const fullText = [bodyHasHeadline ? '' : `<b>${headline}</b>`, body, articleLine, sourceLine].filter(Boolean).join('\n\n');

    // Caption de foto: máx. 1024 caracteres visibles. Si no cabe, la foto lleva el titular
    // y el memorando completo va en un mensaje aparte (máx. 4096), sin cortar etiquetas HTML.
    const fitsInCaption = stripTags(fullText).length <= 1000;
    const caption = fitsInCaption ? fullText : [`<b>${headline}</b>`, articleLine].filter(Boolean).join('\n\n');

    const formData = new FormData();
    formData.append('chat_id', channel);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    formData.append('photo', blob, 'news.jpg');

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.description || 'Error al comunicarse con Telegram API');
    }

    if (!fitsInCaption) {
      const textToSend = stripTags(fullText).length <= 4000 ? fullText : escapeTelegramHtml(stripTags(fullText).slice(0, 3990)) + '…';
      const msgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channel,
          text: textToSend,
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_parameters: { message_id: data.result?.message_id },
        }),
        signal: AbortSignal.timeout(15000),
      });
      const msgData = await msgRes.json();
      if (!msgRes.ok || !msgData.ok) {
        // La foto ya salió: no fallar el canal entero (provocaría reenviar la foto)
        console.warn('[Telegram] Foto enviada pero el memorando falló:', msgData.description);
      }
    }

    return {
      success: true,
      messageId: String(data.result?.message_id),
      simulated: false,
    };
  } catch (error: any) {
    console.error('Error al publicar en Telegram:', error);
    return {
      success: false,
      error: error?.message || 'Error en Telegram',
    };
  }
}

/**
 * Publica un tweet en X mediante Twitter API v2
 */
export async function publishToX(
  news: ProcessedNews,
  apiKey?: string,
  apiSecret?: string,
  accessToken?: string,
  accessSecret?: string
) {
  const finalApiKey = apiKey || process.env.X_API_KEY;
  const finalApiSecret = apiSecret || process.env.X_API_SECRET;
  const finalToken = accessToken || process.env.X_ACCESS_TOKEN;
  const finalSecret = accessSecret || process.env.X_ACCESS_SECRET;

  if (!finalApiKey || !finalApiSecret || !finalToken || !finalSecret) {
    return { success: true, simulated: true, tweetId: `sim-x-${Date.now()}` };
  }

  try {
    const { TwitterApi } = await import('twitter-api-v2');
    const client = new TwitterApi({
      appKey: finalApiKey,
      appSecret: finalApiSecret,
      accessToken: finalToken,
      accessSecret: finalSecret,
    });

    const tweetText = news.xPost || `${news.headline}\n\n${news.subHeadline}\n\n#PuntoCiego #Internacional`;
    const tweet = await client.v2.tweet(tweetText.slice(0, 275));

    return {
      success: true,
      tweetId: tweet.data?.id,
      simulated: false,
    };
  } catch (err: any) {
    console.error('Error al publicar en X:', err);
    return {
      success: false,
      error: err?.message || 'Error al publicar en X',
    };
  }
}

/**
 * Publica un post en Bluesky mediante AT Protocol con imagen opcional
 */
export async function publishToBluesky(
  news: ProcessedNews,
  handle?: string,
  password?: string
) {
  const finalHandle = handle || process.env.BLUESKY_HANDLE;
  const finalPass = password || process.env.BLUESKY_APP_PASSWORD;

  if (!finalHandle || !finalPass) {
    return { success: true, simulated: true, uri: `sim-bsky-${Date.now()}` };
  }

  try {
    const session = await getBlueskySession(finalHandle, finalPass);

    const { text, link } = composeBlueskyText(
      news.blueskyPost || news.xPost || `${news.headline}: ${news.subHeadline} #PuntoCiego`,
      news.articleUrl
    );

    // Intentar subir imagen de portada a Bluesky
    let imageEmbed: any = undefined;
    if (news.cardImageUrl) {
      try {
        const fullImagePath = path.join(process.cwd(), 'public', news.cardImageUrl.replace(/^\//, ''));
        if (fs.existsSync(fullImagePath)) {
          const imageBuffer = fs.readFileSync(fullImagePath);
          const uploadRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
            method: 'POST',
            headers: {
              'Content-Type': 'image/jpeg',
              Authorization: `Bearer ${session.accessJwt}`,
            },
            body: imageBuffer,
          });
          const uploadData = await uploadRes.json();
          if (uploadRes.ok && uploadData.blob) {
            imageEmbed = {
              $type: 'app.bsky.embed.images',
              images: [
                {
                  alt: `${news.headline}. ${news.subHeadline || ''}`.slice(0, 1000),
                  image: uploadData.blob,
                  aspectRatio: { width: 1200, height: 630 },
                },
              ],
            };
          }
        }
      } catch (blobErr) {
        console.warn('[Bluesky] Advertencia al subir blob de imagen:', blobErr);
      }
    }

    const record: any = {
      $type: 'app.bsky.feed.post',
      text,
      langs: ['es'],
      createdAt: new Date().toISOString(),
    };
    const facets = buildFacets(text);
    if (link) {
      // Enlace con texto corto visible y la URL completa en el facet
      const start = text.lastIndexOf(link.display);
      const enc = new TextEncoder();
      facets.push({
        index: { byteStart: enc.encode(text.slice(0, start)).length, byteEnd: enc.encode(text.slice(0, start + link.display.length)).length },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: link.url }],
      });
    }
    if (facets.length > 0) record.facets = facets;

    if (imageEmbed) {
      record.embed = imageEmbed;
    }

    const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record,
      }),
    });
    const postData = await postRes.json();
    if (postRes.status === 401) invalidateBlueskySession();
    if (!postRes.ok) throw new Error(postData.message || 'Error al crear record en Bluesky');

    return { success: true, simulated: false, uri: postData.uri };
  } catch (err: any) {
    console.error('Error al publicar en Bluesky:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Publicador omnicanal: envía a Facebook, Telegram, X, Bluesky y LinkedIn
 */
export async function publishOmnichannel(
  news: ProcessedNews,
  config?: MultiPublishConfig
): Promise<MultiPublishResult> {
  const results: MultiPublishResult = {};

  // 1. Facebook
  results.facebook = await publishToFacebook(
    news,
    config?.facebook?.pageId,
    config?.facebook?.accessToken
  );

  // 2. Telegram
  if (config?.telegram?.enabled || process.env.TELEGRAM_BOT_TOKEN) {
    results.telegram = await publishToTelegram(
      news,
      config?.telegram?.botToken,
      config?.telegram?.chatId
    );
  }

  // 3. X (Twitter)
  if (config?.twitter?.enabled || process.env.X_API_KEY) {
    results.twitter = await publishToX(
      news,
      config?.twitter?.apiKey,
      config?.twitter?.apiSecret,
      config?.twitter?.accessToken,
      config?.twitter?.accessSecret
    );
  }

  // 4. Bluesky
  if (config?.bluesky?.enabled || process.env.BLUESKY_HANDLE) {
    results.bluesky = await publishToBluesky(
      news,
      config?.bluesky?.handle,
      config?.bluesky?.password
    );
  }

  // 5. LinkedIn (Página de Empresa Punto Ciego vía CDP)
  if (config?.linkedIn?.enabled) {
    results.linkedIn = await publishToLinkedInCompany(news);
  }

  return results;
}

