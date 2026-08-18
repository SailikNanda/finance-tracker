# Finera v2.0 — Pure APK, Zero Backend

Works even if your laptop is off. Data is stored on the phone. No backend or internet required.

---

## What's changed (v1.3.0 -> v2.0.0)

| Old (v1.3.0) | New (v2.0.0) |
|---|---|
| Python backend (FastAPI) | ❌ Removed (runtime) |
| SQLite (on PC) | IndexedDB (on phone) |
| Backend called Groq | Phone Chrome WebView calls Groq directly |
| Backend called Tavily | Phone Chrome WebView calls Tavily directly |
| Backend cloud upload required | ❌ Not needed |
| OTA update (5 seconds) | ❌ Removed — now APK rebuild (≈30 seconds) |
| Web + APK | Pure APK (Capacitor) |

---

## Quick start (5 minutes)

### 1. Install Java JDK 17 (one-time)
Download and install from https://adoptium.net. Use default settings and restart your PC.

### 2. Install Android SDK (one-time)
Download the command-line tools from https://developer.android.com/studio#command-line-tools-only
Extract them into a folder like `C:\Android\android-sdk`.

In PowerShell (once):
```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Android\android-sdk", "User")
```

### 3. Build the APK (one-time, ~5 minutes)
Go to the `S:\Finance Tracker\finance-tracker\` folder and double-click `build-apk.bat`.

This script performs 4 tasks:
1. npm install
2. vite build
3. npx cap sync android
4. gradle assembleDebug

APK output: `frontend\android\app\build\outputs\apk\debug\app-debug.apk`

### 4. Install on your phone
Copy the APK file to your phone (USB, Google Drive, email). Open it with a file manager and install. You may need to enable "Unknown Sources" or allow installing apps from file manager.

### 5. Open the app
Look for the "Finera" app on your phone. When opened, the AI tab is the default — tap to use.

---

## How it works (architecture)

```
App opens on the phone
    ↓
React (inside WebView)
    ↓
Transactions -> IndexedDB (stored on phone)
AI Insights -> Direct Groq API call (your key)
Live rates -> Direct Tavily API call (your key)
    ↓
Laptop off? No problem — the app continues to work.
```

The `backend/` folder remains in the repo but the app no longer uses it at runtime. It's kept for reference and for future needs.

---

## How to update later

If you make changes in React (new feature, bug fix, UI tweak):

1. Edit code under `frontend/src/`
2. Double-click `build-apk.bat` (about 30 seconds)
3. The new APK will be at `frontend\android\app\build\outputs\apk\debug\app-debug.apk`
4. Install the APK on your phone (it will replace the old one — your app data will be preserved)

With Gradle cache warm, building an APK takes ~30 seconds and installing on the phone ~1 minute.

---

## Where data is stored

- Transactions -> IndexedDB (Chrome WebView internal storage on the phone)
- API keys (Groq, Tavily) -> localStorage
- Currency rate cache -> localStorage
- Default currency choice -> localStorage

Everything stays on your phone. Nothing is uploaded to the cloud or copied to your PC.

Phone reset or factory restore will erase data. To back up:
- Go to Settings -> Data backup -> Export JSON and download a file
- Save the JSON to Google Drive / SD card / PC
- Restore with Import JSON when needed

---

## API keys (Groq + Tavily): how to add them

Open the app and go to the More tab (Settings):
1. Paste your Groq API key (starts with `gsk_...`) into the "Groq API key" field
   - Get a key at: https://console.groq.com (free, no card required)
2. Paste your Tavily API key (starts with `tvly-...`) into the "Tavily API key" field
   - Get a key at: https://tavily.com (free tier: 1000 searches/month, no card required)
3. Save

Keys are stored locally in the phone's localStorage. They are never sent to any backend.

---

## Features

- 15+ currencies with real-time day-to-day rates (Tavily)
- AI insights (Groq Llama 3.3 70B)
- 6-month savings tips
- Pie and bar charts for categories
- Monthly summary
- Dark glass-morphism UI with iOS-style spring animations
- Haptic feedback
- 100% offline-capable
- Zero backend, zero cloud, zero telemetry
- Data backup/restore (JSON)

---

## Documentation

| File | Contents |
|---|---|
| **README.md** (this file) | Overview, quick start |
| **[BANGLA.md](BANGLA.md)** | Bangla guide (v2.0) |
| **[INSTALL.md](INSTALL.md)** | Detailed setup |
| **[APK-BUILD-VSCODE.md](APK-BUILD-VSCODE.md)** | APK build details |

The `backend/` folder is kept for reference. `BACKEND.md` and `TAVILY.md` are legacy reference documents.

---

## Tech stack

- React 18 + Vite 5
- framer-motion (animations)
- Capacitor 5 (Android wrapper)
- IndexedDB (data storage)
- Groq SDK (AI)
- Tavily REST (live rates)
- Java JDK 17 + Gradle + Android SDK (build only)

---

## License

MIT.
