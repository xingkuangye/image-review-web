@echo off
echo ========================================
echo     Image Review System
echo ========================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.8+
    pause
    exit /b 1
)

:: Check virtual environment
if not exist "venv\Scripts\python.exe" (
    echo [INFO] Creating virtual environment...
    python -m venv venv
    echo [INFO] Installing dependencies...
    call venv\Scripts\pip install -r requirements.txt
)

:: Start server
echo [INFO] Starting server...
start "" "http://localhost:8000"
call venv\Scripts\python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
