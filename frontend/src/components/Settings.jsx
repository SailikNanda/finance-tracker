import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KeyIcon, SaveIcon, TrashIcon, EyeIcon, EyeOffIcon, CheckIcon, SearchIcon, DownloadIcon, ZapIcon, RefreshIcon } from './Icons'
import { getGroqKey, setGroqKey, hasGroqKey, testConnection as testGroq } from '../utils/groq'
import { getTavilyKey, setTavilyKey, hasTavilyKey, testConnection as testTavily } from '../utils/tavily'
import * as db from '../utils/db'
import { APP_VERSION } from '../utils/version'
import { checkForUpdates, formatSize, getUpdateChecksum, clearUpdateCache } from '../utils/updates'
import { canDownloadInApp, downloadApk, pollDownload, installApk, cancelDownload } from '../utils/apkUpdater'
import { saveBlob } from '../utils/files.js'
import { hasAIConsent, setAIConsent } from '../utils/privacy.js'
import { usesSessionKeys } from '../utils/credentials.js'

function Settings({ currency, currencies, onCurrencyChange, refreshData }) {
  const [consent, setConsent] = useState(hasAIConsent())
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

      <div className="settings-card">
        <h3>AI data sharing</h3>
        <p className="settings-desc">Ledger records stay on this device. When enabled, AI reports send totals and categories to Groq; chat sends your question and up to 100 recent transaction names, dates and amounts. Eligible chat searches send a sanitized question to Tavily. Exchange-rate requests use currency codes only.</p>
        <label><input type="checkbox" checked={consent} onChange={e => { setAIConsent(e.target.checked); setConsent(e.target.checked) }} /> Allow financial data to be sent for AI features</label>
        <p className="settings-desc">{usesSessionKeys() ? 'API keys last for this session only in this browser or on Android 5. Re-enter them after closing the app.' : 'API keys are encrypted on this device using Android Keystore.'}</p>
      </div>
      <DataCard refreshData={refreshData} currency={currency} />

      <UpdateCard />

      <div className="settings-card about-card">
        <div className="about-info">
          <h3>About</h3>
          <p className="about-version">Finera <span>v{APP_VERSION}</span></p>
          <p className="about-tagline">Track income and expenses locally. AI and current exchange rates use internet services.</p>
          <div className="tech-stack">
            <span className="tech-pill">React</span>
            <span className="tech-pill">Capacitor</span>
            <span className="tech-pill">IndexedDB</span>
            <span className="tech-pill">Groq AI</span>
            <span className="tech-pill">Tavily</span>
            <span className="tech-pill">Offline ledger</span>
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setTestResult(null)
    const cleaned = String(val || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').trim()
    if (!cleaned) { setError('Paste your API key first'); return }
    if (cleaned.length < 10) { setError('API key looks too short'); return }
    setSaving(true)
    try {
      await setKey(cleaned)
      setSaved(true)
      setVal('')
      setShowKey(false)
      setTimeout(() => setSaved(false), 2400)
      check()
    } catch { setError('Save failed') }
    finally { setSaving(false) }
  }

  const handleClear = async () => {
    if (!confirm('Remove the saved API key?')) return
    try { await setKey('') }
    catch (e) { setError(e.message || 'Could not remove key'); return }
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
  const [mode, setMode] = useState('merge')
  const inputRef = useRef(null)

  const handleExportPDF = async () => {
    setBusy(true)
    try {
      const { exportTransactionsPDF } = await import('../utils/pdfExport.js')
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

  const handleExportJSON = async () => {
    setBusy(true)
    try {
      const data = await db.exportJSON()
      const name = `Finera-Backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      const saved = await saveBlob(new Blob([data], { type: 'application/json' }), name)
      setMsg({ kind: 'ok', text: saved === 'downloads' ? `${name} saved to Downloads` : 'JSON backup downloaded. Keep it somewhere safe; it contains your ledger.' })
    } catch (e) { setMsg({ kind: 'err', text: e.message || 'Backup failed' }) }
    finally { setBusy(false) }
  }

  const handleImport = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { setMsg({ kind: 'err', text: 'Backup exceeds the 20 MB limit' }); return }
    if (mode === 'replace' && !window.confirm('Replace the entire ledger with this backup? Export your current JSON backup first.')) return
    setBusy(true)
    try {
      const result = await db.importJSON(await file.text(), { mode })
      await refreshData?.()
      setMsg({ kind: 'ok', text: `Restored ${result.imported} transactions; skipped ${result.skipped} duplicates.` })
    } catch (error) { setMsg({ kind: 'err', text: error.message || 'Restore failed. No changes saved.' }) }
    finally { setBusy(false) }
  }

  const handleClear = async () => {
    setBusy(true)
    try {
      const count = await db.countTransactions()
      if (!window.confirm(`Permanently delete all ${count} transactions? Export a JSON backup first. This cannot be undone.`)) return
      await db.clearAll()
      setMsg({ kind: 'ok', text: 'All transactions deleted' })
      await refreshData?.()
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
        JSON backups can restore your ledger on another device. PDF is a readable report. Backups contain financial data; keep them private.
      </p>
      <div className="button-group">
        <motion.button type="button" className="update-btn update-btn--sm" onClick={handleExportJSON} disabled={busy}><DownloadIcon /> <span>Export JSON</span></motion.button>
        <motion.button type="button" className="update-btn update-btn--sm" onClick={() => inputRef.current?.click()} disabled={busy}><span>Import JSON</span></motion.button>
        <motion.button type="button" className="update-btn update-btn--sm" onClick={handleExportPDF} disabled={busy} whileTap={{ scale: 0.95 }}>
          <DownloadIcon /> <span>Export PDF</span>
        </motion.button>

        <motion.button type="button" className="clear-btn" onClick={handleClear} disabled={busy} aria-label="Delete all" whileTap={{ scale: 0.9 }}>
          <TrashIcon />
        </motion.button>

      </div>
      <label className="settings-desc">Restore mode <select aria-label="Restore mode" value={mode} onChange={e => setMode(e.target.value)} disabled={busy}><option value="merge">Merge and skip duplicates</option><option value="replace">Replace entire ledger</option></select></label>
      <input ref={inputRef} type="file" accept="application/json,.json" aria-label="Choose JSON backup" onChange={handleImport} hidden />
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
    else if (result.reason !== 'up-to-date') {
      if (prevInfo?.updateAvailable) {
        setInfo(prevInfo)
        setMsg({ kind: 'err', text: 'Re-check failed, but an update is still available.' })
      } else {
        setStatus('error')
      }
    } else setStatus('uptodate')
  }

  useEffect(() => { check() }, [])

  const controllerRef = useRef(null)
  const downloadIdRef = useRef(null)
  const [checksum, setChecksum] = useState('')
  useEffect(() => () => { controllerRef.current?.abort(); if (downloadIdRef.current != null) cancelDownload(downloadIdRef.current).catch(() => {}) }, [])

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
        setMsg({ kind: 'ok', text: 'Download started in your browser. Open the APK in Downloads when it finishes. Android will verify the app signature before installing.' })
        return
      }
      const hash = await getUpdateChecksum(info)
      setChecksum(hash)
      const controller = new AbortController()
      controllerRef.current = controller
      const { downloadId, filePath: fp } = await downloadApk(info.url)
      downloadIdRef.current = downloadId
      setFilePath(fp)
      await pollDownload(downloadId, (st) => {
        const pct = st.totalSize > 0 ? Math.round((st.bytesDownloaded / st.totalSize) * 100) : null
        setProgress(pct)
      }, 2000, { signal: controller.signal })
      downloadIdRef.current = null
      setDownloading(false)
      setDownloaded(true)
      setMsg({ kind: 'ok', text: 'Download complete. Tap "Update now" to install the new version.' })
    } catch (e) {
      if (downloadIdRef.current != null) await cancelDownload(downloadIdRef.current).catch(() => {})
      downloadIdRef.current = null
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
      await installApk(filePath, checksum)
      clearUpdateCache()
      setMsg({ kind: 'ok', text: 'Installer opened. Tap "Install" to finish the update. The app will restart automatically.' })
    } catch (e) {
      const isPerm = /unknown apps|permission/i.test(e.message || '')
      setMsg({
        kind: 'err',
        text: isPerm
          ? 'Please enable "Allow from this source" in Android Settings and tap "Update now" again.'
          : (e.message || 'Install failed'),
      })
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
          {status === 'available' && !downloading && !downloaded && 'Update available'}
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
            ? `v${info.latestVersion} downloaded. Tap "Update now" to install the update. Your data is kept during the update.`
            : status === 'uptodate'
              ? `You are on the latest version (v${info.currentVersion}). New releases are checked from GitHub automatically.`
              : status === 'error'
                ? (info?.error || `Update check could not confirm the latest APK (${info?.reason || 'network error'}). Please try again.`)
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
                Download
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
          <button className="update-btn update-btn--ghost" onClick={() => controllerRef.current?.abort()}>Cancel download</button>
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
