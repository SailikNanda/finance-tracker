# APK Build Guide (Bangla)

## One-click method (recommended)

`S:\Finance Tracker\finance-tracker\` folder-e `build-apk.bat` file-ta double-click koro. Baki shob automatic.

Eta kaj kore:
1. npm install (jodi na thake)
2. npm run build (Vite production build)
3. npx cap sync android (Capacitor sync)
4. gradlew assembleDebug (APK build)

---

## Manual method (jodi kichu thik na hoy)

### Step 1: Java JDK 17 install
- https://adoptium.net
- Windows x64 .msi download, install, PC restart

### Step 2: Android SDK install
- https://developer.android.com/studio#command-line-tools-only
- `C:\Android\android-sdk` folder-e extract

### Step 3: Environment variable set
PowerShell (Admin):
```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Android\android-sdk", "User")
```

### Step 4: Build
PowerShell-e:
```powershell
cd "S:\Finance Tracker\finance-tracker\frontend"
npm install
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

---

## APK kothay paabo

```
S:\Finance Tracker\finance-tracker\frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## Phone-e install

### Method 1: ADB (USB)
1. Phone-e Developer Options + USB Debugging ON
2. USB connect
3. PC PowerShell-e:
```powershell
adb install "S:\Finance Tracker\finance-tracker\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
```

### Method 2: File transfer
1. Phone-e USB connect, "File Transfer" mode
2. APK file phone-e copy
3. Phone-e File Manager-e APK tap kore install

### Method 3: Cloud
1. APK file Google Drive / email-e upload
2. Phone-e download kore install

---

## Future-e update korte

Code change kore `build-apk.bat` run koro. Notun APK same folder-e. Phone-e sei APK install koro - data safe thakbe.

---

## Troubleshooting

| Somossha | Solution |
|---|---|
| Java not found | JDK 17 install kore PC restart |
| SDK not found | ANDROID_HOME environment variable set |
| gradlew.bat missing | `cd frontend\android; gradle wrapper` |
| Tools.jar not found | Java 8 use korcho, JDK 17 lagbe |
| APK install fail | Purano Finera uninstall kore try koro |
| App crash on start | `adb logcat` e logs dekhun |

---

## v2.0 te keno "APK rebuild"?

Aapni request korechilen "laptop off thakleo cholbe, data phone-e save hoy, backend upload na kori". Eta pure APK-te sohoj - kintu update-er jonne APK rebuild korte hoy. Eta trade-off:

- ✅ Zero backend
- ✅ Zero cloud
- ✅ Data fully local
- ❌ Update-er jonne PC + 30 second

OTA update (5 second-e phone-e push) chaile backend lagbe, kintu aapni seta chhan na. Tai APK rebuild.
