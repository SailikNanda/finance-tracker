<img src="https://capsule-render.vercel.app/api?type=rect&color=0:5B86E5,50:36D1DC,100:F09819&height=3&width=100%" alt="divider" />

# Finera v2.8.8 — Pure APK, Zero Backend

It works even when your laptop is powered off. Data is stored locally on the phone. No backend or internet connection is required.

<p align="center">
  <img src="https://img.shields.io/badge/Backend-Zero-5B86E5?style=for-the-badge" alt="Zero Backend" />
  <img src="https://img.shields.io/badge/Offline-Capable-36D1DC?style=for-the-badge" alt="Offline Capable" />
  <img src="https://img.shields.io/badge/Version-2.8.8-F09819?style=for-the-badge" alt="Version 2.8.8" />
  <img src="https://img.shields.io/badge/Platform-Android-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
  <img src="https://img.shields.io/badge/License-MIT-3DDC84?style=for-the-badge&logo=opensourceinitiative&logoColor=white" alt="MIT License" />
</p>

---

## v2.8.8 Features

- **In-app updates (GitHub)** — when a new release is published, users see **Settings → App update**, tap once to download and install. Data stays intact.
- **Edit transactions** — pencil icon in History; date can be changed (backdating supported)
- **Faster AI** — Groq **Qwen 3.8 27B**
- **Fixed backup dates** — import keeps the original dates
- **PDF export** — spreadsheet-style report with date/time/amount columns
- **Optimized** — code splitting, faster loads, and a compound IndexedDB index

---

## What's changed (v1.3.0 → v2.8.8)

| Old (v1.3.0) | New (v2.8.8) |
|---|---|
| Python backend (FastAPI) | ❌ Removed (runtime) |
| SQLite (on PC) | IndexedDB (on phone) |
| Backend called Groq | Phone Chrome WebView calls Groq directly |
| Backend called Tavily | Phone Chrome WebView calls Tavily directly |
| Backend cloud upload required | ❌ Not needed |
| OTA update (5 seconds) | ❌ Removed — now APK rebuild (≈30 seconds) |
| Web + APK | Pure APK (Capacitor) |

---

## Quick Start (5 minutes)

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
Copy the APK file to your phone (USB, Google Drive, email). Open it with a file manager and install. You may need to enable "Unknown Sources" or allow installing apps from the file manager.

### 5. Open the app
Look for the "Finera" app on your phone. When opened, the AI tab is the default — simply tap to use.

---

## How It Works (architecture)

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

The `backend/` folder remains in the repo but the app no longer uses it at runtime. It is kept for reference and future use.

---

## Release System (one-click)

Two scripts handle everything — no manual version editing needed.

### push-updates.bat — push code changes only
Double-click (or run `push-updates.bat "commit message"` from a terminal). It commits every change and pushes to **GitHub**. No version bump, no release.

### release-apk.bat — full release (recommended)
Double-click, type a version like `2.0.1`, press Enter. The script does everything automatically:

1. **Updates the version everywhere** — `frontend\.env` (`VITE_APP_VERSION`), `frontend\package.json`, Android `build.gradle` (`versionName` + `versionCode` auto-increment)
2. **Builds the app** — web bundle + Android APK
3. **Commits + tags** — `Release v2.0.1` commit and `v2.0.1` tag
4. **Pushes to GitHub** — branch + tag
5. **Creates a GitHub Release** — APK attached as release asset

Users then see **"v2.0.1 ready"** in **Settings → App update** — tap to download and install. Data is preserved during updates.

Requirements (one-time): `gh` CLI (https://cli.github.com) with `gh auth login`. Repo: `SailikNanda/finance-tracker`.

---

## Where Data Is Stored

- Transactions → IndexedDB (Chrome WebView internal storage on the phone)
- API keys (Groq, Tavily) → localStorage
- Currency rate cache -> localStorage
- Default currency choice -> localStorage

Everything stays on your phone. Nothing is uploaded to the cloud or copied to your PC.

A phone reset or factory restore will erase data. To back up:
- Go to Settings → Data backup → Export PDF (report) or Export JSON (backup)
- Save the file to Google Drive / SD card / PC
- Restore with Import JSON when needed

---

## API Keys (Groq + Tavily): How to Add Them

Open the app and go to the More tab (Settings):
1. Paste your Groq API key (starts with `gsk_...`) into the "Groq API key" field
   - Get a key at: https://console.groq.com (free, no card required)
2. Paste your Tavily API key (starts with `tvly-...`) into the "Tavily API key" field
   - Get a key at: https://tavily.com (free tier: 1000 searches/month, no card required)
3. Save

Keys are stored locally in your phone's localStorage. They are never sent to any backend.

---

## Features

- 15+ currencies with real-time daily rates (Tavily)
- AI insights (Groq Qwen 3.6 27B)
- 6-month savings tips
- Pie and bar charts for categories
- Monthly summary
- PDF report export (timestamped filename, spreadsheet-style table)
- Edit + delete transactions with confirmation
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
| **[INSTALL.md](INSTALL.md)** | Detailed setup (in English) |

The `backend/` folder is kept for reference.

---

## Tech Stack

- React 18 + Vite 5
- framer-motion (animations)
- Capacitor 5 (Android wrapper)
- IndexedDB (data storage)
- Groq API (AI)
- Tavily REST (live rates)
- jsPDF (PDF export)
- Java JDK 17 + Gradle + Android SDK (build only)

---

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:5B86E5,50:36D1DC,100:F09819&height=3&width=100%" alt="divider" />

## License

MIT.
