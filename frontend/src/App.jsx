import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Dashboard from './components/Dashboard'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import AIInsights from './components/AIInsights'
import MonthSelector from './components/MonthSelector'
import Settings from './components/Settings'
import CurrencyConverter from './components/CurrencyConverter'
import { HapticProvider } from './components/HapticFeedback'
import { DashboardIcon, PlusIcon, ListIcon, AIIcon, SettingsIcon, BanknoteIcon } from './components/Icons'
import * as db from './utils/db'

export const CURRENCIES = [
  { code: 'INR', symbol: '\u20B9', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '\u20AC', name: 'Euro' },
  { code: 'GBP', symbol: '\u00A3', name: 'British Pound' },
  { code: 'JPY', symbol: '\u00A5', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: '\u062F.\u0625', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '\uFDFC', name: 'Saudi Riyal' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '\u0E3F', name: 'Thai Baht' },
  { code: 'KRW', symbol: '\u20A9', name: 'South Korean Won' },
  { code: 'CNY', symbol: '\u00A5', name: 'Chinese Yuan' },
  { code: 'NGN', symbol: '\u20A6', name: 'Nigerian Naira' },
]

const CURRENCY_STORAGE_KEY = 'ft_currency'

const TABS = [
  { id: 'dashboard', label: 'Home', Icon: DashboardIcon },
  { id: 'add', label: 'Add', Icon: PlusIcon },
  { id: 'history', label: 'History', Icon: ListIcon },
  { id: 'converter', label: 'Convert', Icon: BanknoteIcon },
  { id: 'ai', label: 'AI', Icon: AIIcon },
  { id: 'settings', label: 'More', Icon: SettingsIcon },
]

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState(null)
  const [categories, setCategories] = useState([])
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [currency, setCurrencyState] = useState(() => {
    try { return localStorage.getItem(CURRENCY_STORAGE_KEY) || 'INR' } catch { return 'INR' }
  })

  const getCurrencySymbol = useCallback(() => {
    const curr = CURRENCIES.find(c => c.code === currency)
    return curr ? curr.symbol : '\u20B9'
  }, [currency])

  const updateCurrency = useCallback((code) => {
    setCurrencyState(code)
    try { localStorage.setItem(CURRENCY_STORAGE_KEY, code) } catch {}
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [t, s, c] = await Promise.all([
        db.getTransactions(currentMonth, currentYear),
        db.getSummary(currentMonth, currentYear, currency),
        db.getCategories(currentMonth, currentYear, currency),
      ])
      setTransactions(t)
      setSummary(s)
      setCategories(c)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [currentMonth, currentYear, currency])

  useEffect(() => { fetchData() }, [fetchData])

  const addTransaction = useCallback(async (data) => {
    try {
      await db.addTransaction({ currency, ...data })
      await fetchData()
      return true
    } catch (err) {
      console.error('Add failed:', err)
      return false
    }
  }, [fetchData, currency])

  const deleteTransaction = useCallback(async (id) => {
    try {
      await db.deleteTransaction(id)
      await fetchData()
      return true
    } catch (err) {
      console.error('Delete failed:', err)
      return false
    }
  }, [fetchData])

  const symbol = getCurrencySymbol()

  return (
    <HapticProvider>
      <AppContent
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        symbol={symbol}
        summary={summary}
        categories={categories}
        loading={loading}
        currency={currency}
        updateCurrency={updateCurrency}
        transactions={transactions}
        addTransaction={addTransaction}
        deleteTransaction={deleteTransaction}
        currentMonth={currentMonth}
        currentYear={currentYear}
        setCurrentMonth={setCurrentMonth}
        setCurrentYear={setCurrentYear}
        refreshData={fetchData}
      />
    </HapticProvider>
  )
}

function TabPanel({ isActive, children }) {
  const [hasBeenActive, setHasBeenActive] = useState(false)

  useEffect(() => {
    if (isActive) setHasBeenActive(true)
  }, [isActive])

  return (
    <div
      className={`tab-panel ${isActive ? 'active' : ''}`}
    >
      {hasBeenActive ? children : null}
    </div>
  )
}

function TabButton({ id, label, Icon, isActive, onClick }) {
  return (
    <button
      className={`tab-btn ${isActive ? 'active' : ''}`}
      onClick={() => onClick(id)}
      aria-current={isActive ? 'page' : undefined}
      style={{ position: 'relative' }}
    >
      <div className="active-tab-bar" />
      <div className="active-tab-glow" />
      <span className="tab-btn__icon">
        <Icon />
      </span>
      <span className="tab-btn__label">{label}</span>
    </button>
  )
}

function AppContent({
  activeTab, setActiveTab, symbol, summary, categories,
  loading, currency, updateCurrency, transactions, addTransaction,
  deleteTransaction, currentMonth, currentYear, setCurrentMonth, setCurrentYear, refreshData
}) {
  return (
    <div className="app">
      <div className="app-bg" aria-hidden="true">
        <div className="app-bg__grid" />
        <div className="app-bg__noise" />
        <div className="app-bg__blob app-bg__blob--1" />
        <div className="app-bg__blob app-bg__blob--2" />
        <div className="app-bg__blob app-bg__blob--3" />
      </div>

      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="logo-text">
            <h1>Finera</h1>
            <span>smart money tracker</span>
          </div>
        </div>
        <MonthSelector
          month={currentMonth}
          year={currentYear}
          onChange={(m, y) => { setCurrentMonth(m); setCurrentYear(y) }}
        />
      </header>

      <div className="main-content-wrapper" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', position: 'relative', overflow: 'hidden' }}>
        <TabPanel isActive={activeTab === 'dashboard'}>
          <Dashboard
            summary={summary}
            categories={categories}
            loading={loading}
            currency={currency}
            currencies={CURRENCIES}
            onCurrencyChange={updateCurrency}
            symbol={symbol}
          />
        </TabPanel>
        <TabPanel isActive={activeTab === 'add'}>
          <TransactionForm
            onSubmit={addTransaction}
            currency={currency}
            symbol={symbol}
            currencies={CURRENCIES}
          />
        </TabPanel>
        <TabPanel isActive={activeTab === 'history'}>
          <TransactionList
            transactions={transactions}
            loading={loading}
            symbol={symbol}
            currencies={CURRENCIES}
            onDelete={deleteTransaction}
          />
        </TabPanel>
        <TabPanel isActive={activeTab === 'ai'}>
          <AIInsights month={currentMonth} year={currentYear} symbol={symbol} />
        </TabPanel>
        <TabPanel isActive={activeTab === 'converter'}>
          <CurrencyConverter currencies={CURRENCIES} />
        </TabPanel>
        <TabPanel isActive={activeTab === 'settings'}>
          <Settings currency={currency} currencies={CURRENCIES} onCurrencyChange={updateCurrency} refreshData={refreshData} />
        </TabPanel>
      </div>

      <nav className="tab-nav" aria-label="Primary">
        {TABS.map(({ id, label, Icon }) => (
          <TabButton
            key={id}
            id={id}
            label={label}
            Icon={Icon}
            isActive={activeTab === id}
            onClick={setActiveTab}
          />
        ))}
      </nav>
    </div>
  )
}

export default App
