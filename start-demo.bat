@echo off
echo Starting Drishti Demo Ecosystem...

:: Start Demo Site (Static Server)
start "Drishti Demo Portal" cmd /k "cd /d D:\Drishti\demo-site && npx serve ."

:: Start FastAPI Backend (Port 8000)
start "Drishti Backend API" cmd /k "cd /d D:\Drishti\backend && .\venv\Scripts\activate && uvicorn main:app --reload --port 8000"

echo Both services running.