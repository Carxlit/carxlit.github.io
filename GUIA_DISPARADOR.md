# Ciclos puntuales cada 15 minutos (gratis)

GitHub no garantiza sus horarios automáticos (a veces pasan horas sin ejecutar). **cron-job.org** es un
servicio gratuito que "toca la puerta" de GitHub cada 15 minutos para que el ciclo corra a tiempo.

## 1. Llave de GitHub (solo para este proyecto)
1. Abre: https://github.com/settings/personal-access-tokens/new
2. **Token name:** `punto-ciego-cron` · **Expiration:** 1 año (o la máxima que deje).
3. **Repository access:** *Only select repositories* → `carxlit.github.io`.
4. **Permissions → Repository permissions → Actions:** *Read and write* (nada más).
5. **Generate token** y cópialo (empieza por `github_pat_…`). Solo se muestra una vez.

## 2. Tarea en cron-job.org
1. Crea la cuenta gratis: https://console.cron-job.org/signup
2. **Create cronjob**:
   - **Title:** `Punto Ciego`
   - **URL:** `https://api.github.com/repos/Carxlit/carxlit.github.io/actions/workflows/redaccion.yml/dispatches`
   - **Execution schedule:** *Every 15 minutes*
3. Pestaña **Advanced**:
   - **Request method:** `POST`
   - **Headers** (añade tres):
     - `Authorization` → `Bearer ` + tu token (con un espacio después de Bearer)
     - `Accept` → `application/vnd.github+json`
     - `User-Agent` → `punto-ciego`
   - **Request body:** `{"ref":"main"}`
4. **Save** y pulsa **Test run**: debe responder **204** (eso significa "OK").

## Listo
En https://github.com/Carxlit/carxlit.github.io/actions verás un ciclo nuevo cada 15 minutos.
Cuando el token caduque (en un año), repite el paso 1 y pega el nuevo en el header `Authorization`.
