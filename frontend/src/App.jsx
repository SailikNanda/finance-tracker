import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react'
import { motion } from 'framer-motion'
import { HapticProvider } from './components/HapticFeedback'
import { DashboardIcon, PlusIcon, ListIcon, AIIcon, SettingsIcon, BanknoteIcon } from './components/Icons'
import { APP_VERSION } from './utils/version'
import * as db from './utils/db'

const Dashboard = lazy(() => import('./components/Dashboard'))
const TransactionForm = lazy(() => import('./components/TransactionForm'))
const TransactionList = lazy(() => import('./components/TransactionList'))
const AIInsights = lazy(() => import('./components/AIInsights'))
const Settings = lazy(() => import('./components/Settings'))
const CurrencyConverter = lazy(() => import('./components/CurrencyConverter'))
const MonthSelector = lazy(() => import('./components/MonthSelector'))

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
  const [data, setData] = useState({ transactions: [], summary: null, categories: [] })
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
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
      setData({ transactions: t, summary: s, categories: c })
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [currentMonth, currentYear, currency])

  useEffect(() => { fetchData() }, [fetchData])

  const startEdit = useCallback((tx) => {
    setEditingTx(tx)
    setActiveTab('add')
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingTx(null)
  }, [])

  const addTransaction = useCallback(async (data) => {
    try {
      if (data.id) {
        await db.updateTransaction(data.id, data)
        setEditingTx(null)
      } else {
        await db.addTransaction({ currency, ...data })
      }
      await fetchData()
      return true
    } catch (err) {
      console.error('Save failed:', err)
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
        summary={data.summary}
        categories={data.categories}
        loading={loading}
        currency={currency}
        updateCurrency={updateCurrency}
        transactions={data.transactions}
        addTransaction={addTransaction}
        deleteTransaction={deleteTransaction}
        startEdit={startEdit}
        cancelEdit={cancelEdit}
        editingTx={editingTx}
        currentMonth={currentMonth}
        currentYear={currentYear}
        setCurrentMonth={setCurrentMonth}
        setCurrentYear={setCurrentYear}
        refreshData={fetchData}
      />
    </HapticProvider>
  )
}

const TabPanel = React.memo(function TabPanel({ isActive, children }) {
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
})

const TabButton = React.memo(function TabButton({ id, label, Icon, isActive, onClick }) {
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
})

function TabFallback() {
  return (
    <div className="loading">
      <div className="spinner" />
      <span>Loading...</span>
    </div>
  )
}

function AppContent({
  activeTab, setActiveTab, symbol, summary, categories,
  loading, currency, updateCurrency, transactions, addTransaction,
  deleteTransaction, startEdit, cancelEdit, editingTx,
  currentMonth, currentYear, setCurrentMonth, setCurrentYear, refreshData
}) {
  const openTab = useCallback((id) => {
    if (id === 'add' && !editingTx) cancelEdit()
    setActiveTab(id)
  }, [editingTx, cancelEdit, setActiveTab])

  const handleMonthChange = useCallback((m, y) => {
    setCurrentMonth(m)
    setCurrentYear(y)
  }, [setCurrentMonth, setCurrentYear])

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
        <Suspense fallback={null}>
          <MonthSelector
            month={currentMonth}
            year={currentYear}
            onChange={handleMonthChange}
          />
        </Suspense>
      </header>

      <div className="main-content-wrapper" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', position: 'relative', overflow: 'hidden' }}>
        <TabPanel isActive={activeTab === 'dashboard'}>
          <Suspense fallback={<TabFallback />}>
            <Dashboard
              summary={summary}
              categories={categories}
              loading={loading}
              currency={currency}
              currencies={CURRENCIES}
              onCurrencyChange={updateCurrency}
              symbol={symbol}
            />
          </Suspense>
        </TabPanel>
        <TabPanel isActive={activeTab === 'add'}>
          <Suspense fallback={<TabFallback />}>
            <TransactionForm
              key={editingTx ? editingTx.id : 'new'}
              onSubmit={addTransaction}
              currency={currency}
              symbol={symbol}
              currencies={CURRENCIES}
              initial={editingTx}
              onCancelEdit={cancelEdit}
            />
          </Suspense>
        </TabPanel>
        <TabPanel isActive={activeTab === 'history'}>
          <Suspense fallback={<TabFallback />}>
            <TransactionList
              transactions={transactions}
              loading={loading}
              symbol={symbol}
              currencies={CURRENCIES}
              onDelete={deleteTransaction}
              onEdit={startEdit}
            />
          </Suspense>
        </TabPanel>
        <TabPanel isActive={activeTab === 'ai'}>
          <Suspense fallback={<TabFallback />}>
            <AIInsights month={currentMonth} year={currentYear} symbol={symbol} />
          </Suspense>
        </TabPanel>
        <TabPanel isActive={activeTab === 'converter'}>
          <Suspense fallback={<TabFallback />}>
            <CurrencyConverter currencies={CURRENCIES} />
          </Suspense>
        </TabPanel>
        <TabPanel isActive={activeTab === 'settings'}>
          <Suspense fallback={<TabFallback />}>
            <Settings currency={currency} currencies={CURRENCIES} onCurrencyChange={updateCurrency} refreshData={refreshData} />
          </Suspense>
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
            onClick={openTab}
          />
        ))}
      </nav>
    </div>
  )
}

export default App