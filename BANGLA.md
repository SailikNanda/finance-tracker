# Finera v2.0 - Bangla Guide (Pure APK)

**Laptop off thakleo cholbe. Data phone-e save hobe. Backend internet-e lagbe na.**

---

## v2.0.0-te ki notun

- **In-app update (GitHub)** — developer notun version release korle user **Settings → App update** theke ek tap-e download + install korbe (data intact)
- **Transaction edit** — History-te pencil icon, date-o change kora jay (agkal-er kharcho add kora jay)
- **Fast AI** — Groq **Qwen 3.6 27B** (na cholle automatic Llama 3.3 70B)
- **Backup date fix** — import korle original date thake
- **Optimization** — code splitting, fast load, IndexedDB index

---

## v2.0-te ki notun (purono v1.3.0 theke)

| Purono (v1.3.0) | Notun (v2.0.0) |
|---|---|
| Python backend (FastAPI) cholto | ❌ Muchey geche (runtime-e ar dorkar nei) |
| SQLite (PC-te) | IndexedDB (phone-e) |
| Backend Groq call korto | Phone-e Chrome direct Groq-ke call kore |
| Backend Tavily call korto | Phone-e Chrome direct Tavily-ke call kore |
| Backend cloud-e upload lagto | ❌ Dorkar nei - backend-i nei |
| OTA update (5 second-e phone-e) | ❌ Anejay - ekhon APK rebuild korte hobe (30 sec) |
| Web + APK duitai cholto | Pure APK (Capacitor) shudhu |

---

## Quick start (5 minute-e first APK)

### Step 1: Java JDK 17 install (one-time)
1. https://adoptium.net e jao
2. "Windows x64 .msi" download koro
3. Default settings-e install koro
4. PC restart koro

### Step 2: Android SDK install (one-time)
1. https://developer.android.com/studio#command-line-tools-only e jao
2. Zip download koro
3. `C:\Android\android-sdk` folder khola, zip extract koro
4. PowerShell-e ekbar:
```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Android\android-sdk", "User")
```

### Step 3: APK build
`S:\Finance Tracker\finance-tracker\` folder-e `build-apk.bat` file-ta double-click koro.

Eta automatic 4 ta kaj kore:
1. JS dependencies install
2. React production build
3. Android-e sync
4. APK build (gradle)

Shesh-e APK pabe:
`frontend\android\app\build\outputs\apk\debug\app-debug.apk`

### Step 4: Phone-e install
- APK file phone-e transfer koro (USB cable, Google Drive, email - je kono vabe)
- Phone-e File Manager-e jao, sei APK file ta tap koro
- "Install" tap koro
- "Unknown Sources" allow korte hobe prothom bar
- App install hoye jabe

### Step 5: App open koro
"Finera" app pabe phone-e. Tap kore open koro. AI tab default-e open hobe (aapni je request korechilen).

---

## Kivabe kaj kore (architecture)

```
Phone-e app khullo
    ↓
React (Capacitor WebView-e cholche)
    ↓
├─ Transactions → IndexedDB (phone-e save)
├─ AI Insights → Direct Groq API call (aapnar key)
└─ Live rates  → Direct Tavily API call (aapnar key)
    ↓
Laptop off? Kichu hobe na. App cholte thakbe.
```

**`backend/` folder ta thakbe** (kintu runtime-e app ar use korbe na) - reference hisebe, future-e jodi dorkar hoy.

---

## Future-e code change kore update dite chaile

Jodi React-e kichu change kore (notun feature, bug fix, color):

1. `frontend/src/` folder-e code edit koro
2. `build-apk.bat` double-click koro (30 second)
3. Notun APK toiri hobe
4. Phone-e sei APK file install koro (purano ta replace hobe, **data intact thakbe** - Android update-e app data preserve kore)

**30 second-e notun APK, 1 minute-e phone-e install.**

---

## Update push kora (GitHub release)

User-ra app-er **Settings → App update** theke automatic update pabe. Notun version release korar niyom:

1. `frontend\.env` e `VITE_APP_VERSION` update koro (e.g. `2.0.1`)
2. `build-apk.bat` run koro
3. `release-apk.bat` run koro — commit + push + tag + GitHub Release + APK attach sob automatic
4. User-er phone-e "v2.0.1 ready" dekhabe, tap korlei download + install

**Dorkar:** `gh` CLI (https://cli.github.com) + `gh auth login` ekbar. Repo: `SailikNanda/finance-tracker`.

---

## Data kothay save hoy (important!)

- **Transactions** → IndexedDB (phone-e Chrome WebView-er internal storage)
- **API keys (Groq, Tavily)** → localStorage (phone-e)
- **Currency rate cache** → localStorage (phone-e)
- **Default currency choice** → localStorage (phone-e)

**Aapnar data:**
- ❌ Cloud-e jabe na
- ❌ PC-te jabe na
- ❌ Internet-e upload hobe na
- ✅ Shudhu aapnar phone-e thakbe

**Phone format ba factory reset hole data jabe.** Tai:
- **Settings → Data backup → Export JSON** kore ekta file download koro
- JSON file Google Drive / SD card / PC-te save koro
- Dorkar hole **Import JSON** diye restore koro

---

## API key (Groq + Tavily) kivabe lagabe

App khule **More** tab-e jao (Settings):

1. **Groq API key** field-e aapnar `gsk_...` key paste koro
   - Get: https://console.groq.com (free, kono card nei)
2. **Tavily API key** field-e aapnar `tvly-...` key paste koro
   - Get: https://tavily.com (free 1000 searches/month, kono card nei)
3. **Save** chapo

**Key gulo phone-e-i save thakbe (localStorage). Kono backend-e jabe na, kono internet upload hobe na.**

---

## Features (sab kichu phone-e local)

- 15+ currency, real-time day-to-day rates (Tavily)
- AI insights (Groq Llama 3.3 70B)
- 6-month savings tips
- Pie + bar chart of categories
- Monthly summary
- Dark glass-morphism UI + iOS spring animations
- Haptic feedback
- 100% offline-capable (Groq/Tavily call chara)
- Zero backend, zero cloud, zero telemetry
- Data backup/restore (JSON export-import)
- IndexedDB storage (fast, reliable)

---

## Folder structure

```
finance-tracker/
├── frontend/                    # React + Vite (main app)
│   ├── src/
│   │   ├── App.jsx              # main app
│   │   ├── components/          # Dashboard, AIInsights, Settings, etc.
│   │   ├── utils/
│   │   │   ├── db.js            # IndexedDB wrapper
│   │   │   ├── groq.js          # direct Groq client
│   │   │   └── tavily.js        # direct Tavily client
│   │   └── styles/              # CSS
│   ├── android/                 # Capacitor Android (auto-generated)
│   ├── dist/                    # build output
│   └── package.json
│
├── backend/                     # Python (reference - runtime-e use hoy na)
│   └── ...
│
├── build-apk.bat                # ★ one-click APK build
├── README.md                    # English
├── BANGLA.md                    # Bangla (eta)
├── INSTALL.md                   # detailed setup
├── APK-BUILD-VSCODE.md          # APK build details
└── package.json
```

---

## Tech stack

- **Frontend:** React 18 + Vite 5 + framer-motion
- **Storage:** IndexedDB (phone-e local)
- **AI:** Groq Llama 3.3 70B (direct call from phone)
- **Currency:** Tavily Search (direct call from phone)
- **Mobile:** Capacitor 5 (Android wrapper)
- **Build:** Java JDK 17 + Gradle + Android SDK (PC-te, one-time install)

---

## License

MIT - free for personal and commercial use.
