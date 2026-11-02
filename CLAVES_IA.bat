@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Punto Ciego - Claves de IAs de respaldo
echo.
echo  Crea tus claves gratis (sin tarjeta):
echo    Groq:       https://console.groq.com/keys
echo    Cerebras:   https://cloud.cerebras.ai  (menu API Keys)
echo    OpenRouter: https://openrouter.ai/settings/keys
echo  Pega cada clave y pulsa Enter (clic derecho = pegar).
node scripts/env-setup.js ia
if errorlevel 1 goto fin
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\github\setup.ps1"
:fin
echo.
pause
