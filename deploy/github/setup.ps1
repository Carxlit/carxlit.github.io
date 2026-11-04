# Sube Punto Ciego a GitHub y activa la redacción autónoma gratis (GitHub Actions + GitHub Pages).
# Requisitos: Git y GitHub CLI instalados y "gh auth login" hecho.
# Uso:  powershell -ExecutionPolicy Bypass -File deploy\github\setup.ps1
# Los secretos se pasan a GitHub por la entrada estándar: nunca se imprimen ni quedan en el historial.
# 'Continue': en PowerShell 5.1 los avisos de git/gh por stderr no deben abortar; cada paso revisa $LASTEXITCODE
$ErrorActionPreference = 'Continue'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $root
# Por si Git/GitHub CLI se acaban de instalar y esta terminal no los ve aún
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

function Step($msg) { Write-Host "`n== $msg ==" -ForegroundColor Cyan }
function Need($cmd, $install) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Falta '$cmd'. Instálalo con:  $install" }
}
function Set-EnvLine($text, $key, $value) {
  if ($text -match "(?m)^$key=.*$") { return [regex]::Replace($text, "(?m)^$key=.*$", "$key=$value") }
  return $text.TrimEnd() + "`r`n$key=$value`r`n"
}

Step 'Comprobando herramientas'
Need git 'winget install --id Git.Git -e'
Need gh 'winget install --id GitHub.cli -e'
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE) {
  Write-Host ''
  Write-Host 'Falta iniciar sesión en GitHub en este PC. Ahora:' -ForegroundColor Yellow
  Write-Host '  1) Si pregunta "Authenticate Git with your GitHub credentials?", pulsa Enter.'
  Write-Host '  2) Copia el código de 8 letras que aparece y pulsa Enter: se abre el navegador.'
  Write-Host '  3) Pega el código, pulsa Continue y luego Authorize.'
  Write-Host ''
  gh auth login --hostname github.com --git-protocol https --web --scopes workflow
  gh auth status 2>$null | Out-Null
  if ($LASTEXITCODE) { throw 'No se completó el inicio de sesión en GitHub. Vuelve a ejecutar ACTIVAR_NUBE.bat.' }
}
gh auth setup-git 2>$null | Out-Null
$login = (gh api user --jq .login).Trim()
$userId = (gh api user --jq .id).Trim()

# Repositorio <usuario>.github.io → el sitio queda en la raíz del dominio (necesario para ads.txt)
$repo = "$login.github.io".ToLower()
$siteUrl = "https://$repo"
gh repo view "$login/$repo" --json name 2>$null | Out-Null
if (-not $LASTEXITCODE -and -not (Test-Path .git)) {
  # Ya existe un sitio personal ajeno a este proyecto: usar un repositorio de proyecto
  $repo = 'punto-ciego'
  $siteUrl = "https://$($login.ToLower()).github.io/punto-ciego"
}
$full = "$login/$repo"
Write-Host "Repositorio: $full  ·  Sitio: $siteUrl"

Step 'Ajustando la configuración local (y deteniendo la publicación desde este PC)'
$envPath = Join-Path $root '.env.local'
$envText = if (Test-Path $envPath) { [IO.File]::ReadAllText($envPath) } else { '' }
# Dirección propia (p. ej. Cloudflare Pages): si .env.local ya apunta a otra que no es github.io, se respeta
$current = [regex]::Match($envText, '(?m)^PUBLIC_SITE_URL=(.+)$').Groups[1].Value.Trim()
if ($current -and $current -notmatch 'github\.io' -and $current -notmatch 'punto-ciego-ezm') { $siteUrl = $current.TrimEnd('/') }
# RUN_MODE=cloud ANTES de copiar la cola: desde aquí el servidor local deja de publicar,
# así nada sale del PC después de la copia (evita publicaciones dobles)
$envText = Set-EnvLine $envText 'RUN_MODE' 'cloud'
$envText = Set-EnvLine $envText 'PUBLIC_SITE_URL' $siteUrl
# El sitio ya no se sube desde el PC: lo publica GitHub Pages
$envText = [regex]::Replace($envText, '(?m)^SITE_DEPLOY_COMMAND=', '# SITE_DEPLOY_COMMAND=')
[IO.File]::WriteAllText($envPath, $envText, (New-Object Text.UTF8Encoding($false)))
# Un ciclo local que ya estuviera en marcha termina antes de copiar el estado
$waitUntil = (Get-Date).AddMinutes(12)
while ((Test-Path (Join-Path $root 'storage\.newsroom.lock')) -and (Get-Date) -lt $waitUntil) {
  Write-Host 'Esperando a que termine el ciclo local en curso...'; Start-Sleep -Seconds 10
}

