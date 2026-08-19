import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpIcon, ArrowDownIcon, SendIcon, CheckIcon } from './Icons'
import { CATEGORY_ICONS } from './CategoryIcons'

const CATEGORIES = {
  expense: [
    { id: 'salary', label: 'Salary', full: 'Salary' },
    { id: 'food', label: 'Food', full: 'Food & Dining' },
    { id: 'transport', label: 'Transport', full: 'Transportation' },
    { id: 'shopping', label: 'Shopping', full: 'Shopping' },
    { id: 'groceries', label: 'Groceries', full: 'Groceries' },
    { id: 'housing', label: 'Housing', full: 'Housing & Rent' },
    { id: 'bills', label: 'Bills', full: 'Bills & Utilities' },
    { id: 'subscriptions', label: 'Subscr.', full: 'Subscriptions' },
    { id: 'entertainment', label: 'Fun', full: 'Entertainment' },
    { id: 'health', label: 'Health', full: 'Health' },
    { id: 'education', label: 'Learn', full: 'Education' },
    { id: 'travel', label: 'Travel', full: 'Travel' },
    { id: 'taxes', label: 'Taxes', full: 'Taxes & Levies' },
    { id: 'personal', label: 'Personal', full: 'Personal Care' },
    { id: 'insurance', label: 'Insurance', full: 'Insurance' },
    { id: 'gifts_don', label: 'Gifts', full: 'Gifts & Donations' },
    { id: 'invest_exp', label: 'Invest', full: 'Investments' },
    { id: 'work_exp', label: 'Work', full: 'Office & Work' },
    { id: 'other_exp', label: 'Other', full: 'Other' },
    { id: 'custom', label: 'Custom...', full: 'Custom' },
  ],
  income: [
    { id: 'salary', label: 'Salary', full: 'Salary' },
    { id: 'freelance', label: 'Freelance', full: 'Freelance' },
    { id: 'business', label: 'Business', full: 'Business' },
    { id: 'investment', label: 'Invest', full: 'Investment' },
    { id: 'gift', label: 'Gift', full: 'Gift' },
    { id: 'rental', label: 'Rent Inc', full: 'Rental Income' },
    { id: 'refunds', label: 'Refunds', full: 'Refunds & Cashback' },
    { id: 'dividends', label: 'Dividends', full: 'Interest & Dividends' },
    { id: 'side_hustle', label: 'Side Job', full: 'Side Hustle' },
    { id: 'sales', label: 'Sales', full: 'Sales' },
    { id: 'grants', label: 'Grants', full: 'Grants & Awards' },
    { id: 'pension', label: 'Pension', full: 'Pension' },
    { id: 'other_inc', label: 'Other', full: 'Other' },
    { id: 'custom', label: 'Custom...', full: 'Custom' },
  ],
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 350, damping: 26 } },
}

const chipVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 8 },
  show: (i) => ({
    opacity: 1, scale: 1, y: 0,
    transition: { delay: i * 0.03, type: 'spring', stiffness: 400, damping: 20 },
  }),
}

