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

echo [0/5] Checking version against GitHub (must be higher than the latest release)...
powershell -NoProfile -ExecutionPolicy Bypass -File "check-version.ps1" -Version "%VERSION%"
if errorlevel 1 goto :fail

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
REM Auto-fix missing local.properties (SDK location not found)
if not exist "frontend\android\local.properties" (
  echo [FIX] local.properties missing, creating with SDK at %%LOCALAPPDATA%%\Android\Sdk
  if defined ANDROID_HOME (
    echo sdk.dir=%ANDROID_HOME:\=\\% > frontend\android\local.properties
  ) else (
    echo sdk.dir=C\:\\Users\\%USERNAME%\\AppData\\Local\\Android\\Sdk > frontend\android\local.properties
    if not exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
      echo [WARN] SDK not found at default location, please set ANDROID_HOME
    )
  )
  type frontend\android\local.properties
)
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

set "SHA=%APK%.sha256"
powershell -NoProfile -Command "(Get-FileHash -Algorithm SHA256 '%APK%').Hash.ToLower() | Out-File -Encoding ASCII '%SHA%'"

echo [4/5] Committing and pushing to GitHub...
git add -A
git commit -m "Release v%VERSION%" || echo [WARN] Nothing new to commit.
git tag -f "v%VERSION%" -m "Finera v%VERSION%"
git push origin main
if errorlevel 1 (
  echo [INFO] Push rejected (remote ahead), syncing with remote...
  git fetch origin
  git pull --rebase origin main
  if errorlevel 1 (
    echo [ERROR] Rebase failed, fix conflicts then run: git rebase --continue
    echo         Or abort with: git rebase --abort
    goto :fail
  )
  echo [INFO] Retrying push...
  git push origin main
  if errorlevel 1 goto :fail
)
REM Push tag (force update if already exists)
git push -f origin "v%VERSION%"
if errorlevel 1 goto :fail

echo [5/5] Creating GitHub Release...
REM If release already exists (tag pushed but release failed before), update it instead of failing
gh release view "v%VERSION%" >nul 2>&1
if %errorlevel% EQU 0 (
  echo [INFO] Release v%VERSION% already exists on GitHub, updating APK...
  gh release upload "v%VERSION%" "%APK%" "%SHA%" --clobber
  if errorlevel 1 goto :fail
  gh release edit "v%VERSION%" --title "Finera v%VERSION%" --notes "New Finera release v%VERSION%. Install from the app via Settings - App update, or download here." --latest
  if errorlevel 1 goto :fail
) else (
  gh release create "v%VERSION%" "%APK%" "%SHA%" --title "Finera v%VERSION%" --notes "New Finera release v%VERSION%. Install from the app via Settings - App update, or download here." --latest
  if errorlevel 1 goto :fail
)

REM Verify release is live and has APK
echo [INFO] Verifying release...
gh release view "v%VERSION%" --json assets --jq ".assets[].name" | findstr /i ".apk" >nul
if errorlevel 1 (
  echo [WARN] APK not found in release, retrying upload...
  gh release upload "v%VERSION%" "%APK%" "%SHA%" --clobber
)

echo.
echo ============================================
echo  Done! v%VERSION% published to GitHub.
echo  Users will see "Update available" in the app within 1 hour
echo  or instantly if they tap "Check again" in Settings - App update.
echo  Verify: https://github.com/SailikNanda/finance-tracker/releases/tag/v%VERSION%
echo ============================================
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] Something went wrong. Fix the problem and run again.
pause
exit /b 1