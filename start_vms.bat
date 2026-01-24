@echo off
title VMS Launcher
echo ==============================================
echo       Starting Video Management System
echo ==============================================
echo.

cd /d "%~dp0"

echo [1/4] Starting AI Engine (FIRST - required for AI features)...
cd backend\ai_engine\scripts
start "VMS AI Engine" cmd /k "powershell -ExecutionPolicy Bypass -File run.ps1"
cd /d "%~dp0"

echo Waiting 5 seconds for AI Engine to initialize...
timeout /t 5 /nobreak >nul

echo [2/4] Starting Recording Engine...
cd backend\recording_engine\build\Release
start "VMS Recording Engine" cmd /k "recording_engine.exe"
cd /d "%~dp0"

echo [3/4] Starting API Gateway...
start "VMS API Gateway" cmd /k "cd backend\api_gateway && npm run dev"

echo Waiting 3 seconds for API Gateway to start...
timeout /t 3 /nobreak >nul

echo [4/4] Starting Frontend...
start "VMS Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ==============================================
echo All services launched!
echo AI Engine started FIRST to ensure AI features work.
echo ==============================================
echo.
echo Access the dashboard at: http://localhost:5173
echo.
pause
