/**
 * Convierte un token corto de Facebook en un Page Access Token PERMANENTE (no caduca).
 * Uso: npm run fb:token   (pide los datos por consola; no se imprimen tokens)
 *
 * Necesitas (developers.facebook.com → tu app):
 *  - App ID y App Secret (Configuración → Básica)
 *  - Un token de USUARIO recién generado en el Graph API Explorer con permisos
 *    pages_show_list, pages_read_engagement, pages_manage_posts
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const GRAPH = 'https://graph.facebook.com/v19.0';
const ROOT = path.join(__dirname, '..');
const CREDS_PATH = path.join(ROOT, 'storage', 'credentials.json');
const ENV_PATH = path.join(ROOT, '.env.local');

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));
}

async function graph(pathAndQuery, token) {
  const res = await fetch(`${GRAPH}/${pathAndQuery}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return data;
}

function readCreds() {
  try { return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8')); } catch { return {}; }
}

function setEnv(key, value) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  content = re.test(content) ? content.replace(re, `${key}=${value}`) : `${content.trimEnd()}\n${key}=${value}\n`;
  fs.writeFileSync(ENV_PATH, content);
}

(async () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const creds = readCreds();
  const pageId = creds.facebookPageId || process.env.FACEBOOK_PAGE_ID || '1418440394683304';
  try {
    const appId = await ask(rl, 'App ID: ');
    const appSecret = await ask(rl, 'App Secret: ');
    const userToken = await ask(rl, 'Token de usuario (Graph API Explorer): ');
    if (!appId || !appSecret || !userToken) throw new Error('Faltan datos.');

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: userToken,
    });
    const longUser = await graph(`oauth/access_token?${params}`);
    console.log('✓ Token de usuario de larga duración obtenido');

    const accounts = await graph('me/accounts?fields=id,name,access_token', longUser.access_token);
    const page = (accounts.data || []).find((p) => p.id === pageId)
      || (accounts.data || []).find((p) => /punto ciego/i.test(p.name || ''));
    if (!page) {
      const names = (accounts.data || []).map((p) => `${p.name} (${p.id})`).join(', ') || 'ninguna';
      throw new Error(`La página ${pageId} no aparece. Páginas visibles: ${names}`);
    }

    const debug = await graph(`debug_token?input_token=${page.access_token}`, page.access_token);
    const exp = debug.data?.expires_at;
    if (!debug.data?.is_valid) throw new Error('El token de página resultante no es válido.');

    fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
    fs.writeFileSync(CREDS_PATH, JSON.stringify({
      ...creds, facebookPageId: page.id, facebookAccessToken: page.access_token, updatedAt: new Date().toISOString(),
    }, null, 2));
    setEnv('FACEBOOK_ACCESS_TOKEN', page.access_token);
    setEnv('FACEBOOK_PAGE_ID', page.id);

    console.log(`✓ Guardado token de la página "${page.name}" (${page.id})`);
    console.log(exp === 0 ? '✓ Este token NO caduca.' : `⚠ Caduca el ${new Date(exp * 1000).toLocaleString()} (revisa que el token de usuario sea de tu app).`);
    console.log('Si usas el modo nube, actualiza también el secreto FACEBOOK_ACCESS_TOKEN en GitHub.');
  } catch (err) {
    console.error('✗ ' + err.message);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
})();