# Ya activado antes: la nube es dueña del estado (cola, historial, sitio). Volver a subir los
# archivos del PC lo pisaría con datos viejos, así que solo se actualizan secretos y variables.
$alreadyLive = (Test-Path .git) -and (git remote 2>$null | Where-Object { $_ -eq 'origin' })
if ($alreadyLive) {
  Write-Host 'La nube ya está activa: solo se actualizan los secretos (el código y la cola no se tocan).' -ForegroundColor Yellow
} else {

Step 'Regenerando el sitio con la nueva dirección'
npm run site:rebuild --silent
if ($LASTEXITCODE) { throw 'No se pudo regenerar el sitio.' }

Step 'Repositorio local'
if (-not (Test-Path .git)) { git init -b main | Out-Null }
git config user.name $login
git config user.email "$userId+$login@users.noreply.github.com"
git add -A
# Red de seguridad: ningún archivo de secretos puede entrar en el commit
$staged = git diff --cached --name-only
$forbidden = $staged | Where-Object { $_ -match '(^|/)\.env|credentials\.json|bluesky-session|\.browser-profile|wrangler' -and $_ -notmatch '\.env\.local\.example$' }
if ($forbidden) { throw "Archivos con secretos preparados para subir (revisa .gitignore): $($forbidden -join ', ')" }
git diff --cached --quiet
if ($LASTEXITCODE) { git commit -m 'Punto Ciego: redacción autónoma' | Out-Null }

Step "Subiendo a GitHub ($full, público)"
$hasRemote = git remote 2>$null | Where-Object { $_ -eq 'origin' }
if (-not $hasRemote) {
  gh repo create $full --public --source . --remote origin --push --description 'Punto Ciego: redacción autónoma de noticias'
  if ($LASTEXITCODE) { throw 'No se pudo crear el repositorio.' }
} else {
  git push -u origin main
  if ($LASTEXITCODE) { throw 'No se pudo subir el código.' }
}

}

