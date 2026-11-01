@echo off
title Punto Ciego - Sistema de Noticias Autonomo
color 0A

:: Entrar a la carpeta del proyecto
cd /d "%~dp0"

echo =====================================================================
echo           PUNTO CIEGO - REDACCION PERIODISTICA AUTONOMA
echo =====================================================================
echo Directorio: %CD%
echo.

echo [1/2] Verificando Brave con soporte LinkedIn (puerto 9222)...
powershell -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:9222/json/version' -TimeoutSec 2; Write-Host '  -> Brave ya listo en puerto 9222.' } catch { Start-Process 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe' -ArgumentList '--remote-debugging-port=9222'; Write-Host '  -> Brave iniciado en puerto 9222.' }"

echo.
echo [2/2] Iniciando Supervisor (servidor web + demonio autonomo, con reinicio automatico)...
start "Punto Ciego - Supervisor" cmd /k npm run supervisor

echo.
echo Esperando que el servidor web este listo...
powershell -Command "for ($i=0; $i -lt 60; $i++) { try { Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 3 | Out-Null; break } catch { Start-Sleep -Seconds 2 } }"

echo Abriendo Panel de Control en el navegador...
start http://localhost:3000

echo.
echo =====================================================================
echo  TODO LISTO!
echo  - Panel: http://localhost:3000
echo  - Supervisor: reinicia servidor y demonio si se caen
echo  - Demonio: ciclo cada 5 min, registro en storage\logs
echo  - Estado en vivo: storage\daemon_status.json
echo =====================================================================
timeout /t 4 >nul
exit
