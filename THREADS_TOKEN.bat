@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Punto Ciego - Conectar Threads
node scripts/env-setup.js threads
if errorlevel 1 goto fin
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\github\setup.ps1"
:fin
echo.
pause
