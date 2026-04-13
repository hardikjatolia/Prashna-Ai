@echo off
echo ============================================
echo   Prashna AI — Starting up...
echo ============================================
echo.

:: Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.10+
    pause
    exit /b 1
)

:: Install deps if needed
echo [1/2] Installing dependencies...
pip install -r backend\requirements.txt -q

echo [2/2] Starting server at http://localhost:8000
echo.
echo  Open your browser at:  http://localhost:8000
echo  Press Ctrl+C to stop.
echo.

:: Start backend from project root so relative paths work
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
pause
