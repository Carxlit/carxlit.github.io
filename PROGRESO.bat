@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Punto Ciego - Progreso
call npm run progreso --silent
pause
