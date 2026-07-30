# Finera v2.0 - Pure APK, Zero Backend

**Laptop off thakleo cholbe. Data phone-e save hobe. Backend internet-e lagbe na.**

---

## Ki ki change holo (v1.3.0 -> v2.0.0)

| Purono (v1.3.0) | Notun (v2.0.0) |
|---|---|
| Python backend (FastAPI) | ❌ Muchey geche (runtime-e) |
| SQLite (PC-te) | IndexedDB (phone-e) |
| Backend Groq call korto | Phone-e Chrome direct Groq-ke call kore |
| Backend Tavily call korto | Phone-e Chrome direct Tavily-ke call kore |
| Backend cloud-e upload lagto | ❌ Dorkar nei |
| OTA update (5 second-e) | ❌ Anejay - ekhon APK rebuild (30 second) |
| Web + APK | Pure APK (Capacitor) |

---

## Quick start (5 minute)

### 1. Java JDK 17 install (one-time)
https://adoptium.net theke download kore install koro. Default settings-e install, PC restart.

### 2. Android SDK install (one-time)
https://developer.android.com/studio#command-line-tools-only theke command-line tools download.
`C:\Android\android-sdk` folder khola, zip extract koro.

PowerShell-e (ekbar):
```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Android\android-sdk", "User")
```

### 3. APK build (one-time, 5 minute)
`S:\Finance Tracker\finance-tracker\` folder-e `build-apk.bat` double-click koro.

Eta 4 ta kaj kore:
1. npm install
2. vite build
3. cap sync android
4. gradle assembleDebug

APK pabe: `frontend\android\app\build\outputs\apk\debug\app-debug.apk`

### 4. Phone-e install
APK file phone-e copy koro (USB, Google Drive, email). Phone-e file manager-e tap kore install koro. "Unknown Sources" enable korte hobe.

### 5. App open koro
"Finera" app phone-e pabe. Open korle AI tab default-e open hobe. Tap kore use koro.

---

## Kivabe kaj kore (architecture)

```
Phone-e app khullo
    ↓
React (WebView-er moddhe)
    ↓
Transactions -> IndexedDB (phone-e save)
AI Insights -> Direct Groq API call (aapnar key)
Live rates -> Direct Tavily API call (aapnar key)
    ↓
Laptop off? Kichu hobe na. App cholte thakbe.
```

**Backend folder ta thakbe** (`backend/`) - kintu app ar use korbe na. Reference hisebe rakha, future-e jodi dorkar hoy.

---

## Future-e update korte chaile

Jodi React-e kichu change kore (notun feature, bug fix, color change):

1. `frontend/src/` te code edit koro
2. `build-apk.bat` double-click koro (30 second)
3. Notun APK `frontend\android\app\build\outputs\apk\debug\app-debug.apk` e pabe
4. Phone-e install koro (purano ta replace hobe, **aapnar data intact thakbe** - Android app data preserve kore update-e)

**30 second-e ekta APK toiri hoy (gradle cache thakle), 1 minute-e phone-e install.**

---

## Data kothay save hoy

- **Transactions** -> IndexedDB (`Phone-e Chrome WebView-er internal storage`)
- **API keys (Groq, Tavily)** -> localStorage
- **Currency rate cache** -> localStorage
- **Default currency choice** -> localStorage

**Sob aapnar phone-e. Cloud-e jabe na. PC-te jabe na. Internet upload hobe na.**

Phone format ba factory reset hole data jabe. Tai:
- **Settings -> Data backup -> Export JSON** kore ekta file download koro
- JSON file Google Drive / SD card / PC-te save koro
- Dorkar hole **Import JSON** diye restore koro

---

## API key (Groq + Tavily) kivabe lagabe

App khule **More** tab-e jao (Settings):
1. **Groq API key** field e aapnar `gsk_...` key paste koro
   - Get: https://console.groq.com (free, kono card nei)
2. **Tavily API key** field e aapnar `tvly-...` key paste koro
   - Get: https://tavily.com (free 1000 searches/month, kono card nei)
3. Save chapo

**Key gulo phone-e-i save thakbe (localStorage). Kono backend-e jabe na.**

---

## Features

- 15+ currency, real-time day-to-day rates (Tavily)
- AI insights (Groq Llama 3.3 70B)
- 6-month savings tips
- Pie + bar chart of categories
- Monthly summary
- Dark glass-morphism UI + iOS spring animations
- Haptic feedback
- 100% offline-capable
- Zero backend, zero cloud, zero telemetry
- Data backup/restore (JSON)

---

## Documentation

| File | Ki ase |
|---|---|
| **README.md** (eta) | Overview, quick start |
| **[BANGLA.md](BANGLA.md)** | Bangla guide (v2.0) |
| **[INSTALL.md](INSTALL.md)** | Detailed setup |
| **[APK-BUILD-VSCODE.md](APK-BUILD-VSCODE.md)** | APK build details |

`backend/` folder thakbe but app use korbe na. `BACKEND.md` ar `TAVILY.md` purono - reference hisebe rakhlam.

---

## Tech stack

- React 18 + Vite 5
- framer-motion (animations)
- Capacitor 5 (Android wrapper)
- IndexedDB (data)
- Groq SDK (AI)
- Tavily REST (live rates)
- Java JDK 17 + Gradle + Android SDK (build only)

---

## License

MIT.
