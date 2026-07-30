import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUpIcon, WalletIcon, TargetIcon, PieChartIcon, BarChartIcon, RefreshIcon } from './Icons'
import { getRates } from '../utils/tavily'

const COLORS = ['#34d399', '#f87171', '#60a5fa', '#a78bfa', '#fbbf24', '#f472b6', '#22d3ee', '#c084fc']

const GRADIENTS = [
  'url(#g0)', 'url(#g1)', 'url(#g2)', 'url(#g3)',
  'url(#g4)', 'url(#g5)', 'url(#g6)', 'url(#g7)',
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 350, damping: 26 },
  },
}

const StatCard = ({ type, icon, label, value, glowClass, savingsRate }) => (
  <motion.div
    className={`stat-card stat-card--${type}`}
    variants={itemVariants}
    whileHover={{ y: -4, scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
  >
    <div className="stat-icon">{icon}</div>
    <div className="stat-body">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${value.startsWith('-') || type === 'expense' ? 'negative' : type === 'income' || type === 'balance' ? 'positive' : ''}`}>
        {value}
      </span>
    </div>
    <div className={`stat-glow ${glowClass}`} />
    {type === 'savings' && (
      <motion.div
        className="stat-ring"
        style={{ '--p': `${Math.max(0, Math.min(100, savingsRate))}` }}
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
      />
    )}
  </motion.div>
)

function Dashboard({ summary, categories, loading, currency, currencies, onCurrencyChange, symbol }) {
  if (loading) {
    return (
      <div className="loading">
        <motion.div
          className="spinner"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        />
        <span>Loading...</span>
      </div>
    )
  }

  const stats = summary || { total_income: 0, total_expense: 0, balance: 0, savings_rate: 0, transaction_count: 0 }
  const chartData = categories.map(c => ({ name: c.category, value: c.total }))
  const totalExpenseForPct = chartData.reduce((s, c) => s + c.value, 0) || 1

  return (
    <motion.div
      className="dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.section
        className="currency-selector surface"
        variants={itemVariants}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
      >
        <label htmlFor="dash-currency">Display currency</label>
        <div className="currency-select-wrap">
          <select
            id="dash-currency"
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="currency-select"
          >
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
            ))}
          </select>
        </div>
      </motion.section>

      <LiveRateBar currency={currency} currencies={currencies} />

      <motion.section
        className="stats-grid"
        variants={containerVariants}
      >
        <StatCard
          type="income"
          icon={<TrendingUpIcon />}
          label="Income"
          value={`${symbol}${stats.total_income.toFixed(2)}`}
          glowClass="stat-glow--green"
        />
        <StatCard
          type="expense"
          icon={<TrendingUpIcon style={{ transform: 'rotate(180deg)' }} />}
          label="Expenses"
          value={`${symbol}${stats.total_expense.toFixed(2)}`}
          glowClass="stat-glow--red"
        />
        <StatCard
          type="balance"
          icon={<WalletIcon />}
          label="Balance"
          value={`${stats.balance < 0 ? '-' : ''}${symbol}${Math.abs(stats.balance).toFixed(2)}`}
          glowClass="stat-glow--blue"
        />
        <StatCard
          type="savings"
          icon={<TargetIcon />}
          label="Savings rate"
          value={`${stats.savings_rate.toFixed(1)}%`}
          glowClass="stat-glow--purple"
          savingsRate={stats.savings_rate}
        />
      </motion.section>

      <motion.section
        className="charts-section"
        variants={containerVariants}
      >
        <motion.div
          className="chart-card surface"
          variants={itemVariants}
          whileHover={{ y: -2 }}
        >
          <div className="chart-head">
            <h3><PieChartIcon /> Expense breakdown</h3>
            {chartData.length > 0 && <span className="chart-meta">{chartData.length} categories</span>}
          </div>
          {chartData.length > 0 ? (
            <>
              <div style={{ width: '100%', height: 220 }}>
                <svg width="100%" height="100%" viewBox="0 0 220 220">
                  <defs>
                    {COLORS.map((c, i) => (
                      <linearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity="0.95" />
                        <stop offset="100%" stopColor={c} stopOpacity="0.55" />
                      </linearGradient>
                    ))}
                  </defs>
                  {(() => {
                    let acc = 0
                    const r = 80
                    const cx = 110, cy = 110
                    const circumference = 2 * Math.PI * r
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="22" />
                        {chartData.map((d, i) => {
                          const frac = d.value / totalExpenseForPct
                          const len = circumference * frac
                          const offset = -acc
                          acc += len
                          return (
                            <motion.circle
                              key={i}
                              cx={cx}
                              cy={cy}
                              r={r}
                              fill="none"
                              stroke={GRADIENTS[i % GRADIENTS.length]}
                              strokeWidth="22"
                              strokeDasharray={`${len} ${circumference - len}`}
                              strokeDashoffset={offset}
                              transform={`rotate(-90 ${cx} ${cy})`}
                              strokeLinecap="butt"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              transition={{ delay: 0.3 + i * 0.08, duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                            />
                          )
                        })}
                        <motion.text
                          x="110" y="105" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="11" fontWeight="500" letterSpacing="0.5"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                        >TOTAL</motion.text>
                        <motion.text
                          x="110" y="128" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.7, type: 'spring', stiffness: 300 }}
                        >{symbol}{stats.total_expense.toFixed(0)}</motion.text>
                      </g>
                    )
                  })()}
                </svg>
              </div>
              <ul className="legend">
                <AnimatePresence>
                  {chartData.slice(0, 6).map((c, i) => {
                    const pct = ((c.value / totalExpenseForPct) * 100).toFixed(1)
                    return (
                      <motion.li
                        key={c.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.05, type: 'spring', stiffness: 350, damping: 25 }}
                        whileHover={{ x: 4, scale: 1.02 }}
                      >
                        <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="legend-name">{c.name}</span>
                        <span className="legend-val">{pct}%</span>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            </>
          ) : (
            <div className="no-data">No expense data yet for this month</div>
          )}
        </motion.div>

        <motion.div
          className="chart-card surface"
          variants={itemVariants}
          whileHover={{ y: -2 }}
        >
          <div className="chart-head">
            <h3><BarChartIcon /> Category comparison</h3>
            {chartData.length > 0 && <span className="chart-meta">top {Math.min(chartData.length, 8)}</span>}
          </div>
          {chartData.length > 0 ? (
            <div className="bar-list">
              {chartData.slice(0, 6).map((c, i) => {
                const pct = (c.value / chartData[0].value) * 100
                return (
                  <motion.div
                    key={c.name}
                    className="bar-row"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.07, type: 'spring', stiffness: 350, damping: 25 }}
                  >
                    <div className="bar-label">
                      <span>{c.name}</span>
                      <span className="bar-val">{symbol}{c.value.toFixed(0)}</span>
                    </div>
                    <div className="bar-track">
                      <motion.div
                        className="bar-fill"
                        style={{
                          background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`,
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.5 + i * 0.07, duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="no-data">No data to compare</div>
          )}
        </motion.div>
      </motion.section>

      <motion.section
        className="transactions-count surface"
        variants={itemVariants}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
      >
        <motion.span
          className="dot-indicator"
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        {stats.transaction_count} transaction{stats.transaction_count === 1 ? '' : 's'} this month
      </motion.section>
    </motion.div>
  )
}

