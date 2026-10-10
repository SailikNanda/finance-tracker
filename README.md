<img src="https://capsule-render.vercel.app/api?type=rect&color=0:5B86E5,50:36D1DC,100:F09819&height=3&width=100%" alt="divider" />

# Finera v2.2.8 — Pure APK, Zero Backend

It works even when your laptop is powered off. Data is stored locally on the phone. The ledger works offline without a backend. AI features, current exchange rates, and update checks use internet services.

This source includes audit fixes not yet in the published APK. See [the fix report](docs/AUDIT_FIXES.md) for changes and verification limits. Ship them as a newer signed release using the original installation key.

<p align="center">
  <img src="https://img.shields.io/badge/Backend-Zero-5B86E5?style=for-the-badge" alt="Zero Backend" />
  <img src="https://img.shields.io/badge/Offline-Capable-36D1DC?style=for-the-badge" alt="Offline Capable" />
  <img src="https://img.shields.io/badge/Version-2.2.8-F09819?style=for-the-badge" alt="Version 2.2.8" />
  <img src="https://img.shields.io/badge/Platform-Android-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
  <img src="https://img.shields.io/badge/License-MIT-3DDC84?style=for-the-badge&logo=opensourceinitiative&logoColor=white" alt="MIT License" />
</p>

---

## v2.2.8 Features

- **In-app updates (GitHub)** — checks GitHub releases, verifies SHA-256 and the installed app signing key, then opens the Android installer. Compatible in-place updates preserve the ledger.
- **Edit transactions** — pencil icon in History; date can be changed (backdating supported)
- **Faster AI** — Groq **Qwen 3.8 27B**
- **Restorable JSON backup** — atomic validation, stable identifiers, duplicate skipping and original dates/currencies
- **PDF export** — spreadsheet-style report with date/time/amount columns
- **Optimized** — code splitting, faster loads, and a compound IndexedDB index

---

## What's changed (v1.3.0 → v2.2.8)

| Old (v1.3.0) | New (v2.2.8) |
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

### 1. Install Node.js 22.12+ and Java JDK 17 (one-time)
Install Node.js from https://nodejs.org and Java from https://adoptium.net. Use the default settings and restart your PC.

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
1. npm ci
2. vite build
3. npx cap sync android
4. gradle assembleDebug

APK output: `frontend\android\app\build\outputs\apk\debug\app-debug.apk`

### 4. Install on your phone
Copy the APK file to your phone (USB, Google Drive, email). Open it with a file manager and install. You may need to enable "Unknown Sources" or allow installing apps from the file manager.

### 5. Open the app
Find the "Finera" app on your phone. The Home tab opens first. Use More to add provider keys and opt in to AI data sharing.

---

## How It Works (architecture)

The React app runs inside Capacitor WebView. Ledger entries live in IndexedDB; Android provider keys are encrypted using Keystore. AI reports and consented chat call Groq directly. Rates use ExchangeRate-API with an optional Tavily fallback. GitHub releases supply APK update metadata. PDF code runs in an on-demand worker.


The `backend/` folder remains in the repo but the app no longer uses it at runtime. It is kept for reference and future use.

---

## Release System (one-click)

Two scripts handle everything — no manual version editing required.

### push-updates.bat — push code changes only
Double-click (or run `push-updates.bat "commit message"` from a terminal). It commits all changes and pushes to **GitHub**. No version bump, no release.

### release-apk.bat — full release (recommended)
Double-click, type a new version such as `2.2.9`, press Enter. The script handles everything automatically:

1. Fetches and fast-forwards `main` before building; stops on dirty/diverged work.
2. Updates `package.json`, lockfile and Android version name/code consistently.
3. Runs regression tests, builds the web bundle and a signed, non-debug release APK.
4. Commits and tags the exact source used for the APK; pushes branch and tag atomically.
5. Publishes the APK and SHA-256 sidecar as a new immutable GitHub release. It never rebases a built artifact or force-overwrites a tag.

Set `FINERA_KEYSTORE`, `FINERA_STORE_PASSWORD`, `FINERA_KEY_ALIAS`, and `FINERA_KEY_PASSWORD` in your local environment first. **Use the signing key of the currently installed APK.** Existing debug-signed installations need the original developer machine's debug keystore for a compatible first upgrade. Keep that key backed up outside the repository. A different signing key cannot update existing installations in place.

Users see **Update available** after the signed release is published. Export a JSON backup before upgrading. Do not uninstall an existing app to resolve a signing mismatch; contact the developer.

Requirements (one-time): `gh` CLI (https://cli.github.com) with `gh auth login`. Repo: `SailikNanda/finance-tracker`.

---

## Where Data Is Stored

- Transactions → IndexedDB (Chrome WebView internal storage on the phone)
- Android 6+ API keys → AES-GCM ciphertext in app preferences, protected by a non-exportable Android Keystore key
- Browser / Android 5 keys → memory only for the current session
- Currency rate cache -> localStorage
- Default currency choice -> localStorage

The ledger is stored locally. **AI data sharing is off by default.** Opting in allows reports to send totals/categories to Groq and chat to send your question plus up to 100 recent transaction names/dates/amounts. Eligible chat searches send a sanitized question to Tavily. The bounded chat context does not search older records. Rate requests send currency codes. Exports contain private financial data and exclude API keys.

A phone reset or factory restore will erase your data. To back up:
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

Android 6+ keys are encrypted at rest; existing plaintext keys migrate only after secure saving succeeds. Web/Android 5 sessions retain keys in memory only. Keys are sent to their respective provider to authenticate API calls. Enable the AI data-sharing checkbox before requesting personalized AI features.

---

## Features

- 15+ currencies with current daily rates (ExchangeRate-API / optional Tavily)
- AI insights (Groq Qwen 3.8 27B)
- 6-month savings tips
- Pie and bar charts for categories
- Monthly summary
- PDF report export (timestamped filename, spreadsheet-style table)
- Edit + delete transactions with confirmation
- Dark glass-morphism UI with iOS-style spring animations
- Haptic feedback
- Offline ledger; mixed-currency totals need valid live or explicitly marked cached rates
- No required backend; external AI/rate providers as described above
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

- React 18 + Vite 7
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

## Verification

Use Node 22.12+ and Python 3.12.

```bash
cd frontend
npm ci
npm test
npm run check:version
npm run build
npx playwright install chromium
npm run test:e2e
```

```bash
python -m pip install -r backend/requirements-dev.txt
python -m pytest backend/tests -q
python -m pip_audit -r backend/requirements.txt
```

GitHub Actions runs finance regression, browser, dependency, and Android compilation checks. Optional legacy backend routes require an owner bearer token (`API_AUTH_TOKEN`, at least 32 characters), bind to loopback by default and remain disabled without a configured token. It is a single-owner service, not a multi-user finance API.

The npm postinstall adapter updates Capacitor 5's tar default import for maintained tar 7. It fails if that upstream import changes, so incompatible installs cannot silently ship an unreviewed patch. Node.js 22.12+ is required for Vite 7.
