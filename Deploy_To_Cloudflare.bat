@echo off
title Deploy Nova Voice Assessment to Cloudflare Pages
cd /d "%~dp0"

echo ================================================================
echo   DEPLOYING NOVA VOICE ASSESSMENT TO CLOUDFLARE PAGES
echo   Project Name: nova-v2
echo ================================================================
echo.

echo [1/2] Compiling production bundle (Vite build)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed. Please inspect build errors above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Deploying 'dist' directory to Cloudflare Pages...
echo (If Wrangler authorization is needed, a browser tab will open automatically)
echo.
call npx wrangler pages deploy dist --project-name=nova-v2

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================
    echo   DEPLOYMENT FINISHED SUCCESSFULLY!
    echo   Live Preview: https://nova-v2.pages.dev
    echo ================================================================
) else (
    echo.
    echo [NOTE] If login was requested, run 'npx wrangler login' in your terminal
    echo or ensure your Cloudflare account is authorized.
)

pause
