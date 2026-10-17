@echo off
title Adaptive Flow & Beat Engine - Dev Runner
echo ===================================================
echo [ADAPTIVE FLOW // BEAT ENGINE v2.0 - DEVELOPER MODE]
echo ===================================================
echo.

echo 1. Khoi dong Backend FastAPI tai http://127.0.0.1:8000 ...
start "Adaptive Flow - Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo 2. Khoi dong Frontend Vite tai http://127.0.0.1:5173 ...
start "Adaptive Flow - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo 3. Mo trinh duyet...
start http://127.0.0.1:5173

echo.
echo He thong da khoi dong xong! Nhan Ctrl+C hoac dong cua so de thoat.
