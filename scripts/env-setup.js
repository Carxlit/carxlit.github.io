/**
 * Asistentes de configuración que escriben en .env.local (nunca muestran las claves):
 *   node scripts/env-setup.js ia        → pide las claves gratis de Groq y Mistral (IAs de respaldo)
 *   node scripts/env-setup.js reporte   → detecta tu chat personal con el bot para el reporte diario
 * Después hay que correr ACTIVAR_NUBE.bat para subirlas a GitHub como secretos.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENV_PATH = path.join(process.cwd(), '.env.local');

function readEnv() {
  const map = {};
  if (!fs.existsSync(ENV_PATH)) return map;
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) map[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return map;
}

function setEnv(key, value) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8').replace(/^﻿/, '') : '';
  const line = `${key}=${value}`;
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  text = re.test(text) ? text.replace(re, line) : `${text.replace(/\s*$/, '')}\n${line}\n`;
  fs.writeFileSync(ENV_PATH, text);
}

const ask = (q) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => {
      rl.close();
      resolve(a.trim());
    });
  });

async function setupAiKeys() {
  console.log('\n IAs de respaldo gratis: entran solas cuando Gemini se queda sin cuota.');
  console.log(' Deja vacío y pulsa Enter para saltar una.\n');
  const groq = await ask(' Clave de Groq (empieza por gsk_): ');
  if (groq) {
    if (!/^gsk_/.test(groq)) console.log('   ⚠ No parece una clave de Groq, pero se guarda igual.');
    setEnv('GROQ_API_KEY', groq);
    console.log('   ✔ Groq guardada');
  }
  const cerebras = await ask(' Clave de Cerebras (empieza por csk-): ');
  if (cerebras) {
    setEnv('CEREBRAS_API_KEY', cerebras);
    console.log('   ✔ Cerebras guardada');
  }
  const openrouter = await ask(' Clave de OpenRouter (empieza por sk-or-): ');
  if (openrouter) {
    setEnv('OPENROUTER_API_KEY', openrouter);
    console.log('   ✔ OpenRouter guardada');
  }
}

async function setupThreads() {
  console.log('\n Threads: pega los dos datos de tu app de Meta (Casos de uso → Threads API → Configuración).\n');
  const secret = await ask(' Clave secreta de la app de Threads (Threads app secret): ');
  const short = await ask(' Token de acceso generado (User Token Generator): ');
  if (!secret || !short) throw new Error('Faltan datos');
  const ex = await fetch(
    `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(secret)}&access_token=${encodeURIComponent(short)}`
  ).then((r) => r.json());
  // Si el token ya era de larga duración, el canje falla: se usa tal cual
  const token = ex.access_token || short;
  const me = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`).then((r) => r.json());
  if (!me.id) throw new Error(`Threads no aceptó el token: ${(me.error && me.error.message) || (ex.error && ex.error.message) || 'sin detalle'}`);
  setEnv('THREADS_USER_ID', me.id);
  setEnv('THREADS_ACCESS_TOKEN', token);
  if (!readEnv().THREADS_ENC_KEY) setEnv('THREADS_ENC_KEY', require('crypto').randomBytes(32).toString('hex'));
  console.log(`\n ✔ Conectado a Threads como @${me.username}${ex.expires_in ? ` (token de ${Math.round(ex.expires_in / 86400)} días, se renovará solo)` : ''}`);
}

async function setupReportChat() {
  const token = (readEnv().TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) throw new Error('No hay TELEGRAM_BOT_TOKEN en .env.local');
  const api = (method, body) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then((r) => r.json());

  const me = await api('getMe');
  if (!me.ok) throw new Error(`El bot no responde: ${me.description}`);
  console.log(`\n 1) Abre Telegram y busca tu bot: @${me.result.username}`);
  console.log(' 2) Escríbele "/start" (o cualquier mensaje).');
  console.log('\n Esperando tu mensaje (hasta 3 minutos)...');

  const started = Math.floor(Date.now() / 1000) - 600;
  for (let i = 0; i < 36; i++) {
    const up = await api('getUpdates', { timeout: 5, allowed_updates: ['message'] });
    const msg = (up.result || [])
      .map((u) => u.message)
      .filter((m) => m && m.chat && m.chat.type === 'private' && m.date >= started)
      .pop();
    if (msg) {
      setEnv('TELEGRAM_REPORT_CHAT_ID', String(msg.chat.id));
      await api('sendMessage', {
        chat_id: msg.chat.id,
        text: '✅ Listo. Aquí te llegará cada noche el reporte de Punto Ciego: lo publicado, los fallos y los avisos.',
      });
      console.log(`\n ✔ Chat detectado (${msg.chat.first_name || 'tú'}). Te envié un mensaje de prueba.`);
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('No llegó ningún mensaje. Vuelve a intentarlo escribiéndole al bot.');
}

async function setupMastodon() {
  console.log('\n Mastodon (gratis): crea la cuenta en https://mastodon.social y luego Preferencias > Desarrollo > Nueva aplicacion.');
  console.log(' Marca los permisos write:statuses y write:media, guarda y copia "Tu token de acceso".\n');
  const instance = ((await ask(' Instancia (Enter para https://mastodon.social): ')) || 'https://mastodon.social').replace(/\/+$/, '');
  const token = await ask(' Token de acceso: ');
  const me = await fetch(`${instance}/api/v1/accounts/verify_credentials`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  if (!me.acct) throw new Error(`Mastodon no acepto el token: ${me.error || 'sin detalle'}`);
  setEnv('MASTODON_INSTANCE', instance);
  setEnv('MASTODON_TOKEN', token);
  console.log(`\n OK Conectado a Mastodon como @${me.acct}`);
}

async function setupYoutube() {
  console.log('\n YouTube Shorts (gratis). Antes, en https://console.cloud.google.com :');
  console.log('  1) Proyecto nuevo > APIs y servicios > Biblioteca > activa "YouTube Data API v3".');
  console.log('  2) Pantalla de consentimiento OAuth > Externo > pon tu correo > en "Publico objetivo" pulsa PUBLICAR APLICACION (si no, el permiso caduca a los 7 dias).');
  console.log('  3) Credenciales > Crear credenciales > ID de cliente de OAuth > tipo "Television y dispositivos de entrada limitada".');
  console.log('  4) Copia el ID de cliente y el secreto.\n');
  const id = await ask(' ID de cliente: ');
  const secret = await ask(' Secreto de cliente: ');
  const dev = await fetch('https://oauth2.googleapis.com/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, scope: 'https://www.googleapis.com/auth/youtube' }).toString(),
  }).then((r) => r.json());
  if (!dev.device_code) throw new Error(`Google no acepto el ID de cliente: ${dev.error_description || dev.error || 'sin detalle'}`);
  console.log(`\n Abre ${dev.verification_url} e ingresa el codigo:  ${dev.user_code}`);
  console.log(' (elige la cuenta del canal de YouTube; si dice "app no verificada" pulsa Avanzado > Continuar)\n Esperando...');
  const until = Date.now() + (dev.expires_in || 600) * 1000;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, (dev.interval || 5) * 1000));
    const t = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: id, client_secret: secret, device_code: dev.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }).toString(),
    }).then((r) => r.json());
    if (t.refresh_token) {
      setEnv('YOUTUBE_CLIENT_ID', id);
      setEnv('YOUTUBE_CLIENT_SECRET', secret);
      setEnv('YOUTUBE_REFRESH_TOKEN', t.refresh_token);
      console.log('\n OK YouTube conectado.');
      return;
    }
    if (t.error && t.error !== 'authorization_pending' && t.error !== 'slow_down') throw new Error(`Google: ${t.error_description || t.error}`);
  }
  throw new Error('Se acabo el tiempo sin autorizar. Vuelve a ejecutar YOUTUBE.bat.');
}

(async () => {
  const mode = process.argv[2];
  if (mode === 'ia') await setupAiKeys();
  else if (mode === 'reporte') await setupReportChat();
  else if (mode === 'threads') await setupThreads();
  else if (mode === 'mastodon') await setupMastodon();
  else if (mode === 'youtube') await setupYoutube();
  else throw new Error('Uso: node scripts/env-setup.js ia|reporte|threads|mastodon|youtube');
  console.log('\n Ahora se suben a GitHub (puede pedirte confirmar).');
})().catch((e) => {
  console.error('\n ✖', e.message);
  process.exit(1);
});
