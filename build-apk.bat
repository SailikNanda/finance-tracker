@echo off
REM Finera - build Android APK from this PC.
REM Usage: open this file in Windows Explorer (double-click), or run from terminal.
REM After it finishes, the APK is at:
REM   frontend\android\app\build\outputs\apk\debug\app-debug.apk
REM Copy that file to your phone and install it.

setlocal

cd /d "%~dp0"

echo.
echo === Finera APK Builder ===
echo.

REM --- Step 1: confirm Java + Android SDK ---
where java >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Java not found. Install JDK 17 from https://adoptium.net and restart.
  pause
  exit /b 1
)

if "%ANDROID_HOME%"=="" set "ANDROID_HOME=C:\Android\android-sdk"
if not exist "%ANDROID_HOME%\platform-tools" (
  echo [WARN] ANDROID_HOME not set or SDK not found at %ANDROID_HOME%.
  echo        Set it via: setx ANDROID_HOME "C:\Android\android-sdk"
  echo        Then put platform-tools + build-tools + platforms inside it.
)

REM Persist for gradle (it doesn't inherit shell env otherwise).
setx ANDROID_HOME "%ANDROID_HOME%" >nul 2>nul

REM --- Step 2: install JS deps if missing ---
if not exist "frontend\node_modules" (
  echo [1/5] Installing JS dependencies...
  pushd frontend
  call npm install
  if errorlevel 1 ( popd & echo [ERROR] npm install failed. & pause & exit /b 1 )
  popd
) else (
  echo [1/5] JS deps already installed.
)

REM --- Step 3: build web bundle ---
echo [2/5] Building web bundle (dist/^)...
pushd frontend
call npm run build
if errorlevel 1 ( popd & echo [ERROR] vite build failed. & pause & exit /b 1 )
popd

REM --- Step 4: sync to android ---
echo [3/5] Syncing to Android...
pushd frontend
call npx cap sync android
if errorlevel 1 ( popd & echo [ERROR] cap sync failed. & pause & exit /b 1 )
popd

REM --- Step 5: assemble debug APK ---
echo [4/5] Building APK (gradle^)...
pushd frontend\android
if exist "gradlew.bat" (
  call gradlew.bat assembleDebug
) else (
  echo [WARN] gradlew.bat missing. Trying system gradle...
  gradle assembleDebug
)
if errorlevel 1 ( popd & echo [ERROR] gradle build failed. & pause & exit /b 1 )
popd

echo.
echo [5/5] Done!
echo.
echo APK location:
echo   %CD%\frontend\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo To install on phone:
echo   1. Copy that APK file to your phone (USB, email, Google Drive, etc.)
echo   2. Open the file in your phone's file manager
echo   3. Tap "Install" (allow "Unknown Sources" if prompted)
echo.
pause
