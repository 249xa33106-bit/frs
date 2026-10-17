# Hostel Safety Management System - PowerShell Launcher
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   Hostel Safety - Attendance & Student Movement Management System" -ForegroundColor White
Write-Host "                 Mandatory Design: Light Mode Only" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not found on PATH. Please install Node.js."
    exit 1
}

# Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Python is not found on PATH. Please install Python."
    exit 1
}

Write-Host "[1/3] Starting Python FastAPI + OpenCV Face Engine on port 8005..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\face-service'; python -m uvicorn app:app --host 127.0.0.1 --port 8005"

Start-Sleep -Seconds 2

Write-Host "[2/3] Starting Express Backend & SQLite Database on port 5000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\server'; npx tsx src/index.ts"

Start-Sleep -Seconds 2

Write-Host "[3/3] Starting Vite Frontend Client on port 3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\client'; npm run dev -- --host 127.0.0.1 --port 3000"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  All services connected and running:" -ForegroundColor White
Write-Host "  - Frontend Portal:    http://localhost:3000" -ForegroundColor Green
Write-Host "  - Backend API Server: http://localhost:5000" -ForegroundColor Green
Write-Host "  - Face Recognition:   http://localhost:8005" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Launching http://localhost:3000 in your browser..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"
