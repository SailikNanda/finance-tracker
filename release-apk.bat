@echo off
REM Finera - one-click full release.
REM Asks for a version, updates it everywhere (.env, package.json, build.gradle),
REM builds the APK, commits, tags, pushes to GitHub and creates a Release.
REM Users then see "Update available" inside the app (Settings - App update).
REM Usage: double-click, type a version like 2.0.1, press Enter.

setlocal

cd /d "%~dp0"

echo.
echo === Finera Release Publisher ===
echo.

set /p VERSION="Release version (e.g. 2.0.1): "

if "%VERSION%"=="" (
  echo [ERROR] Version required.
  pause
  exit /b 1
)

set "VERSION=%VERSION:v=%"

echo %VERSION%| findstr /r "^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$" >nul
if errorlevel 1 (
  echo [ERROR] Invalid version format. Use X.Y.Z like 2.0.1
  pause
  exit /b 1
)

echo.
echo [1/5] Updating version to %VERSION% everywhere...
powershell -NoProfile -ExecutionPolicy Bypass -File "release-tools.ps1" -Version "%VERSION%"
if errorlevel 1 goto :fail

echo [2/5] Building web bundle...
if not exist "frontend\node_modules" (
  pushd frontend
  call npm install
  if errorlevel 1 ( popd & goto :fail )
  popd
)
pushd frontend
call npm run build
if errorlevel 1 ( popd & goto :fail )
popd

echo [3/5] Syncing to Android and building APK...
pushd frontend
call npx cap sync android
if errorlevel 1 ( popd & goto :fail )
popd
pushd frontend\android
call gradlew.bat assembleDebug
if errorlevel 1 ( popd & goto :fail )
popd

set "APK=frontend\android\app\build\outputs\apk\debug\app-debug.apk"
if not exist "%APK%" (
  echo [ERROR] APK not found after build.
  pause
  exit /b 1
)

echo [4/5] Committing and pushing to GitHub...
git add -A
git commit -m "Release v%VERSION%" || echo [WARN] Nothing new to commit.
git tag -f "v%VERSION%" -m "Finera v%VERSION%"
git push origin main --tags
if errorlevel 1 goto :fail

echo [5/5] Creating GitHub Release...
gh release create "v%VERSION%" "%APK%" --title "Finera v%VERSION%" --notes "New Finera release v%VERSION%. Install from the app via Settings - App update, or download here."
if errorlevel 1 goto :fail

echo.
echo ============================================
echo  Done! v%VERSION% published to GitHub.
echo  Users will see "Update available" in the app.
echo ============================================
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] Something went wrong. Fix the problem and run again.
pause
exit /b 1