@echo off
setlocal
pushd "%~dp0"
echo ===================================
echo    Finance Tracker - Starting...
echo ===================================
echo.

echo [1/3] Installing Python dependencies...
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo Python install failed. Make sure Python 3.10+ is installed and on PATH.
    popd
    pause
    exit /b 1
)
cd..

echo.
echo [2/3] Installing React dependencies...
cd frontend
if not exist node_modules (
    call npm install
    if errorlevel 1 (
        echo npm install failed. Make sure Node.js 18+ is installed and on PATH.
        popd
        pause
        exit /b 1
    )
)
cd..

echo.
echo [3/3] Starting application...
echo.
echo Backend starting on http://localhost:8000
echo Frontend starting on http://localhost:3000
echo.

start "Finance Tracker Backend" cmd /k "cd /D ""%~dp0backend"" && python app.py"
timeout /t 3 /nobreak > nul
start "Finance Tracker Frontend" cmd /k "cd /D ""%~dp0frontend"" && npm run dev"

echo.
echo ===================================
echo    Application is running!
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:8000
echo    Press Ctrl+C in each window to stop.
echo ===================================
popd
endlocal
pause
