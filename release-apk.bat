@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "publish-release.ps1"
if errorlevel 1 (
  echo Release failed. No rebase or tag overwrite was performed.
  pause
  exit /b 1
)
pause
