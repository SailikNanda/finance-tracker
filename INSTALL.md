# Install Guide (Bangla)

## Pre-requisite (one-time, PC-te)

Aapnar PC-te lagbe:
- **Node.js 16+** - https://nodejs.org
- **Java JDK 17** - https://adoptium.net
- **Android SDK** - https://developer.android.com/studio#command-line-tools-only

Sob install kore PC restart koro.

---

## APK Banano (one-time, 5 minute)

### Step 1: First build
1. File Explorer-e jao `S:\Finance Tracker\finance-tracker\` folder-e
2. `build-apk.bat` file-ta **double-click** koro
3. Window khule automatic 4 ta kaj korbe (npm install, vite build, cap sync, gradle)
4. 3-5 minute lagbe prothom bar (pore 30 second)
5. Shesh-e message asbe: "APK location: ..."

APK pabe:
```
S:\Finance Tracker\finance-tracker\frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

### Step 2: Phone-e install

**Option A: USB cable (shoje)**
1. Phone-e USB cable diye PC-te connect koro
2. Phone-e "USB Debugging" enable koro:
   - Settings > About Phone > tap "Build Number" 7 times (developer mode on)
   - Settings > Developer Options > USB Debugging ON
3. PC-te PowerShell-e:
```powershell
adb install "S:\Finance Tracker\finance-tracker\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
```

**Option B: Google Drive / Email (sohoj)**
1. APK file Google Drive-e upload koro (ba email-e pathiye self)
2. Phone-e Google Drive khola, APK file download koro
3. File Manager-e APK file-e tap koro
4. "Install" tap koro (Unknown Sources allow korte hobe)

**Option C: Direct transfer (USB but no adb)**
1. Phone-e USB cable diye PC-te connect koro
2. "File Transfer" mode select koro phone-e
3. PC-te phone-er storage dekhabe
4. APK file copy koro phone-e
5. Phone-e File Manager-e jao, APK tap kore install

### Step 3: App open koro
- Phone-e "Finera" app pabe
- Tap kore open koro
- AI Insights tab default-e open hobe

### Step 4: API key add koro
- More tab-e jao
- Groq API key paste koro (console.groq.com theke free paben)
- Tavily API key paste koro (tavily.com theke free paben, 1000/month)
- Save chapo

---

## Future-e update korte

Jodi code change kore (notun feature, bug fix):

1. `frontend/src/` e code edit koro
2. `build-apk.bat` double-click koro (30 second)
3. Notun APK same folder-e toiri hobe
4. Phone-e sei APK install koro (purano ta replace hobe, **data safe thakbe**)

---

## Common problems

### "Java not found"
- JDK 17 install koro (adoptium.net theke)
- PC restart koro

### "SDK not found"
- PowerShell-e:
```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Android\android-sdk", "User")
```

### "gradlew.bat not found"
- `frontend\android` folder-e `gradlew.bat` thakbe. Na thakle `gradle wrapper` run koro sei folder-e.

### "Could not find tools.jar"
- Java 8 use korcho, JDK 17 lagbe

### APK install hosse na phone-e
- Settings > Security > Unknown Sources enable koro
- Purano "Finera" app uninstall kore try koro

### App crash kore open korte gele
- Phone-e Developer Options > USB Debugging ON kore PC connect koro
- PC-te: `adb logcat | finera` (logs dekhabe)

---

## Features

- 15+ currency
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
