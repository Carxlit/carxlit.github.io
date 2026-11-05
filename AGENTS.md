# Punto Ciego — contexto para agentes (Antigravity, Claude, etc.)

Léelo completo antes de tocar nada. El dueño habla español; responde siempre en español, corto y sin rodeos.

## Qué es
Medio de noticias **100 % autónomo y 100 % gratis** (repositorio público `Carxlit/carxlit.github.io`).
Cada ~15 min un ciclo en GitHub Actions busca noticias reales del mundo, escribe un artículo de análisis con IA (en español),
lo publica en el sitio y lo difunde en redes con un enlace. Nadie interviene.

- Sitio: https://puntociegoglobal.pages.dev (Cloudflare Pages, conectado a Git, carpeta de salida `site/`).
- Instagram `@puntociego.glob` (el canal principal: **todo sale como Reel**), Facebook, Telegram (canal público
  https://t.me/puntociegoglobal), Bluesky, Threads, Mastodon; YouTube Shorts preparado pero sin conectar.
- Disparo: cron-job.org llama cada 15 min a `workflow_dispatch` de `.github/workflows/redaccion.yml`
  (el `cron` interno es respaldo). Concurrencia `redaccion`: solo un ciclo pendiente; un disparo manual puede quedar cancelado por el siguiente.

## Reglas del dueño (no negociables)
1. **Todo gratis.** Nada de planes de pago ni claves de pago. (Mistral y Cerebras piden pago: no se usan; sí Gemini, Groq, OpenRouter.)
2. **Nunca** pedir, guardar ni usar tokens/contraseñas pegados en el chat. El dueño los escribe en los `.bat` o en `.env.local`.
3. **Nunca** subir secretos al repositorio (es público). `.env.local` y `storage/credentials.json` no se commitean.
4. **Instagram: siempre Reel** (video real CC si existe; si no, Reel narrado por IA con fotos). **Resto de redes: solo video real**
   (licencia Creative Commons); si no hay, post normal con imagen. Nada de videos hechos por IA fuera de Instagram.
5. Las imágenes de un Reel deben **tener que ver con la noticia**. Una imagen repetida entre noticias distintas es un fallo grave (una actualización sí puede reutilizar fotos de su noticia original mediante el id de familia en `storage/image_hashes.json`).
6. Temas graves (muertes, guerra, atentados, tragedias) → formato serio. Lo demás → infografía animada.
7. Trabajar en silencio y reportar al terminar; mensajes cortos. Cualquier cambio gordo, explicarlo con un prompt claro para el dueño.
8. **Actualizaciones de historias graves (`news.updateOf`):** un candidato repetido solo pasa como actualización si (a) coincide con una noticia nuestra publicada hace entre 3 y 48 h, (b) la original era grave (`SEVERE_EVENT`) o urgente, (c) el titular trae un marcador de novedad (`UPDATE_NOVELTY_MARKERS`) o una cifra distinta, y (d) máximo 1 actualización por historia original y 2 al día (cuentan dentro del cupo de 16/día). Lleva titular con prefijo `"ACTUALIZACIÓN:"`, la mesa editorial cuenta solo lo nuevo, el sitio enlaza ambas notas (`"Lee la primera nota"` / `"Actualizada: ver novedades"`) y sigue saliendo como Reel en Instagram.

## Arquitectura (Next.js 14 + bundle esbuild que corre en Actions)
Punto de entrada de la nube: `scripts/cloud-run.ts` → `dist/cloud-run.js` (`npm run cloud:build`). Fases: `produce` (auditoría + ciclo + historias extra)
→ guardar estado en git → despliegue del sitio → `dispatch` (publica lo vencido cuando el artículo ya está en línea) → guardar.

Carpetas clave (`src/lib/…`):
- `agents/news-scout.ts` — ~71 fuentes RSS/Google News (español e inglés), puntuación de urgencia, agrupa el mismo hecho entre medios (`coverageCount`),
  `TIER1_SOURCES` (agencias), `SEVERE_EVENT` (hechos graves) y `matchStoryUpdate` (actualizaciones 3-48 h con marcador de novedad o cifra distinta).
  `semantic-dedupe.ts`: repetidos por significado con embeddings de Gemini (umbral 0,81; deja pasar actualizaciones válidas).
- `agents/autonomous-newsroom.ts` — el ciclo: cupo diario (16), horas pico, cola máx. 3, selección con diversidad, **protocolo de urgencia**
  (`isTrueBreakingNews`: umbral 90, máx. 4/día, hecho grave de fuente tier1 sale ya; sin hecho grave exige ≥5 medios; de madrugada solo hechos graves).
- `agents/orchestrator.ts`, `editorial-desk.ts` (una sola llamada a la IA produce brief + copys + artículo + guion de video; todo en español; si `updateOf` está presente recibe titular y resumen de la original con la orden de contar solo lo nuevo),
  `deep-researcher.ts` (dossier multi-fuente), `queue-dispatcher.ts` (cola, canales, reintentos: 3 intentos, backoff 3 y 15 min;
  Instagram reintenta el Reel y solo cae a imagen en el último intento), `comment-replies.ts` (responde comentarios de IG/FB con IA),
  `audience-metrics.ts` y `daily-report.ts` (reporte nocturno a Telegram), `newsroom-auditor.ts` (salud de canales).
- `ai/gemini.ts` — cadena de modelos: Gemini → Groq (llama-3.3-70b) → OpenRouter (:free). Pausa 1 h si todas se quedan sin cuota.
- `video/reel-generator.ts` — Reel 1080×1920: voz Edge TTS (`es-MX-JorgeNeural`, +8 %; respaldo Piper), Chromium pinta cada fotograma → ffmpeg,
  música original sintetizada (`background-music.ts`, con sidechain bajo la voz), con video CC real si existe (`yt-dlp`, solo "Creative Commons").
  `reel-infographic.ts` — formato infografía (marco inclinado, escenas "EL DATO" con anillo/puntos/número que cuenta, color por sección);
  `chooseReelStyle` decide serio/infografía. `reel-cover.ts` — portada 9:16 que se publica en `site/img/<slug>-cover.jpg` y se pasa a Instagram como `cover_url`.
- `news/news-images.ts` — verifica relevancia visual (`verifyPhotoRelevance`, caché en `storage/photo_checks.json`) y reúne imágenes del Reel: foto de la noticia + foto principal de otros medios que cubren el hecho; descarta logos/ilustraciones por
  defecto, imágenes pequeñas y **cualquier imagen ya usada en otra noticia distinta** (huellas por familia de historia en `storage/image_hashes.json`). Fotos libres de Commons/Openverse
  existen pero están **apagadas** (`REEL_STOCK_IMAGES=true` las activa): coincidían por nombre pero no por contenido.
- `news/extra-publishers.ts` (Instagram, Reel IG/FB, Mastodon), `threads-publisher.ts` (token se renueva solo y se guarda cifrado),
  `youtube-publisher.ts` (Shorts; sin auditar de Google los videos quedan privados), `news-video.ts` (busca video CC; `sameStory` exige coincidencia fuerte).
- `site/templates.ts` y `site/static-site.ts` — sitio estático tipo portal de noticias (portada, secciones, artículo con video/Reel incrustado, avisos cruzados de actualización, ticker "Último minuto",
  RSS, `sitemap.xml`, `news-sitemap.xml`). `npm run site:rebuild` regenera todo.

Estado persistente = archivos en `storage/` commiteados por la nube (`publication_queue.json`, `site_articles.json`, `news_history.json`, métricas, etc.).
Los commits "Estado de la redacción…" / "Publicaciones…" los hace el bot: haz `git pull --rebase` antes de empujar.

## Cómo trabajar y probar
- Compilar tipos: `npx tsc --noEmit -p .` (debe quedar sin salida). Bundle de la nube: `npm run cloud:build`.
- Panel de progreso: `PROGRESO.bat` o `npm run progreso` (seguidores, publicaciones, cola, estado de la nube).
- Estado de la nube: `gh run list --workflow redaccion.yml --limit 10`; logs: `gh run view <id> --log`.
- Prueba en la nube: `gh workflow run redaccion.yml -f historias_extra=1 [-f solo_con_video=true] [-f con_cifras=true]` (publica YA, sin topes).
- Scripts sueltos de prueba: créalos en `scripts/_algo.ts`, compílalos con `npx esbuild scripts/_algo.ts --bundle --platform=node --packages=external --outfile=storage/.algo.js` y bórralos al terminar.
- En el PC del dueño **no** hay Piper y su ffmpeg es viejo (sin `sidechaincompress`): la prueba completa de un Reel local no mezcla música; en la nube sí.
- Configuración: `.env.local` (local) y secretos/variables de GitHub (los sube `deploy/github/setup.ps1`, que ejecutan los `.bat`: `ACTIVAR_NUBE.bat`, `CLAVES_IA.bat`,
  `TOKEN_FACEBOOK.bat`, `THREADS_TOKEN.bat`, `MASTODON.bat`, `YOUTUBE.bat`, `REPORTE_TELEGRAM.bat`).
- Banderas útiles: `REEL_STYLE=serio|infografia`, `REEL_STOCK_IMAGES`, `COMMENT_REPLIES=false`, `REEL_MUSIC=false`, `REEL_MUSIC_VOLUME` (0,18), `REEL_VOICE`, `REEL_RATE`,
  `IG_AI_REELS`, `PUBLIC_SITE_URL`. Valores por defecto de la redacción en `autonomous-newsroom.ts` y `storage/autonomous_config.json`.

## Trampas conocidas (ya nos mordieron)
- **Codificación en Windows/PowerShell:** `Get-Content`/`Set-Content` sin `-Encoding utf8` dañan tildes. Edita con herramientas que respeten UTF-8.
- **Regex Unicode:** el `target` de TypeScript no admite literales `/…/u` (TS1501); usa `new RegExp('…', 'u')` y duplica las barras (`'\\p{L}'`).
- **Strings de Python escribiendo TS:** los escapes (`\s`, `\n`, `\.`) se corrompen; mejor `Edit` directo.
- **Cuotas de IA gratis** (Gemini/Groq/OpenRouter): no añadas llamadas a la IA por ciclo sin cache; los embeddings usan caché (`storage/embeddings_cache.json`).
- **Instagram/Meta:** subidas de Reel fallan a veces con "Request processing failed" (se reintenta). El alcance/reproducciones exigen `instagram_manage_insights`.
- **Imágenes:** nunca confiar en un `og:image` sin filtrar (portales ponen una ilustración genérica a todo). Pasa siempre por `news-images.ts`.
- El sitio se despliega DESPUÉS del ciclo de producción; publicar antes deja posts sin enlace (por eso existe la fase `dispatch`).

## Pendiente / ideas
- Conectar YouTube Shorts (`YOUTUBE.bat`) y, para que sean públicos, enviar el formulario de auditoría de la API (gratis, lo envía el dueño).
- Google Search Console: sitemaps enviados, esperar indexación. Google News Publisher Center: pendiente (esperar semanas de contenido). Flipboard: añadir `rss.xml`.
- Anuncios (Adsterra/Monetag) cuando haya tráfico real; el dueño pega los códigos en el chat y se integran en las plantillas.
- Vigilar falsas urgencias en el protocolo de última hora.
- Canal de WhatsApp: descartado (no hay API oficial para canales; el dueño no quiere hacerlo manual).
- Datos de audiencia el 2026-11-05: Instagram 46 seguidores (+34 en 3 días), Facebook 2, Telegram 2, Bluesky 0; 58 artículos; 11/11 Reels recientes bien.

## Cómo pedir cambios (formato de los prompts)
Cada tarea: objetivo en una frase, archivos probables, criterio de "terminado" comprobable (tipos sin errores + prueba en la nube si toca publicar),
y qué NO tocar. Al terminar: `npx tsc --noEmit -p .`, `git pull --rebase`, commit claro en español y push.
