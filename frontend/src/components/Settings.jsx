import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KeyIcon, SaveIcon, TrashIcon, EyeIcon, EyeOffIcon, CheckIcon, SearchIcon, DownloadIcon, UploadIcon, ZapIcon, RefreshIcon } from './Icons'
import { getGroqKey, setGroqKey, hasGroqKey, testConnection as testGroq } from '../utils/groq'
import { getTavilyKey, setTavilyKey, hasTavilyKey, testConnection as testTavily } from '../utils/tavily'
import * as db from '../utils/db'
import { APP_VERSION } from '../utils/version'
import { checkForUpdates, formatSize, getCurrentVersion, clearUpdateCache } from '../utils/updates'
import { canDownloadInApp, downloadApk, pollDownload, installApk } from '../utils/apkUpdater'
import { exportTransactionsPDF } from '../utils/pdfExport'

function Settings({ currency, currencies, onCurrencyChange, refreshData }) {
  return (
    <div className="settings surface">
      <div className="settings-head">
        <h2>Settings</h2>
        <p>Personalize your experience</p>
      </div>

      <div className="settings-card">
        <div className="settings-header">
          <h3>
            <span className="settings-icon settings-icon--globe">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </span>
            Default currency
          </h3>
        </div>
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="settings-currency-select"
        >
          {currencies.map(c => (
            <option key={c.code} value={c.code}>{c.symbol} {c.code} &mdash; {c.name}</option>
          ))}
        </select>
      </div>

      <ApiKeyCard
        title="Groq API key"
        description="Powers the AI insights and savings tips. Get a free key at console.groq.com."
        helpUrl="https://console.groq.com"
        helpSteps={[
          'Open console.groq.com',
          'Sign in or create an account',
          'Click API Keys in the sidebar',
          'Create a new key, copy it, paste here',
        ]}
        icon={<KeyIcon />}
        iconClass="settings-icon--key"
        getKey={getGroqKey}
        setKey={setGroqKey}
        hasKey={hasGroqKey}
        tester={testGroq}
        storageKey="groq"
        placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxx"
      />

      <ApiKeyCard
        title="Tavily API key"
        description="Powers real-time day-to-day currency rates via live web search. Get a free key at tavily.com (1000 free searches/month, no credit card)."
        helpUrl="https://tavily.com"
        helpSteps={[
          'Open tavily.com and click "Get Started"',
          'Sign up with email (no credit card needed)',
          'Open the dashboard and copy your API key',
          'Paste it here and tap Save',
        ]}
        icon={<SearchIcon />}
        iconClass="settings-icon--search"
        getKey={getTavilyKey}
        setKey={setTavilyKey}
        hasKey={hasTavilyKey}
        tester={testTavily}
        storageKey="tavily"
        placeholder="tvly-xxxxxxxxxxxxxxxxxxxxxxxx"
      />

      <DataCard refreshData={refreshData} currency={currency} />

      <UpdateCard />

      <div className="settings-card about-card">
        <div className="about-info">
          <h3>About</h3>
          <p className="about-version">Finera <span>v{APP_VERSION}</span></p>
          <p className="about-tagline">Track income and expenses with AI-powered insights and real-time rates. Data stays on your phone.</p>
          <div className="tech-stack">
            <span className="tech-pill">React</span>
            <span className="tech-pill">Capacitor</span>
            <span className="tech-pill">IndexedDB</span>
            <span className="tech-pill">Groq AI</span>
            <span className="tech-pill">Tavily</span>
            <span className="tech-pill">100% Offline</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function maskKey(k) {
  if (!k) return ''
  if (k.length <= 10) return k.slice(0, 2) + '****' + k.slice(-2)
  return k.slice(0, 4) + '*'.repeat(Math.min(20, k.length - 8)) + k.slice(-4)
}

function ApiKeyCard({ title, description, helpUrl, helpSteps, icon, iconClass, getKey, setKey, hasKey, tester, storageKey, placeholder }) {
  const [val, setVal] = useState('')
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState('checking')
  const [showKey, setShowKey] = useState(false)
  const [masked, setMasked] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => { check() }, [])

  const check = () => {
    const k = getKey()
    if (k) {
      setStatus('active')
      setMasked(maskKey(k))
    } else {
      setStatus('missing')
      setMasked('')
    }
    setTestResult(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setTestResult(null)
    const cleaned = String(val || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').trim()
    if (!cleaned) { setError('Paste your API key first'); return }
    if (cleaned.length < 10) { setError('API key looks too short'); return }
    setSaving(true)
    try {
      setKey(cleaned)
      setSaved(true)
      setVal('')
      setShowKey(false)
      setTimeout(() => setSaved(false), 2400)
      check()
    } catch { setError('Save failed') }
    finally { setSaving(false) }
  }

  const handleClear = () => {
    if (!confirm('Remove the saved API key?')) return
    setKey('')
    setVal('')
    setMasked('')
    setStatus('missing')
    setTestResult(null)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await tester()
      setTestResult(r)
    } catch (e) {
      setTestResult({ ok: false, message: e.message || 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="settings-card">
      <div className="settings-header">
        <h3>
          <span className={`settings-icon ${iconClass}`}>{icon}</span>
          {title}
        </h3>
        <span className={`status-badge ${status}`}>
          {status === 'active' && 'Active'}
          {status === 'missing' && 'Not set'}
          {status === 'checking' && 'Checking'}
        </span>
      </div>

      <p className="settings-desc">{description}</p>

      {status === 'active' && masked && (
        <div className="key-preview">
          <span className="key-preview-label">Current</span>
          <code className="key-preview-code">{masked}</code>
        </div>
      )}

      <AnimatePresence>
        {saved && (
          <motion.div
            className="success-message"
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <CheckIcon /> API key saved
          </motion.div>
        )}
        {error && (
          <motion.div
            className="error-message"
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.div>
        )}
        {testResult && (
          <motion.div
            className={testResult.ok ? 'success-message' : 'error-message'}
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {testResult.ok ? <CheckIcon /> : null} {testResult.message}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="api-form">
        <div className="form-group">
          <label htmlFor={`apikey-${storageKey}`}>{status === 'active' ? 'Replace with a new key' : 'API key'}</label>
          <div className="key-input-wrapper">
            <input
              id={`apikey-${storageKey}`}
              type={showKey ? 'text' : 'password'}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            <button
              type="button"
              className="toggle-visibility"
              onClick={() => setShowKey(s => !s)}
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <div className="button-group">
          <motion.button type="submit" className="save-btn" disabled={saving || !val} whileTap={{ scale: 0.96 }}>
            <SaveIcon />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </motion.button>
          {status === 'active' && (
            <motion.button
              type="button"
              className="test-btn"
              onClick={handleTest}
              disabled={testing}
              whileTap={{ scale: 0.96 }}
            >
              <ZapIcon />
              <span>{testing ? 'Testing...' : 'Test'}</span>
            </motion.button>
          )}
          {status === 'active' && (
            <motion.button type="button" className="clear-btn" onClick={handleClear} aria-label="Remove API key" whileTap={{ scale: 0.9 }}>
              <TrashIcon />
            </motion.button>
          )}
        </div>
      </form>

      <div className="api-info">
        <h4>How to get your key</h4>
        <ol>
          {helpSteps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </div>
    </div>
  )
}

function DataCard({ refreshData, currency }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)

  const handleExport = async () => {
    setBusy(true)
    try {
      const json = await db.exportJSON()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `finera-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMsg({ kind: 'ok', text: 'Backup downloaded' })
    } catch (e) { setMsg({ kind: 'err', text: e.message }) }
    finally { setBusy(false); setTimeout(() => setMsg(null), 3000) }
  }

  const handleExportPDF = async () => {
    setBusy(true)
    try {
      const res = await exportTransactionsPDF(currency)
      setMsg({
        kind: 'ok',
        text: res.saved === 'downloads'
          ? `${res.fileName} saved to Downloads`
          : `PDF downloaded (${res.count} transactions)`,
      })
    } catch (e) { setMsg({ kind: 'err', text: e.message || 'PDF export failed' }) }
    finally { setBusy(false); setTimeout(() => setMsg(null), 4000) }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const text = await file.text()
      const n = await db.importJSON(text)
      setMsg({ kind: 'ok', text: `Imported ${n} transactions` })
      if (refreshData) refreshData()
    } catch (err) { setMsg({ kind: 'err', text: err.message || 'Import failed' }) }
    finally {
      setBusy(false)
      e.target.value = ''
      setTimeout(() => setMsg(null), 3000)
    }
  }

  const handleClear = async () => {
    if (!confirm('Delete ALL transactions? This cannot be undone.')) return
    setBusy(true)
    try {
      await db.clearAll()
      setMsg({ kind: 'ok', text: 'All transactions deleted' })
      if (refreshData) refreshData()
    } catch (e) { setMsg({ kind: 'err', text: e.message }) }
    finally { setBusy(false); setTimeout(() => setMsg(null), 3000) }
  }

  return (
    <div className="settings-card">
      <div className="settings-header">
        <h3>
          <span className="settings-icon settings-icon--data">
            <DownloadIcon />
          </span>
          Data backup
        </h3>
      </div>
      <p className="settings-desc">
        Export a PDF report (date, time, amount — like a spreadsheet) or a JSON backup file you can restore later.
      </p>
      <div className="button-group">
        <motion.button type="button" className="update-btn update-btn--sm" onClick={handleExportPDF} disabled={busy} whileTap={{ scale: 0.95 }}>
          <DownloadIcon /> <span>Export PDF</span>
        </motion.button>
        <motion.button type="button" className="save-btn" onClick={handleExport} disabled={busy} whileTap={{ scale: 0.96 }}>
          <DownloadIcon /> <span>Export JSON</span>
        </motion.button>
        <motion.button type="button" className="save-btn" onClick={() => fileRef.current?.click()} disabled={busy} whileTap={{ scale: 0.96 }}>
          <UploadIcon /> <span>Import JSON</span>
        </motion.button>
        <motion.button type="button" className="clear-btn" onClick={handleClear} disabled={busy} aria-label="Delete all" whileTap={{ scale: 0.9 }}>
          <TrashIcon />
        </motion.button>
        <input ref={fileRef} type="file" accept="application/json" onChange={handleImport} style={{ display: 'none' }} />
      </div>
      <AnimatePresence>
        {msg && (
          <motion.div
            key={msg.text}
            className={msg.kind === 'ok' ? 'success-message' : 'error-message'}
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function UpdateCard() {
  const [status, setStatus] = useState('checking')
  const [checking, setChecking] = useState(false)
  const [info, setInfo] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [progress, setProgress] = useState(null)
  const [filePath, setFilePath] = useState('')
  const [installing, setInstalling] = useState(false)
  const [msg, setMsg] = useState(null)

  const check = async (force = false) => {
    if (checking) return
    setChecking(true)
    const prevInfo = info
    if (!prevInfo) setStatus('checking')
    const result = await checkForUpdates({ force })
    setInfo(result)
    setChecking(false)
    if (result.updateAvailable) setStatus('available')
    else if (result.reason === 'error') {
      if (prevInfo?.updateAvailable) {
        setMsg({ kind: 'err', text: 'Re-check failed, but an update is still available.' })
      } else {
        setStatus('error')
      }
    } else setStatus('uptodate')
  }

  useEffect(() => { check() }, [])

  const handleDownload = async () => {
    if (!info || !info.url || downloading) return
    setDownloading(true)
    setProgress(0)
    setMsg(null)
    try {
      if (!canDownloadInApp()) {
        const a = document.createElement('a')
        a.href = info.url
        a.download = `finera-${info.latestVersion}.apk`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setDownloading(false)
        setDownloaded(true)
        setMsg({ kind: 'ok', text: 'Download started in your browser. Once it finishes in your Downloads folder, tap "Update now" to install it.' })
        return
      }
      const { downloadId, filePath: fp } = await downloadApk(info.url)
      setFilePath(fp)
      await pollDownload(downloadId, (st) => {
        const pct = st.totalSize > 0 ? Math.round((st.bytesDownloaded / st.totalSize) * 100) : null
        setProgress(pct)
      })
      setDownloading(false)
      setDownloaded(true)
      setMsg({ kind: 'ok', text: 'Download complete. Tap "Update now" to install the new version.' })
    } catch (e) {
      setDownloading(false)
      setMsg({ kind: 'err', text: e.message || 'Download failed' })
    }
  }

  const handleInstall = async () => {
    if (!filePath || installing) return
    if (!canDownloadInApp()) {
      setMsg({ kind: 'ok', text: 'Open the downloaded APK from your Downloads folder to install it.' })
      return
    }
    setInstalling(true)
    setMsg(null)
    try {
      await installApk(filePath)
      clearUpdateCache()
      setMsg({ kind: 'ok', text: 'Installer opened. Tap "Install" to finish the update. The app will restart automatically.' })
    } catch (e) {
      setMsg({ kind: 'err', text: e.message || 'Install failed' })
    } finally {
      setInstalling(false)
    }
  }

  const badgeClass = status === 'available' ? 'active' : status === 'error' ? 'missing' : 'checking'

  return (
    <div className="settings-card">
      <div className="settings-header">
        <h3>
          <span className="settings-icon settings-icon--data">
            <DownloadIcon />
          </span>
          App update
        </h3>
        <span className={`status-badge ${badgeClass}`}>
          {status === 'available' && !downloading && !downloaded && `v${info.latestVersion} ready`}
          {status === 'available' && downloading && 'Downloading'}
          {status === 'available' && downloaded && 'Downloaded'}
          {status === 'uptodate' && 'Up to date'}
          {status === 'checking' && 'Checking'}
          {status === 'error' && 'Check failed'}
        </span>
      </div>

      <p className="settings-desc">
        {status === 'available' && !downloading && !downloaded
          ? `A new version (v${info.latestVersion}) is available. You are on v${info.currentVersion}. Tap below to download it. Your data is kept during the update.`
          : status === 'available' && downloaded
            ? `v${info.latestVersion} downloaded. Tap "Update now" below to install it. Your data is kept during the update.`
            : status === 'uptodate'
              ? `You are on the latest version (v${info.currentVersion}). New releases are checked from GitHub automatically.`
              : status === 'error'
                ? 'Could not reach GitHub right now. Check your internet connection and try again.'
                : 'Checking for updates...'}
      </p>

      <AnimatePresence>
        {status === 'available' && !downloaded && !downloading && !installing && (
          <motion.div
            className="button-group button-group--column"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <motion.button
              type="button"
              className="update-btn"
              onClick={handleDownload}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="update-btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>
                Update now
                {info?.size ? `  \u00B7 ${formatSize(info.size)}` : ''}
              </span>
            </motion.button>
            <motion.button type="button" className="update-btn update-btn--ghost" onClick={() => check(true)} disabled={checking} whileTap={{ scale: 0.96 }}>
              <RefreshIcon />
              <span>{checking ? 'Checking...' : 'Check again'}</span>
            </motion.button>
          </motion.div>
        )}

        {status === 'available' && downloaded && !downloading && !installing && (
          <motion.div
            className="button-group button-group--column"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <motion.button
              type="button"
              className="update-btn"
              onClick={handleInstall}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="update-btn__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>Update now</span>
            </motion.button>
            <motion.button type="button" className="update-btn update-btn--ghost" onClick={() => check(true)} disabled={checking} whileTap={{ scale: 0.96 }}>
              <RefreshIcon />
              <span>{checking ? 'Checking...' : 'Check again'}</span>
            </motion.button>
          </motion.div>
        )}

        {status !== 'available' && status !== 'checking' && (
          <motion.button
            type="button"
            className="update-btn update-btn--ghost"
            onClick={() => check(true)}
            disabled={checking}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.96 }}
          >
            <RefreshIcon />
            <span>{checking ? 'Checking...' : 'Check for updates'}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {downloading && (
        <div className="update-progress">
          <div className="progress-track">
            <motion.div
              className="progress-fill"
              animate={{ width: progress != null ? `${progress}%` : '40%' }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <span className="update-progress-label">
            {progress != null ? `Downloading... ${progress}%` : 'Downloading...'}
          </span>
        </div>
      )}

      <AnimatePresence>
        {msg && (
          <motion.div
            key={msg.text}
            className={msg.kind === 'ok' ? 'success-message' : 'error-message'}
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Settings
