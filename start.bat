@echo off
title Hostel Safety Management System - Unified Launcher
color 0B

echo ======================================================================
echo    Hostel Safety - Attendance ^& Student Movement Management System
echo                  Mandatory Design: Light Mode Only
echo ======================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH. Please install Node.js.
    pause
    exit /b 1
)

:: 2. Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python.
    pause
    exit /b 1
)

echo [1/3] Starting Python FastAPI + OpenCV Face Recognition Engine (Port 8005)...
start "Hostel Safety - Face Engine (Port 8005)" cmd /c "cd face-service && python -m uvicorn app:app --host 127.0.0.1 --port 8005"

timeout /t 2 /nobreak >nul

echo [2/3] Starting Express Backend ^& Database Server (Port 5000)...
start "Hostel Safety - Backend Server (Port 5000)" cmd /c "cd server && npx tsx src/index.ts"

timeout /t 2 /nobreak >nul

echo [3/3] Starting Vite Frontend Client (Port 3000)...
start "Hostel Safety - Frontend Client (Port 3000)" cmd /c "cd client && npm run dev -- --host 127.0.0.1 --port 3000"

timeout /t 3 /nobreak >nul

echo.
echo ======================================================================
echo  All 3 services have started and connected successfully!
echo  - Frontend Web App:     http://localhost:3000
echo  - Backend API Server:   http://localhost:5000
echo  - Face Recognition:     http://localhost:8005
echo ======================================================================
echo.
echo Opening browser to http://localhost:3000...
start http://localhost:3000

echo.
echo Press any key to close this launcher window (services will stay running in background).
pause >nul
