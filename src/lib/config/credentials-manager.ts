import { threadsConfigured } from '@/lib/news/threads-publisher';
import { youtubeConfigured } from '@/lib/news/youtube-publisher';
import fs from 'fs';
import path from 'path';

export interface StoredCredentials {
  facebookPageId?: string;
  facebookAccessToken?: string;
  telegramToken?: string;
  telegramChatId?: string;
  blueskyHandle?: string;
  blueskyPassword?: string;
  brandName?: string;
  updatedAt?: string;
}

export interface FacebookValidationResult {
  valid: boolean;
  isPageToken: boolean;
  pageId?: string;
  pageName?: string;
  resolvedToken?: string;
  error?: string;
  expiresIn?: string;
}

const CREDENTIALS_PATH = path.join(process.cwd(), 'storage', 'credentials.json');
const ENV_LOCAL_PATH = path.join(process.cwd(), '.env.local');

/**
 * Obtiene las credenciales guardadas en storage/credentials.json o en .env.local
 */
export function getStoredCredentials(): StoredCredentials {
  try {
    if (fs.existsSync(CREDENTIALS_PATH)) {
      const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
      const data = JSON.parse(raw);
      return {
        facebookPageId: data.facebookPageId || process.env.FACEBOOK_PAGE_ID || '1418440394683304',
        facebookAccessToken: data.facebookAccessToken || process.env.FACEBOOK_ACCESS_TOKEN,
        telegramToken: data.telegramToken || process.env.TELEGRAM_BOT_TOKEN,
        telegramChatId: data.telegramChatId || process.env.TELEGRAM_CHAT_ID,
        blueskyHandle: data.blueskyHandle || process.env.BLUESKY_HANDLE,
        blueskyPassword: data.blueskyPassword || process.env.BLUESKY_APP_PASSWORD,
        brandName: data.brandName || process.env.PAGE_BRAND_NAME || 'Punto Ciego',
        updatedAt: data.updatedAt,
      };
    }
  } catch (err) {
    console.error('[CredentialsManager] Error al leer credentials.json:', err);
  }

  return {
    facebookPageId: process.env.FACEBOOK_PAGE_ID || '1418440394683304',
    facebookAccessToken: process.env.FACEBOOK_ACCESS_TOKEN,
    telegramToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    blueskyHandle: process.env.BLUESKY_HANDLE,
    blueskyPassword: process.env.BLUESKY_APP_PASSWORD,
    brandName: process.env.PAGE_BRAND_NAME || 'Punto Ciego',
  };
}

/**
 * Canales que tienen credenciales reales. Un canal sin credenciales se omite
 * en vez de "simular" un éxito falso.
 */
export function getConfiguredChannels(creds: StoredCredentials = getStoredCredentials()) {
  return {
    facebook: Boolean(creds.facebookPageId && creds.facebookAccessToken),
    telegram: Boolean(creds.telegramToken && creds.telegramChatId),
    bluesky: Boolean(creds.blueskyHandle && creds.blueskyPassword),
    // LinkedIn: webhook de Make (funciona en la nube) o CDP con Brave local; en la nube sin webhook → LINKEDIN_ENABLED=false
    linkedIn: Boolean(process.env.LINKEDIN_WEBHOOK_URL) || process.env.LINKEDIN_ENABLED !== 'false',
    // Instagram: cuenta profesional vinculada a la página (ACTIVAR_NUBE detecta su ID) + el mismo token de página
    instagram: Boolean(process.env.INSTAGRAM_USER_ID && creds.facebookAccessToken),
    // Reels de la página de Facebook (video generado con Piper + ffmpeg; solo donde están instalados)
    facebookReel: Boolean(process.env.REELS_ENABLED === 'true' && creds.facebookPageId && creds.facebookAccessToken),
    mastodon: Boolean(process.env.MASTODON_INSTANCE && process.env.MASTODON_TOKEN),
    threads: threadsConfigured(),
    youtube: youtubeConfigured(),
  };
}

/**
 * Guarda credenciales en storage/credentials.json y sincroniza .env.local y process.env
 */
export function saveStoredCredentials(updates: Partial<StoredCredentials>): StoredCredentials {
  const current = getStoredCredentials();
  const updated: StoredCredentials = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  try {
    const dir = path.dirname(CREDENTIALS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(updated, null, 2));

    // Actualizar variables en proceso en memoria
    if (updated.facebookAccessToken) process.env.FACEBOOK_ACCESS_TOKEN = updated.facebookAccessToken;
    if (updated.facebookPageId) process.env.FACEBOOK_PAGE_ID = updated.facebookPageId;
    if (updated.telegramToken) process.env.TELEGRAM_BOT_TOKEN = updated.telegramToken;
    if (updated.telegramChatId) process.env.TELEGRAM_CHAT_ID = updated.telegramChatId;
    if (updated.blueskyHandle) process.env.BLUESKY_HANDLE = updated.blueskyHandle;
    if (updated.blueskyPassword) process.env.BLUESKY_APP_PASSWORD = updated.blueskyPassword;
    if (updated.brandName) process.env.PAGE_BRAND_NAME = updated.brandName;

    // Actualizar .env.local para persistencia completa
    syncEnvLocal(updated);
  } catch (err) {
    console.error('[CredentialsManager] Error al guardar credenciales:', err);
  }

  return updated;
}

