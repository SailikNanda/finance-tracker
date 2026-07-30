# Finance Tracker - APK Builder for VS Code
# Run this in VS Code PowerShell terminal

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Finance Tracker - APK Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Java
Write-Host "[1/6] Checking Java..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1
    Write-Host "   Java found ✓" -ForegroundColor Green
} catch {
    Write-Host "   Java NOT found!" -ForegroundColor Red
    Write-Host "   Download: https://adoptium.net/temurin/releases/?version=17" -ForegroundColor Yellow
    Start-Process "https://adoptium.net/temurin/releases/?version=17"
    exit 1
}

# Check Android SDK
Write-Host "[2/6] Checking Android SDK..." -ForegroundColor Yellow
$sdkPath = $env:ANDROID_HOME
if (-not $sdkPath) {
    $sdkPath = $env:ANDROID_SDK_ROOT
}
if (-not $sdkPath) {
    Write-Host "   Android SDK NOT found!" -ForegroundColor Red
    Write-Host "   Download: https://developer.android.com/studio#command-line-tools-only" -ForegroundColor Yellow
    Write-Host "   Extract to: C:\Android\android-sdk" -ForegroundColor Yellow
    exit 1
}
Write-Host "   Android SDK: $sdkPath ✓" -ForegroundColor Green

# Build frontend
Write-Host "[3/6] Building React app..." -ForegroundColor Yellow
Set-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "   Frontend built ✓" -ForegroundColor Green

# Install Capacitor
Write-Host "[4/6] Installing Capacitor..." -ForegroundColor Yellow
npm install @capacitor/core @capacitor/cli @capacitor/android
Write-Host "   Capacitor installed ✓" -ForegroundColor Green

# Add Android platform
Write-Host "[5/6] Setting up Android..." -ForegroundColor Yellow
if (-not (Test-Path "android")) {
    npx cap add android
}
npx cap sync android
Write-Host "   Android configured ✓" -ForegroundColor Green

# Build APK
Write-Host "[6/6] Building APK..." -ForegroundColor Yellow
Set-Location android
.\gradlew.bat assembleDebug

if ($LASTEXITCODE -eq 0) {
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   APK BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK Location:" -ForegroundColor Cyan
    Write-Host "frontend\android\$apkPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To install on phone:" -ForegroundColor Cyan
    Write-Host "1. Copy APK to phone" -ForegroundColor White
    Write-Host "2. Tap to install" -ForegroundColor White
    Write-Host "3. Enable Unknown Sources if needed" -ForegroundColor White
} else {
    Write-Host "   Build failed!" -ForegroundColor Red
}

Set-Location ..
