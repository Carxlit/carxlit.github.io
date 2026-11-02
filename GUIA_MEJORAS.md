# Mejoras de Punto Ciego: lo que te toca hacer

Lo automático ya está funcionando:

- **Filtro de repetidas por significado:** no vuelve a cubrir un hecho de las últimas 48 h aunque otro medio lo cuente con otras palabras.
- **Horas pico:** las publicaciones se concentran entre 7–10 a. m., 12–2 p. m. y 6–10 p. m. (hora Colombia). Fuera de esas franjas se espacian más.
- **Fotos verificadas:** si un medio manda un video o un enlace caído como "foto", se busca otra imagen. Ya no salen tarjetas con el hueco vacío.
- **Reels solo con video real y libre** (Creative Commons), con crédito al autor. Las demás noticias salen como post con imagen.

Faltan unos pasos que solo puedes hacer tú porque necesitan tus cuentas.

---

## 1. IAs de respaldo gratis, sin tarjeta (5 minutos)

Sirven para que la redacción no se detenga cuando Gemini se queda sin cuota. Basta con una; con dos, mejor.

1. **Groq:** entra a **https://console.groq.com/keys**, inicia sesión con Google y pulsa **Create API Key**. La clave empieza por `gsk_`.
2. **Cerebras:** entra a **https://cloud.cerebras.ai**, inicia sesión con Google y abre **API Keys**. La clave empieza por `csk-`.
3. **OpenRouter** (opcional): entra a **https://openrouter.ai/settings/keys** y crea una clave. Empieza por `sk-or-`.
4. Haz doble clic en **`CLAVES_IA.bat`** y pega cada clave. Si no tienes alguna, pulsa Enter para saltarla.

Mistral quedó fuera porque pide pago.

## 2. Reporte diario en tu Telegram (2 minutos)

Cada noche, desde las 9 p. m., te llega un mensaje con lo publicado, lo que falló y los avisos (por ejemplo, un token por vencer).

1. Haz doble clic en **`REPORTE_TELEGRAM.bat`**.
2. Te dirá el nombre de tu bot. Ábrelo en Telegram y escríbele `/start`.
3. Listo. Te llega un mensaje de prueba y queda configurado.

## 3. Más tráfico gratis (opcional, cuando tengas tiempo)

### Canal público de Telegram

✅ Listo: **https://t.me/puntociegoglobal** ya aparece en la página, con un botón "Únete" en cada artículo. Ponlo también en la biografía de Instagram y Facebook.

### Google Noticias

El error "verifica la propiedad" sale cuando Publisher Center no encuentra la página en **tu** Search Console. Revisa esto:

1. Usa en Publisher Center **la misma cuenta de Google** con la que verificaste la página en Search Console.
2. En Search Console, la propiedad debe ser de tipo **Prefijo de URL**, exactamente `https://puntociegoglobal.pages.dev/` (con https y la barra final). Abre **Configuración → Usuarios y permisos**: debes aparecer como **Propietario**.
3. En Publisher Center, escribe la URL igual: `https://puntociegoglobal.pages.dev/`.
4. Si ya hiciste todo eso, espera unas horas y vuelve a darle **Confirmar verificación**. A veces tarda en reconocerla.

## 4. Threads (10 minutos)

Cada noticia saldrá también en Threads con la tarjeta y el **enlace clicable** al artículo. El token se renueva solo.

1. Entra a **https://developers.facebook.com/apps** → **Crear app**.
   - Nombre: `Punto Ciego Threads`.
   - Caso de uso: **"Acceder a la API de Threads"** (Access the Threads API).
   - Es otra app distinta de "AutoNews Bot": Meta no deja mezclar Threads con otros casos de uso.
2. En la app nueva: **Casos de uso → API de Threads → Personalizar → Permisos**. Agrega `threads_basic` y `threads_content_publish`.
3. **Roles de la app → Roles → Agregar personas → Evaluador de Threads**. Escribe tu usuario de Threads (el mismo de Instagram, `puntociego.glob`).
4. Acepta la invitación: en la app de **Threads** ve a **Configuración → Cuenta → Permisos del sitio web → Invitaciones** y acepta.
5. De vuelta en la app de Meta: **Casos de uso → API de Threads → Configuración**.
   - Copia la **clave secreta de la app de Threads**.
   - Baja hasta **Generador de token de usuario** → **Generar token de acceso** y copia el token.
6. Haz doble clic en **`THREADS_TOKEN.bat`** y pega los dos datos.

Si algún paso no te aparece igual, mándame una captura.
