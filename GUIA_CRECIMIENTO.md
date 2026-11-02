# Punto Ciego: dirección propia gratis y nuevos canales

## 1. Dirección sin "github": puntociegoglobal.pages.dev (gratis)
Cloudflare Pages (ya tienes cuenta) publica la página directo desde tu repositorio de GitHub.
1. Entra en https://dash.cloudflare.com → **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git**.
2. Autoriza GitHub y elige el repositorio **carxlit.github.io**.
3. Configuración:
   - **Project name:** `puntociegoglobal`  ← así queda `puntociegoglobal.pages.dev`
   - **Production branch:** `main`
   - **Framework preset:** None · **Build command:** (vacío) · **Build output directory:** `site`
4. **Save and Deploy**.
5. Ya creado: **Settings → Builds → Build watch paths → Include paths:** `site/*`
   (así solo se reconstruye cuando cambia la página y no se gastan las 500 construcciones gratis al mes).

Avísame y yo cambio todos los enlaces a la dirección nueva. La de GitHub sigue funcionando como copia
para los enlaces viejos.

## 2. Google (lo que más tráfico trae)
1. https://search.google.com/search-console → **Agregar propiedad** → **Prefijo de la URL** → la dirección de la página.
2. Método **Etiqueta HTML** → copia la etiqueta `<meta name="google-site-verification" ...>` y pásamela (no es secreta).
3. Cuando la ponga, pulsa **Verificar** y en **Sitemaps** envía `sitemap.xml` y `news-sitemap.xml`.
4. Luego: https://publishercenter.google.com → agrega Punto Ciego como publicación con la misma dirección.

(Opcional, igual de fácil: Bing Webmaster Tools, https://www.bing.com/webmasters, que también alimenta a ChatGPT y Copilot.)

## 3. Mastodon (gratis, el código ya está)
1. Crea la cuenta en https://mastodon.social (o https://masto.es). En **Preferencias → Perfil** marca **"Esta es una cuenta automatizada (bot)"**.
2. **Preferencias → Desarrollo → Nueva aplicación** → nombre `Punto Ciego` → permisos `write:statuses` y `write:media` → Enviar.
3. Abre la aplicación y copia el **token de acceso**.
4. En el archivo `.env.local` del proyecto añade (lo escribes tú):
   ```
   MASTODON_INSTANCE=https://mastodon.social
   MASTODON_TOKEN=el_token_que_copiaste
   ```
5. Doble clic en `ACTIVAR_NUBE.bat`.

## 4. Flipboard (2 minutos)
Crea una cuenta en https://flipboard.com, crea una revista "Punto Ciego" y añade el RSS de la página
(`/rss.xml`). Flipboard la mantiene actualizada sola.
