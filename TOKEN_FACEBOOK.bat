@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Punto Ciego - Token permanente de Facebook (e Instagram)
echo.
echo  Pega cada dato y pulsa Enter (clic derecho = pegar).
echo    App ID: 2003690543654205
echo.
echo  Al generar el token en el Graph API Explorer marca estos permisos:
echo    pages_show_list, pages_read_engagement, pages_manage_posts
echo    instagram_basic, instagram_content_publish, business_management  (para Instagram)
echo    instagram_manage_insights, read_insights  (para ver el alcance en PROGRESO.bat)
echo    instagram_manage_comments, pages_manage_engagement, pages_read_user_content  (para responder comentarios solo)
echo.
call npm run fb:token
echo.
echo  Si dice "Este token NO caduca", ahora haz doble clic en ACTIVAR_NUBE.bat
echo.
pause
