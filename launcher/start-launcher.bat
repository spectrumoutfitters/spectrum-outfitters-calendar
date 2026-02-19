@echo off
echo Starting Spectrum Outfitters Launcher...
cd /d "%~dp0"
if not exist "node_modules" (
    echo Installing launcher dependencies...
    call npm install
)
start "Spectrum Outfitters Launcher" cmd /k "node launcher.js"
timeout /t 2 /nobreak >nul
start http://localhost:3001

