@echo off
echo ========================================
echo Backend Environment Setup
echo ========================================
echo.

if exist ".env" (
    echo .env file already exists.
    echo.
    choice /C YN /M "Do you want to recreate it"
    if errorlevel 2 goto :end
    if errorlevel 1 goto :create
) else (
    goto :create
)

:create
echo Creating .env file...

REM Generate a random JWT secret (simple approach)
set "RANDOM_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%"

(
echo PORT=5000
echo DATABASE_PATH=./database/shop_tasks.db
echo JWT_SECRET=spectrum_outfitters_secret_%RANDOM_SECRET%_%RANDOM%%RANDOM%%RANDOM%
echo NODE_ENV=production
echo ADMIN_EMAIL=neel@spectrumoutfitters.com
echo BACKUP_PATH=./backups
echo SESSION_TIMEOUT_HOURS=12
echo SHOPMONKEY_API_KEY=
) > .env

echo.
echo ✅ .env file created!
echo.
echo IMPORTANT: The JWT_SECRET has been set to a default value.
echo For production, please change it to a strong random string.
echo.
echo Opening .env file for review...
timeout /t 2 /nobreak >nul
notepad .env

:end
echo.
echo Setup complete! You can now start the backend with:
echo   npm run dev
echo.
pause

