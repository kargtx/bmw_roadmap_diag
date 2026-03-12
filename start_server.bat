@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js не найден. Установите Node.js (LTS) и попробуйте снова.
  pause
  exit /b 1
)
node server.js
