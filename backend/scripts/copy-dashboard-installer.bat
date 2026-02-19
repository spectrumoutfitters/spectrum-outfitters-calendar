@echo off
REM Copy the built Dashboard Assistant installer into backend/downloads so the
REM Calendar "Download Dashboard Assistant" link works. Run this after building
REM the Dashboard Assistant (npm run dist in that project).

set "SCRIPT_DIR=%~dp0"
set "DOWNLOADS=%SCRIPT_DIR%..\downloads"
set "DIST=..\..\..\DashBoard Assistant\dist"
set "TARGET=%DOWNLOADS%\SpectrumOutfittersAssistant-Setup.exe"

set "SOURCE=%DIST%\Spectrum Outfitters Assistant Setup 0.1.0.exe"
if not exist "%SCRIPT_DIR%%SOURCE%" set "SOURCE=%DIST%\Dashboard Assistant Setup 0.1.0.exe"
if not exist "%SCRIPT_DIR%%SOURCE%" (
  echo Source not found. Build first: cd "DashBoard Assistant" ^&^& npm run dist
  exit /b 1
)

if not exist "%DOWNLOADS%" mkdir "%DOWNLOADS%"
copy /Y "%SCRIPT_DIR%%SOURCE%" "%TARGET%" >nul
echo Copied installer to %TARGET%
exit /b 0