function toDateInputValue(d) {
  const dt = d ? new Date(d) : new Date()
  if (Number.isNaN(dt.getTime())) return ''
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toTimeInputValue(d) {
  const dt = d ? new Date(d) : new Date()
  if (Number.isNaN(dt.getTime())) return ''
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

function TransactionForm({ onSubmit, currency, symbol, currencies, initial, onCancelEdit }) {
  const editing = !!initial
  const isIncomeTx = initial ? initial.amount > 0 : false
  const [type, setType] = useState(editing ? (isIncomeTx ? 'income' : 'expense') : 'expense')
  const [name, setName] = useState(initial?.name || '')
  const [amount, setAmount] = useState(initial ? String(Math.abs(initial.amount)) : '')
  const [category, setCategory] = useState(initial?.category || '')
  const [customCategory, setCustomCategory] = useState('')
  const [txCurrency, setTxCurrency] = useState(initial?.currency || currency)
  const [txDate, setTxDate] = useState(toDateInputValue(initial?.date))
  const [txTime, setTxTime] = useState(toTimeInputValue(initial?.date))
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!editing) setTxCurrency(currency)
  }, [currency, editing])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const finalCategory = category === 'Custom' ? customCategory.trim() : category
    if (!name.trim() || !amount || !finalCategory) {
      setError('Please fill all fields')
      return
    }
    const parsed = parseFloat(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a valid amount greater than 0')
      return
    }
    const submittedDate = txDate ? new Date(`${txDate}T${txTime || '12:00'}:00`) : new Date()
    setSubmitting(true)
    const result = await onSubmit({
      id: initial?.id,
      name: name.trim(),
      amount: parsed,
      category: finalCategory,
      type,
      currency: txCurrency,
      date: submittedDate.toISOString(),
    })
    setSubmitting(false)
    if (result) {
      setName('')
      setAmount('')
      setCategory('')
      setCustomCategory('')
      setTxDate('')
      setTxTime(toTimeInputValue())
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2400)
    } else {
      setError('Could not save. Please try again.')
    }
  }

  const getSymbol = (code) => {
    const curr = currencies.find(c => c.code === code)
    return curr ? curr.symbol : code
  }

  const switchType = (next) => {
    setType(next)
    setCategory('')
    setCustomCategory('')
  }

  return (
    <motion.div
      className="transaction-form-container surface"
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      <motion.div
        className="form-hero"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2>{editing ? 'Edit Transaction' : 'Add Transaction'}</h2>
        <p>{type === 'expense' ? 'Track where your money goes' : 'Record incoming funds'}</p>
      </motion.div>

      <motion.div
        className="type-toggle"
        role="tablist"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 350, damping: 25 }}
      >
        <motion.button
          type="button"
          role="tab"
          aria-selected={type === 'expense'}
          className={`type-btn type-btn--expense ${type === 'expense' ? 'active' : ''}`}
          onClick={() => switchType('expense')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
        >
          <ArrowUpIcon />
          <span>Expense</span>
        </motion.button>
        <motion.button
          type="button"
          role="tab"
          aria-selected={type === 'income'}
          className={`type-btn type-btn--income ${type === 'income' ? 'active' : ''}`}
          onClick={() => switchType('income')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
        >
          <ArrowDownIcon />
          <span>Income</span>
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {success && (
          <motion.div
            className="success-message success-message--anim"
            role="status"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <motion.span
              className="success-check-circle"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.1 }}
            >
              <CheckIcon />
            </motion.span>
            <span>{type === 'expense' ? 'Expense' : 'Income'} added successfully!</span>
          </motion.div>
        )}
        {error && (
          <motion.div
            className="error-message"
            role="alert"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.form
        onSubmit={handleSubmit}
        className="transaction-form"
        variants={containerVariants}
        initial="hidden"
        animate="show"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <motion.div className="form-group" variants={itemVariants}>
          <label htmlFor="tx-name">Description</label>
          <motion.input
            id="tx-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'expense' ? 'Biryani, Uber ride, Netflix...' : 'Salary, freelance payout...'}
            required
            maxLength={120}
            whileFocus={{ scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          />
        </motion.div>

        <motion.div className="form-row" variants={itemVariants}>
          <div className="form-group amount-group">
            <label htmlFor="tx-amount">Amount</label>
            <div className="amount-input-wrapper">
              <span className="amount-symbol">{getSymbol(txCurrency)}</span>
              <input
                id="tx-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                required
              />
            </div>
          </div>

          <div className="form-group currency-group">
            <label htmlFor="tx-currency">Currency</label>
            <select
              id="tx-currency"
              value={txCurrency}
              onChange={(e) => setTxCurrency(e.target.value)}
              className="currency-input-select"
            >
              {currencies.map(c => (
                <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
              ))}
            </select>
          </div>
        </motion.div>

        <motion.div className="form-row" variants={itemVariants}>
          <div className="form-group">
            <label htmlFor="tx-date">Date</label>
            <input
              id="tx-date"
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="date-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="tx-time">Time</label>
            <input
              id="tx-time"
              type="time"
              value={txTime}
              onChange={(e) => setTxTime(e.target.value)}
              className="date-input"
            />
          </div>
        </motion.div>

        <motion.div className="form-group" variants={itemVariants}>
          <label>Category</label>
          <motion.div
            className="category-grid"
            key={type}
            initial="hidden"
            animate="show"
          >
            <AnimatePresence mode="wait">
              {CATEGORIES[type].map((cat, i) => {
                const Icon = CATEGORY_ICONS[cat.id]
                const active = category === cat.full
                return (
                  <motion.button
                    type="button"
                    key={cat.id}
                    custom={i}
                    variants={chipVariants}
                    initial="hidden"
                    animate="show"
                    className={`category-chip ${active ? 'active' : ''}`}
                    onClick={() => setCategory(cat.full)}
                    aria-pressed={active}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                  >
                    <span className="category-chip__icon">
                      {Icon && <Icon />}
                    </span>
                    <span className="category-chip__label">{cat.label}</span>
                    <AnimatePresence>
                      {active && (
                        <motion.span
                          className="category-chip__check"
                          aria-hidden="true"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        >
                          <CheckIcon />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {category === 'Custom' && (
            <motion.div
              className="form-group custom-category-group"
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              style={{ overflow: 'hidden' }}
            >
              <label htmlFor="tx-custom-category">Custom Category Name</label>
              <input
                id="tx-custom-category"
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter custom category name..."
                required
                maxLength={40}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          className={`submit-btn submit-btn--${type}`}
          disabled={submitting}
          variants={itemVariants}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          <SendIcon />
          <span>{submitting ? 'Saving...' : (editing ? 'Save Changes' : (type === 'expense' ? 'Add Expense' : 'Add Income'))}</span>
        </motion.button>
        {editing && onCancelEdit && (
          <motion.button
            type="button"
            className="submit-btn submit-btn--cancel"
            onClick={onCancelEdit}
            variants={itemVariants}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          >
            <span>Cancel</span>
          </motion.button>
        )}
      </motion.form>
    </motion.div>
  )
}

export default TransactionForm
