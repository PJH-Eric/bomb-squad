@echo off
title Bomb Squad
cd /d "%~dp0"
set PORT=3120
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required: https://nodejs.org
  pause
  exit /b 1
)
echo Starting Bomb Squad at http://localhost:%PORT%
start "" http://localhost:%PORT%
node server.js
pause