Step 'Secretos (desde tu .env.local y storage/credentials.json)'
$envMap = @{}
foreach ($line in ($envText -split "`r?`n")) {
  if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$') { $envMap[$matches[1]] = $matches[2].Trim('"') }
}
$creds = $null
if (Test-Path storage\credentials.json) { $creds = Get-Content storage\credentials.json -Raw | ConvertFrom-Json }
function Pick($credField, $envKey) {
  if ($creds -and $creds.$credField) { return [string]$creds.$credField }
  return $envMap[$envKey]
}
$secrets = [ordered]@{
  GOOGLE_GENERATIVE_AI_API_KEY = $envMap['GOOGLE_GENERATIVE_AI_API_KEY']
  FACEBOOK_PAGE_ID             = Pick 'facebookPageId' 'FACEBOOK_PAGE_ID'
  FACEBOOK_ACCESS_TOKEN        = Pick 'facebookAccessToken' 'FACEBOOK_ACCESS_TOKEN'
  TELEGRAM_BOT_TOKEN           = Pick 'telegramToken' 'TELEGRAM_BOT_TOKEN'
  TELEGRAM_CHAT_ID             = Pick 'telegramChatId' 'TELEGRAM_CHAT_ID'
  BLUESKY_HANDLE               = Pick 'blueskyHandle' 'BLUESKY_HANDLE'
  BLUESKY_APP_PASSWORD         = Pick 'blueskyPassword' 'BLUESKY_APP_PASSWORD'
  # Opcionales (canales extra)
  LINKEDIN_WEBHOOK_URL         = $envMap['LINKEDIN_WEBHOOK_URL']
  MASTODON_TOKEN               = $envMap['MASTODON_TOKEN']
  # IAs de respaldo gratis (entran cuando Gemini se queda sin cuota) y chat del reporte diario
  GROQ_API_KEY                 = $envMap['GROQ_API_KEY']
  MISTRAL_API_KEY              = $envMap['MISTRAL_API_KEY']
  CEREBRAS_API_KEY             = $envMap['CEREBRAS_API_KEY']
  OPENROUTER_API_KEY           = $envMap['OPENROUTER_API_KEY']
  TELEGRAM_REPORT_CHAT_ID      = $envMap['TELEGRAM_REPORT_CHAT_ID']
  THREADS_USER_ID              = $envMap['THREADS_USER_ID']
  THREADS_ACCESS_TOKEN         = $envMap['THREADS_ACCESS_TOKEN']
  THREADS_ENC_KEY              = $envMap['THREADS_ENC_KEY']
  YOUTUBE_CLIENT_ID            = $envMap['YOUTUBE_CLIENT_ID']
  YOUTUBE_CLIENT_SECRET        = $envMap['YOUTUBE_CLIENT_SECRET']
  YOUTUBE_REFRESH_TOKEN        = $envMap['YOUTUBE_REFRESH_TOKEN']
}
$optional = @('LINKEDIN_WEBHOOK_URL', 'MASTODON_TOKEN', 'GROQ_API_KEY', 'MISTRAL_API_KEY', 'CEREBRAS_API_KEY', 'OPENROUTER_API_KEY', 'TELEGRAM_REPORT_CHAT_ID', 'THREADS_USER_ID', 'THREADS_ACCESS_TOKEN', 'THREADS_ENC_KEY', 'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN')
# Sin esto, PowerShell 5.1 antepone un BOM (U+FEFF) al valor que recibe gh por la entrada estándar
$OutputEncoding = New-Object Text.UTF8Encoding($false)
foreach ($name in $secrets.Keys) {
  $value = $secrets[$name]
  if ([string]::IsNullOrWhiteSpace($value)) {
    if ($optional -notcontains $name) { Write-Warning "$name vacío: ese canal no publicará en la nube." }
    continue
  }
  $value | gh secret set $name --repo $full
  if ($LASTEXITCODE) { throw "No se pudo guardar $name" }
  Write-Host "  OK $name"
}

Step 'Variables y GitHub Pages'
gh variable set PUBLIC_SITE_URL --body $siteUrl --repo $full | Out-Null
if ($envMap['GEMINI_MODEL']) { gh variable set GEMINI_MODEL --body $envMap['GEMINI_MODEL'] --repo $full | Out-Null }
if ($envMap['MASTODON_INSTANCE']) { gh variable set MASTODON_INSTANCE --body $envMap['MASTODON_INSTANCE'] --repo $full | Out-Null; Write-Host '  OK Mastodon' }

# Instagram: si la página de Facebook tiene una cuenta profesional vinculada, se activa sola
try {
  $fbToken = $secrets['FACEBOOK_ACCESS_TOKEN']; $fbPage = $secrets['FACEBOOK_PAGE_ID']
  if ($fbToken -and $fbPage) {
    $ig = Invoke-RestMethod -Uri "https://graph.facebook.com/v19.0/$($fbPage)?fields=instagram_business_account{id,username}" -Headers @{ Authorization = "Bearer $fbToken" } -TimeoutSec 20
    if ($ig.instagram_business_account.id) {
      gh variable set INSTAGRAM_USER_ID --body $ig.instagram_business_account.id --repo $full | Out-Null
      Write-Host "  OK Instagram @$($ig.instagram_business_account.username)"
    } else {
      Write-Host '  -  Instagram: la página no tiene una cuenta profesional vinculada (se omite)'
    }
  }
} catch { Write-Host '  -  Instagram: no se pudo comprobar (se omite)' }
gh api -X POST "repos/$full/pages" -f build_type=workflow 2>$null | Out-Null
if ($LASTEXITCODE) { gh api -X PUT "repos/$full/pages" -f build_type=workflow 2>$null | Out-Null }
Write-Host "  OK Pages activado ($siteUrl)"

Step 'Primer ciclo'
gh workflow run redaccion.yml --repo $full
Write-Host "`nListo. La redacción corre en GitHub cada 15 minutos, con tu PC apagado." -ForegroundColor Green
Write-Host "Sitio:      $siteUrl"
Write-Host "Actividad:  https://github.com/$full/actions"
Write-Host 'Cierra las ventanas del servidor y del demonio local para que no publiquen doble.'
