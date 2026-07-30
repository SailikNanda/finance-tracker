import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { SwapIcon, RefreshIcon } from './Icons'
import { getRates, convert as convertCurrency, hasTavilyKey } from '../utils/tavily'

function formatTimeAgo(iso) {
  if (!iso) return 'unknown'
  try {
    const date = new Date(iso)
    if (isNaN(date.getTime())) return iso
    const diffMs = Date.now() - date.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    const days = Math.floor(hours / 24)
    return `${days} day${days > 1 ? 's' : ''} ago`
  } catch { return 'unknown' }
}

function CurrencyConverter({ currencies }) {
  const [amount, setAmount] = useState('100')
  const [fromCurrency, setFromCurrency] = useState('INR')
  const [toCurrency, setToCurrency] = useState('USD')
  const [ratesData, setRatesData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [provider, setProvider] = useState(null)
  const [hasKey, setHasKey] = useState(hasTavilyKey())
  const abortRef = useRef(false)

  const fetchRates = useCallback(async (base, force = false) => {
    abortRef.current = false
    setLoading(true)
    setError(null)
    try {
      const data = await getRates(base, { force })
      if (abortRef.current) return
      setRatesData(data.rates || {})
      setUpdatedAt(data.updated_at || null)
      setProvider(data.provider || 'unknown')
      setHasKey(true)
    } catch (e) {
      if (abortRef.current) return
      setError(e.message || 'Failed to load rates')
      setRatesData(null)
      if (/No Tavily API key/i.test(e.message || '')) setHasKey(false)
    } finally {
      if (!abortRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRates(fromCurrency)
    return () => {
      abortRef.current = true
    }
  }, [fromCurrency, fetchRates])

  const rate = useMemo(() => {
    if (!ratesData) return 0
    if (fromCurrency === toCurrency) return 1
    return ratesData[toCurrency] || 0
  }, [ratesData, fromCurrency, toCurrency])

  const result = useMemo(() => (parseFloat(amount) || 0) * rate, [amount, rate])

  const swapCurrencies = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  const getSymbol = (code) => {
    const curr = currencies.find(c => c.code === code)
    return curr ? curr.symbol : code
  }

  const popular = useMemo(
    () => currencies.filter(c => c.code !== fromCurrency).slice(0, 8),
    [currencies, fromCurrency]
  )

  return (
    <div className="converter-container surface">
      <div className="converter-head">
        <h2>Currency Converter</h2>
        <div className="converter-head__meta">
          {loading && <span className="converter-tag converter-tag--loading">Loading...</span>}
          {!loading && !error && ratesData && (
            <span className="converter-tag">
              {provider === 'tavily' ? 'Live' : 'Offline'} rates &middot; {formatTimeAgo(updatedAt)}
              {provider ? ' \u2022 ' + provider : ''}
            </span>
          )}
          <button className="refresh-btn--icon" onClick={() => fetchRates(fromCurrency, true)} disabled={loading} aria-label="Refresh rates">
            <RefreshIcon />
          </button>
        </div>
      </div>

      {error && (
        <div className="converter-error">
          {hasKey
            ? `Could not load live rates: ${error}`
            : 'Add a Tavily API key in Settings to get real-time day-to-day rates.'}
        </div>
      )}

      <div className="converter-card">
        <div className="converter-input-group">
          <label>You send</label>
          <div className="converter-input-wrapper">
            <span className="converter-symbol">{getSymbol(fromCurrency)}</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="0"
              inputMode="decimal"
            />
          </div>
          <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} className="converter-select">
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.code} &mdash; {c.name}</option>
            ))}
          </select>
        </div>

        <button className="swap-btn" onClick={swapCurrencies} aria-label="Swap currencies">
          <SwapIcon />
        </button>

        <div className="converter-input-group">
          <label>You get</label>
          <div className="converter-input-wrapper result">
            <span className="converter-symbol">{getSymbol(toCurrency)}</span>
            <input type="text" value={rate ? result.toFixed(2) : '0.00'} readOnly />
          </div>
          <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} className="converter-select">
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.code} &mdash; {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rate-info">
        <div className="rate-card">
          <span className="rate-label">Exchange rate</span>
          <span className="rate-value">
            {rate ? `1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}` : 'N/A'}
          </span>
        </div>
        <div className="rate-card">
          <span className="rate-label">Inverse</span>
          <span className="rate-value">
            {rate ? `1 ${toCurrency} = ${(1 / rate).toFixed(4)} ${fromCurrency}` : 'N/A'}
          </span>
        </div>
      </div>

      <div className="quick-convert">
        <h3>Quick convert</h3>
        <div className="quick-grid">
          {['1', '10', '100', '1000', '10000', '100000'].map(val => (
            <button
              key={val}
              className={`quick-btn ${amount === val ? 'active' : ''}`}
              onClick={() => setAmount(val)}
            >
              {getSymbol(fromCurrency)}{val}
            </button>
          ))}
        </div>
      </div>

      <div className="popular-rates">
        <h3>Popular rates (per 1 {fromCurrency})</h3>
        <div className="rates-list">
          {popular.map(c => {
            const r = ratesData ? ratesData[c.code] : 0
            return (
              <div key={c.code} className="rate-item">
                <span className="rate-currency">{c.code}</span>
                <span className="rate-name">{c.name}</span>
                <span className="rate-number">
                  {c.symbol} {r ? r.toFixed(4) : '\u2014'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CurrencyConverter
