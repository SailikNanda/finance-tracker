import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KeyIcon, SaveIcon, TrashIcon, EyeIcon, EyeOffIcon, CheckIcon, SearchIcon, DownloadIcon, UploadIcon, ZapIcon } from './Icons'
import { getGroqKey, setGroqKey, hasGroqKey, testConnection as testGroq } from '../utils/groq'
import { getTavilyKey, setTavilyKey, hasTavilyKey, testConnection as testTavily } from '../utils/tavily'
import * as db from '../utils/db'

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

      <DataCard refreshData={refreshData} />

      <div className="settings-card about-card">
        <div className="about-info">
          <h3>About</h3>
          <p className="about-version">Finera <span>v1.3.0</span></p>
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

function DataCard({ refreshData }) {
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
        Your data lives on this phone only. Export a backup file you can save anywhere, or import one to restore.
      </p>
      <div className="button-group">
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

export default Settings
