@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Punto Ciego - Token permanente de Facebook
echo.
echo  Pega cada dato y pulsa Enter (clic derecho = pegar).
echo    App ID: 2003690543654205
echo.
call npm run fb:token
echo.
echo  Si dice "Este token NO caduca", ahora haz doble clic en ACTIVAR_NUBE.bat
echo.
pause
