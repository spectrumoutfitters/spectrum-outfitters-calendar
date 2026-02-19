@echo off
echo Stopping all Node.js processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo ✅ All Node.js processes stopped
) else (
    echo ℹ️  No Node.js processes found or already stopped
)
timeout /t 2 /nobreak >nul
echo.
echo You can now start the server fresh.

