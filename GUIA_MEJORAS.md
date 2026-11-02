# Mejoras de Punto Ciego: lo que te toca hacer

Lo automático ya está funcionando:

- **Filtro de repetidas por significado:** no vuelve a cubrir un hecho de las últimas 48 h aunque otro medio lo cuente con otras palabras.
- **Horas pico:** las publicaciones se concentran entre 7–10 a. m., 12–2 p. m. y 6–10 p. m. (hora Colombia). Fuera de esas franjas se espacian más.
- **Fotos verificadas:** si un medio manda un video o un enlace caído como "foto", se busca otra imagen. Ya no salen tarjetas con el hueco vacío.
- **Reels solo con video real y libre** (Creative Commons), con crédito al autor. Las demás noticias salen como post con imagen.

Faltan tres pasos que solo puedes hacer tú porque necesitan tus cuentas.

---

## 1. IAs de respaldo gratis (5 minutos)

Sirven para que la redacción no se detenga cuando Gemini se queda sin cuota.

1. Entra a **https://console.groq.com/keys**, inicia sesión con Google y pulsa **Create API Key**. Copia la clave, que empieza por `gsk_`.
2. Entra a **https://console.mistral.ai/api-keys**, inicia sesión y crea una clave. Si pide elegir plan, escoge el gratuito (**Experiment**).
3. Haz doble clic en **`CLAVES_IA.bat`** y pega cada clave cuando te la pida (clic derecho = pegar).
   - El mismo asistente las sube a GitHub de forma segura.

## 2. Reporte diario en tu Telegram (2 minutos)

Cada noche, desde las 9 p. m., te llega un mensaje con lo publicado, lo que falló y los avisos (por ejemplo, un token por vencer).

1. Haz doble clic en **`REPORTE_TELEGRAM.bat`**.
2. Te dirá el nombre de tu bot. Ábrelo en Telegram y escríbele `/start`.
3. Listo. Te llega un mensaje de prueba y queda configurado.

## 3. Más tráfico gratis (opcional, cuando tengas tiempo)

### Canal público de Telegram

Hoy el canal es privado, así que nadie lo puede encontrar.

1. En Telegram abre el canal → **Editar** → **Tipo de canal** → **Público**.
2. Ponle un enlace, por ejemplo `t.me/puntociegoglobal`.
3. Pásame el enlace y lo agrego a la página y a los perfiles.

### Google Noticias

1. Entra a **https://publishercenter.google.com** con la cuenta de Google donde verificaste la página en Search Console.
2. **Agregar publicación** → nombre "Punto Ciego" → sitio `puntociegoglobal.pages.dev`.
3. En **Contenido**, agrega el feed `https://puntociegoglobal.pages.dev/rss.xml`.
4. Publica. Google tarda unos días en revisarlo.

### Threads

Usa la misma app de Meta, pero necesita activar el caso de uso "Threads API" y generar otro token. Cuando quieras lo hacemos juntos.
