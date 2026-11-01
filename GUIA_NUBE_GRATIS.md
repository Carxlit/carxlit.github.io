# Punto Ciego 24/7 gratis (GitHub)

GitHub ejecuta la redacción cada 15 minutos con tu PC apagado y publica la página web en
`https://TU-USUARIO.github.io`. Es gratis porque el repositorio es **público**: el código y los
artículos se ven, pero **las contraseñas y tokens no** (van como secretos cifrados de GitHub).
LinkedIn no funciona en la nube (necesita tu navegador con tu sesión).

## Lo que haces tú
1. Crear la cuenta en https://github.com/signup (gratis, sin tarjeta).
2. Iniciar sesión desde la terminal y pulsar "Authorize" en el navegador.

## Lo que hace el script (`deploy/github/setup.ps1`)
- Crea el repositorio público `TU-USUARIO.github.io` y sube el proyecto (con un filtro que impide subir secretos).
- Copia tus credenciales como secretos cifrados, sin mostrarlas.
- Activa GitHub Pages y regenera la página con la nueva dirección.
- Pone `RUN_MODE=cloud` en el PC para que el demonio local no publique doble.
- Lanza el primer ciclo. Actividad: `https://github.com/TU-USUARIO/TU-USUARIO.github.io/actions`

## Cosas a saber
- GitHub a veces retrasa los ciclos unos minutos; no afecta a la calidad.
- Si cambias un token (p. ej. Facebook con `npm run fb:token`), vuelve a ejecutar el script: actualiza los secretos.
- Para volver al modo local: borra `RUN_MODE=cloud` de `.env.local` y desactiva el workflow en GitHub
  (Actions → Redaccion Punto Ciego → Disable workflow).
- Gemini sigue en el plan gratuito (1 llamada por historia; caben ~8 historias al día).
