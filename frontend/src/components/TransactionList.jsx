import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpIcon, ArrowDownIcon, TrashIcon } from './Icons'

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr.replace(' ', 'T'))
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

const rowVariants = {
  hidden: { opacity: 0, x: -20, scale: 0.97 },
  show: (i) => ({
    opacity: 1, x: 0, scale: 1,
    transition: { delay: i * 0.04, type: 'spring', stiffness: 350, damping: 26 },
  }),
  exit: { opacity: 0, x: 30, scale: 0.95, transition: { duration: 0.2 } },
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
}

function TransactionList({ transactions, loading, symbol, currencies, onDelete }) {
  const [pendingId, setPendingId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const getSymbolFor = (code) => {
    const c = (currencies || []).find(x => x.code === code)
    return c ? c.symbol : code || ''
  }

  if (loading) {
    return (
      <div className="loading">
        <motion.div
          className="spinner"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        />
        <span>Loading transactions...</span>
      </div>
    )
  }

  const handleDelete = async (id) => {
    if (!onDelete) return
    setPendingId(id)
    await onDelete(id)
    setPendingId(null)
  }

  const visible = (transactions || [])
    .filter(t => filter === 'all' || t.type === filter)
    .filter(t => !search.trim() || t.name.toLowerCase().includes(search.trim().toLowerCase()) || t.category.toLowerCase().includes(search.trim().toLowerCase()))

  if (!transactions || transactions.length === 0) {
    return (
      <motion.div
        className="transaction-list surface empty-state"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <motion.div
          className="empty-icon"
          animate={{ rotate: [0, -3, 3, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </motion.div>
        <h3>No transactions yet</h3>
        <p>Start by adding your first income or expense.</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="transaction-list surface"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div className="list-head">
        <h2>Transaction History</h2>
        <span className="list-count">{visible.length} item{visible.length === 1 ? '' : 's'}</span>
      </div>

      <div className="list-toolbar">
        <div className="filter-pills" role="tablist">
          {[
            { id: 'all', label: 'All' },
            { id: 'income', label: 'Income' },
            { id: 'expense', label: 'Expense' },
          ].map(f => (
            <motion.button
              key={f.id}
              type="button"
              className={`filter-pill ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            >
              {f.label}
            </motion.button>
          ))}
        </div>
        <div className="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {visible.length === 0 ? (
          <motion.div
            key="empty"
            className="empty-state empty-state--inline"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <h3>No matches</h3>
            <p>Try a different filter or search term.</p>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            className="list-body"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            <AnimatePresence>
              {visible.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  className={`transaction-row ${tx.type}`}
                  custom={i}
                  variants={rowVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  layout
                  whileHover={{ x: 4, scale: 1.01, borderColor: 'rgba(139, 92, 246, 0.4)' }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                >
                  <div className="transaction-icon">
                    {tx.type === 'income' ? <ArrowDownIcon /> : <ArrowUpIcon />}
                  </div>
                  <div className="col-name">
                    <div className="name">{tx.name}</div>
                    <div className="meta">
                      <span className="category-tag">{tx.category}</span>
                      <span className="dot-sep" />
                      <span className="date">{formatDate(tx.date)}</span>
                    </div>
                  </div>
                  <div className="col-amount">
                    <div className={`amount ${tx.type}`}>
                      {tx.type === 'expense' ? '\u2212' : '+'}{getSymbolFor(tx.currency)}{Math.abs(tx.amount).toFixed(2)}
                    </div>
                  </div>
                  {onDelete && (
                    <motion.button
                      type="button"
                      className="delete-btn"
                      aria-label={`Delete ${tx.name}`}
                      onClick={() => handleDelete(tx.id)}
                      disabled={pendingId === tx.id}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    >
                      {pendingId === tx.id ? <span className="mini-spinner" /> : <TrashIcon />}
                    </motion.button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default TransactionList
