# Install Guide (English)

## Pre-requisites (one-time, on your PC)

You will need on your PC:
- **Node.js 16+** - https://nodejs.org
- **Java JDK 17** - https://adoptium.net
- **Android SDK** - https://developer.android.com/studio#command-line-tools-only

Install everything, then restart your PC.

---

## Building the APK (one-time, ~5 minutes)

### Step 1: First build
1. In File Explorer, go to the `S:\Finance Tracker\finance-tracker\` folder
2. **Double-click** the `build-apk.bat` file
3. A window opens and automatically does 4 tasks (npm install, vite build, cap sync, gradle)
4. Takes 3-5 minutes the first time (30 seconds afterwards)
5. At the end you'll see the message: "APK location: ..."

You'll get the APK at:
```
S:\Finance Tracker\finance-tracker\frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

### Step 2: Install on your phone

**Option A: USB cable (easiest)**
1. Connect your phone to the PC with a USB cable
2. Enable "USB Debugging" on your phone:
   - Settings > About Phone > tap "Build Number" 7 times (developer mode on)
   - Settings > Developer Options > USB Debugging ON
3. In PowerShell on your PC:
```powershell
adb install "S:\Finance Tracker\finance-tracker\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
```

**Option B: Google Drive / Email (easy)**
1. Upload the APK file to Google Drive (or email it to yourself)
2. Open Google Drive on your phone and download the APK file
3. Tap the APK file in your File Manager
4. Tap "Install" (you may need to allow Unknown Sources)

**Option C: Direct transfer (USB without adb)**
1. Connect your phone to the PC with a USB cable
2. Select "File Transfer" mode on your phone
3. Your phone's storage will appear on the PC
4. Copy the APK file to your phone
5. Go to File Manager on your phone, tap the APK and install

### Step 3: Open the app
- You'll find the "Finera" app on your phone
- Tap to open it
- The AI Insights tab opens by default

### Step 4: Add API keys
- Go to the More tab
- Paste your Groq API key (get it free at console.groq.com)
- Paste your Tavily API key (get it free at tavily.com, 1000 searches/month)
- Tap Save

---

## Updating later

If you change the code (new feature, bug fix):

1. Edit the code in `frontend/src/`
2. Double-click `build-apk.bat` (30 seconds)
3. A new APK is created in the same folder
4. Install that APK on your phone (it replaces the old one, **your data is safe**)

---

## Common problems

### "Java not found"
- Install JDK 17 (from adoptium.net)
- Restart your PC

### "SDK not found"
- In PowerShell:
```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Android\android-sdk", "User")
```

### "gradlew.bat not found"
- `gradlew.bat` should be in the `frontend\android` folder. If not, run `gradle wrapper` in that folder.

### "Could not find tools.jar"
- You're using Java 8; JDK 17 is required

### APK won't install on the phone
- Settings > Security > Unknown Sources enable it
- Uninstall the old "Finera" app and try again

### App crashes when opening
- Enable Developer Options > USB Debugging on your phone and connect to the PC
- On the PC run: `adb logcat | finera` (shows the logs)

---

## Features

- 15+ currencies
- Real-time day-to-day rates (Tavily)
- AI insights (Groq)
- Monthly summary
- Charts
- Dark theme
- Data backup/restore

## Tech stack

- React + Vite + framer-motion
- Capacitor 5 (Android)
- IndexedDB (local storage)
- Groq (AI)
- Tavily (currency)