function LiveRateBar({ currency, currencies }) {
  const [rates, setRates] = useState(null)
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [provider, setProvider] = useState(null)

  const fetchRates = async (force = false) => {
    setLoading(true)
    try {
      const data = await getRates('USD', { force })
      setRates(data.rates || {})
      setUpdatedAt(data.updated_at || null)
      setProvider(data.provider || 'unknown')
    } catch {
      setRates(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRates(false) }, [])

  const getSymbol = (code) => {
    const c = currencies.find(x => x.code === code)
    return c ? c.symbol : code
  }

  const inr = rates ? rates.INR : null
  const eur = rates ? rates.EUR : null
  const gbp = rates ? rates.GBP : null
  const toUser = rates ? rates[currency] : null

  const isFallback = provider === 'fallback' || provider === 'db-cache'

  return (
    <motion.section
      className="live-rate-bar surface"
      variants={itemVariants}
      whileHover={{ y: -2 }}
    >
      <div className="live-rate-bar__head">
        <span className="live-rate-bar__dot" />
        <span className="live-rate-bar__title">
          {isFallback ? 'Offline' : 'Live'} rates &middot; 1 USD
        </span>
        <button
          className="live-rate-bar__refresh"
          onClick={() => fetchRates(true)}
          disabled={loading}
          aria-label="Refresh rates"
        >
          <RefreshIcon />
        </button>
      </div>
      <div className="live-rate-bar__grid">
        <RateCell code="INR" value={inr} symbol={getSymbol('INR')} highlight={currency === 'INR'} />
        <RateCell code="EUR" value={eur} symbol={getSymbol('EUR')} highlight={currency === 'EUR'} />
        <RateCell code="GBP" value={gbp} symbol={getSymbol('GBP')} highlight={currency === 'GBP'} />
        {currency !== 'INR' && currency !== 'EUR' && currency !== 'GBP' && (
          <RateCell code={currency} value={toUser} symbol={getSymbol(currency)} highlight />
        )}
      </div>
      {updatedAt && !isFallback && (
        <div className="live-rate-bar__foot">Updated {new Date(updatedAt).toLocaleString()}</div>
      )}
    </motion.section>
  )
}

function RateCell({ code, value, symbol, highlight }) {
  return (
    <motion.div
      className={`rate-cell ${highlight ? 'rate-cell--highlight' : ''}`}
      whileTap={{ scale: 0.97 }}
    >
      <span className="rate-cell__code">{code}</span>
      <span className="rate-cell__value">
        {value != null ? `${symbol}${value.toFixed(2)}` : '—'}
      </span>
    </motion.div>
  )
}

export default Dashboard
