@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Punto Ciego - Activar redaccion en la nube
echo.
echo  Esto sube Punto Ciego a tu GitHub (repositorio publico, sin contrasenas)
echo  y activa la redaccion automatica cada 15 minutos con el PC apagado.
echo.
pause
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\github\setup.ps1"
echo.
pause
