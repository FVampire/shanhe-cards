@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.12 or newer.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:5173 in your browser.
node tools\serve.mjs
pause
