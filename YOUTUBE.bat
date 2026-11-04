@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Punto Ciego - Conectar YouTube
node scripts/env-setup.js youtube
if errorlevel 1 goto fin
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\github\setup.ps1"
:fin
echo.
pause
