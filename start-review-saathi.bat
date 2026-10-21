@echo off
setlocal
title Review Saathi - Production Server
cd /d "%~dp0"

echo.
echo ==========================================
echo        Review Saathi Production Server
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS first.
  pause
  exit /b 1
)

if not exist package.json (
  echo package.json was not found. Run this file from the project folder.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

if not exist .env.local (
  echo WARNING: .env.local is missing. Supabase and AI features may not work.
)

echo Building the latest production version...
call npm run build
if errorlevel 1 (
  echo Production build failed. Fix the error above before starting the server.
  pause
  exit /b 1
)

echo.
echo Server is starting on all network interfaces...
echo Local:  http://localhost:3000
echo LAN:    http://YOUR-PC-IP:3000
echo Press Ctrl+C to stop the server.
echo.
call npm run start:lan

endlocal
