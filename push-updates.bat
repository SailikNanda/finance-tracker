@echo off
REM Finera - push code changes to GitHub (no release, no version bump).
REM Usage: double-click, or pass a commit message:
REM        push-updates.bat "my commit message"

setlocal

cd /d "%~dp0"

set "MSG=Update"
if not "%~1"=="" set "MSG=%~1"

echo.
echo === Finera: Push updates to GitHub ===
echo.

git add -A
if errorlevel 1 (
  echo [ERROR] git add failed
  pause
  exit /b 1
)

git diff --cached --quiet
if errorlevel 1 goto :commit

echo Nothing to commit. Already up to date.
echo.
pause
exit /b 0

:commit
git commit -m "%MSG%"
if errorlevel 1 (
  echo [ERROR] git commit failed
  pause
  exit /b 1
)

git push origin main
if errorlevel 1 (
  echo [ERROR] git push failed
  pause
  exit /b 1
)

echo.
echo Pushed to GitHub.
echo.
pause