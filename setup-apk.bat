@echo off
echo ========================================
echo    Finance Tracker - Setup for APK Build
echo ========================================
echo.
echo This will install everything needed to
echo build APK without Android Studio.
echo.

REM Check if Java is installed
java -version 2>nul
if %errorlevel% neq 0 (
    echo [1/3] Java JDK not found. Installing...
    echo.
    echo Please download and install Java JDK 17:
    echo https://adoptium.net/temurin/releases/?version=17
    echo.
    echo Choose: Windows x64 .msi installer
    echo.
    pause
    start https://adoptium.net/temurin/releases/?version=17
    echo.
    echo After installing Java, run this script again.
    pause
    exit /b 1
) else (
    echo [1/3] Java JDK found ✓
)

REM Check if Android SDK exists
if not defined ANDROID_HOME (
    if not defined ANDROID_SDK_ROOT (
        echo.
        echo [2/3] Android SDK not found.
        echo.
        echo Option 1: Install Android Studio (recommended)
        echo   Download: https://developer.android.com/studio
        echo.
        echo Option 2: Command Line Tools only
        echo   Download: https://developer.android.com/studio#command-line-tools-only
        echo   Extract to: C:\Android\android-sdk
        echo   Set ANDROID_HOME=C:\Android\android-sdk
        echo.
        echo After installing Android SDK, run this script again.
        pause
        exit /b 1
    )
)

echo [2/3] Android SDK found ✓

echo.
echo [3/3] Installing SDK packages...
if defined ANDROID_HOME (
    call %ANDROID_HOME%\tools\bin\sdkmanager "platforms;android-33" "build-tools;33.0.0" "platform-tools"
) else if defined ANDROID_SDK_ROOT (
    call %ANDROID_SDK_ROOT%\tools\bin\sdkmanager "platforms;android-33" "build-tools;33.0.0" "platform-tools"
)

echo.
echo ========================================
echo    Setup Complete!
echo ========================================
echo.
echo Now run: build-apk.bat
echo.
pause
