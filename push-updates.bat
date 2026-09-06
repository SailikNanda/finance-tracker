@echo off
REM Finera - push code changes to GitHub (no release, no version bump).
REM Usage: double-click, or pass a commit message:
REM        push-updates.bat "my commit message"
REM Fixed: now finds repo root, cleans virtual cache, handles spaces in path.

setlocal enabledelayedexpansion

REM --- Find git repo root (handles space in "Finance Tracker") ---
for /f "delims=" %%i in ('git rev-parse --show-toplevel 2^>nul') do set "GITROOT=%%i"
if defined GITROOT (
  echo.
  echo === Finera: Push updates to GitHub ===
  echo [INFO] Repo root: !GITROOT!
  cd /d "!GITROOT!"
) else (
  REM Fallback: script is in finance-tracker/, repo is parent
  cd /d "%~dp0"
  if exist "..\.git" cd /d "%~dp0\.."
  echo.
  echo === Finera: Push updates to GitHub ===
  echo [INFO] Repo root fallback: !CD!
)

set "MSG=Update"
if not "%~1"=="" set "MSG=%~1"

REM --- Auto-fix: untrack virtual/ if it was previously committed (biggest reason push hangs/fails) ---
git ls-files --error-unmatch virtual >nul 2>&1
if !errorlevel! EQU 0 (
  echo [FIX] Removing already-tracked virtual/ from index (was committed before .gitignore)...
  git rm -r --cached --ignore-unmatch virtual >nul 2>&1
  if !errorlevel! EQU 0 echo [FIX] virtual/ untracked. Will be ignored henceforth.
)
git ls-files --error-unmatch finance-tracker/virtual >nul 2>&1
if !errorlevel! EQU 0 (
  echo [FIX] Removing finance-tracker/virtual/ from index...
  git rm -r --cached --ignore-unmatch finance-tracker/virtual >nul 2>&1
)
REM Ensure root .gitignore exists so it doesn't happen again
if not exist ".gitignore" (
  echo [FIX] Creating root .gitignore
  (
    echo virtual/
    echo __pycache__/
    echo *.pyc
    echo *.log
    echo *.err
    echo *.out
    echo .env
    echo node_modules/
  ) > .gitignore
  echo [FIX] Created .gitignore
)

echo.
echo [1/3] Staging changes (git add -A)...
git add -A
if errorlevel 1 (
  echo [ERROR] git add failed. Check git status.
  git status
  pause
  exit /b 1
)

REM Show what will be committed (helps debug "push not working")
echo [INFO] Staged changes:
git diff --cached --stat
echo.

git diff --cached --quiet
if errorlevel 1 goto :commit

echo Nothing to commit. Already up to date.
echo.
echo [INFO] If you expected changes, run: git status
git status --short
pause
exit /b 0

:commit
echo [2/3] Committing: "%MSG%"
git commit -m "%MSG%"
if errorlevel 1 (
  echo [ERROR] git commit failed. Maybe nothing staged or commit hook failed.
  git status
  pause
  exit /b 1
)

echo [3/3] Pushing to origin main...
git push origin main
if errorlevel 1 (
  echo.
  echo [ERROR] git push failed.
  echo Possible causes:
  echo  - No internet
  echo  - HTTPS auth expired. Run: gh auth login  OR  create a PAT at https://github.com/settings/tokens
  echo  - Remote is ahead. Try: git pull --rebase origin main
  echo.
  git remote -v
  pause
  exit /b 1
)

echo.
echo Pushed to GitHub successfully.
echo.
pause