/**
 * Valida un token contra la API de Meta Graph y, si es un token de usuario,
 * extrae automáticamente el Page Access Token oficial de "Punto Ciego"
 */
export async function validateFacebookToken(
  token: string,
  targetPageId: string = '1418440394683304'
): Promise<FacebookValidationResult> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { valid: false, isPageToken: false, error: 'El token proporcionado está vacío.' };
  }

  try {
    // 1. Probar consulta directa como Page Token sobre la página objetivo
    const pageCheckRes = await fetch(
      `https://graph.facebook.com/v19.0/${targetPageId}?fields=id,name,can_post&access_token=${cleanToken}`,
      { method: 'GET' }
    );
    const pageData = await pageCheckRes.json();

    if (pageCheckRes.ok && pageData && !pageData.error) {
      return {
        valid: true,
        isPageToken: true,
        pageId: pageData.id,
        pageName: pageData.name || 'Punto Ciego',
        resolvedToken: cleanToken,
      };
    }

    // 2. Si no funcionó como Page Token directo, verificar /me para entender si es un User Token
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${cleanToken}`,
      { method: 'GET' }
    );
    const meData = await meRes.json();

    if (!meRes.ok || meData.error) {
      const errMsg = meData?.error?.message || pageData?.error?.message || 'Error al validar token con Meta Graph API';
      return {
        valid: false,
        isPageToken: false,
        error: errMsg,
      };
    }

    // 3. Es un User Token válido: intentar resolver el Page Access Token mediante /me/accounts
    const accountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,tasks&access_token=${cleanToken}`,
      { method: 'GET' }
    );
    const accountsData = await accountsRes.json();

    if (accountsRes.ok && Array.isArray(accountsData?.data)) {
      const targetPage = accountsData.data.find(
        (p: any) => p.id === targetPageId || p.name?.toLowerCase().includes('punto ciego')
      );

      if (targetPage && targetPage.access_token) {
        return {
          valid: true,
          isPageToken: true,
          pageId: targetPage.id,
          pageName: targetPage.name,
          resolvedToken: targetPage.access_token,
        };
      } else {
        const availablePages = accountsData.data.map((p: any) => `${p.name} (ID: ${p.id})`).join(', ');
        return {
          valid: false,
          isPageToken: false,
          error: `El usuario (${meData.name}) no administra la página con ID ${targetPageId}. Páginas encontradas: ${availablePages || 'ninguna'}. Asegúrate de otorgar permisos a la aplicación sobre Punto Ciego.`,
        };
      }
    }

    return {
      valid: false,
      isPageToken: false,
      error: pageData?.error?.message || 'Token no autorizado para publicar en la página de Facebook.',
    };
  } catch (error: any) {
    return {
      valid: false,
      isPageToken: false,
      error: error?.message || 'Error de conexión al conectar con Meta Graph API.',
    };
  }
}

/**
 * Actualiza el archivo .env.local sin borrar el resto de variables
 */
function syncEnvLocal(credentials: StoredCredentials) {
  try {
    let content = '';
    if (fs.existsSync(ENV_LOCAL_PATH)) {
      content = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
    }

    const setEnvVar = (key: string, value?: string) => {
      if (!value) return;
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
      } else {
        content += `\n${key}=${value}`;
      }
    };

    if (credentials.facebookAccessToken) setEnvVar('FACEBOOK_ACCESS_TOKEN', credentials.facebookAccessToken);
    if (credentials.facebookPageId) setEnvVar('FACEBOOK_PAGE_ID', credentials.facebookPageId);
    if (credentials.telegramToken) setEnvVar('TELEGRAM_BOT_TOKEN', credentials.telegramToken);
    if (credentials.telegramChatId) setEnvVar('TELEGRAM_CHAT_ID', credentials.telegramChatId);
    if (credentials.blueskyHandle) setEnvVar('BLUESKY_HANDLE', credentials.blueskyHandle);
    if (credentials.blueskyPassword) setEnvVar('BLUESKY_APP_PASSWORD', credentials.blueskyPassword);
    if (credentials.brandName) setEnvVar('PAGE_BRAND_NAME', credentials.brandName);

    fs.writeFileSync(ENV_LOCAL_PATH, content.trim() + '\n');
  } catch (err) {
    console.error('[CredentialsManager] Error al sincronizar .env.local:', err);
  }
}

