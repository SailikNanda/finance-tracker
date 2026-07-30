import { getRates } from './tavily'
// IndexedDB wrapper - all transaction data lives on the phone.
// No backend. No cloud. No upload. Pure local.

const DB_NAME = 'finera_db'
const DB_VERSION = 1
const STORE = 'transactions'

let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        os.createIndex('month', 'month', { unique: false })
        os.createIndex('year', 'year', { unique: false })
        os.createIndex('type', 'type', { unique: false })
        os.createIndex('category', 'category', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

function tx(mode) {
  return openDB().then(db => {
    const t = db.transaction(STORE, mode)
    return t.objectStore(STORE)
  })
}

export async function addTransaction({ name, amount, category, type, currency }) {
  const os = await tx('readwrite')
  const now = new Date()
  const row = {
    name: String(name || '').trim(),
    amount: type === 'income' ? Number(amount) : -Number(amount),
    category: String(category || '').trim(),
    type,
    currency: currency || 'INR',
    date: now.toISOString(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    createdAt: now.getTime(),
  }
  return new Promise((resolve, reject) => {
    const req = os.add(row)
    req.onsuccess = () => resolve({ ...row, id: req.result })
    req.onerror = () => reject(req.error)
  })
}

export async function getTransactions(month, year) {
  const os = await tx('readonly')
  return new Promise((resolve, reject) => {
    const req = os.getAll()
    req.onsuccess = () => {
      const all = req.result || []
      const filtered = all.filter(r =>
        r.month === Number(month) && r.year === Number(year)
      ).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      resolve(filtered)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteTransaction(id) {
  const os = await tx('readwrite')
  return new Promise((resolve, reject) => {
    const req = os.delete(Number(id))
    req.onsuccess = () => resolve(true)
    req.onerror = () => reject(req.error)
  })
}

export async function getAllTransactions() {
  const os = await tx('readonly')
  return new Promise((resolve, reject) => {
    const req = os.getAll()
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    req.onerror = () => reject(req.error)
  })
}

export async function getSummary(month, year, targetCurrency = 'INR') {
  const list = await getTransactions(month, year)
  let income = 0, expense = 0

  let rates = {}
  try {
    const rateData = await getRates(targetCurrency)
    rates = rateData.rates || {}
  } catch (e) {
    console.warn(`Failed to fetch rates for summary in ${targetCurrency}:`, e)
  }

  for (const r of list) {
    let amountInTarget = Math.abs(r.amount)
    const txCurrency = r.currency || 'INR'

    if (txCurrency !== targetCurrency) {
      const rateToTx = rates[txCurrency]
      if (rateToTx && rateToTx > 0) {
        amountInTarget = amountInTarget / rateToTx
      }
    }

    if (r.amount > 0) {
      income += amountInTarget
    } else {
      expense += amountInTarget
    }
  }

  const balance = income - expense
  const savingsRate = income > 0 ? (balance / income) * 100 : 0
  return {
    total_income: income,
    total_expense: expense,
    balance,
    savings_rate: savingsRate,
    transaction_count: list.length,
  }
}

export async function getCategories(month, year, targetCurrency = 'INR') {
  const list = await getTransactions(month, year)

  let rates = {}
  try {
    const rateData = await getRates(targetCurrency)
    rates = rateData.rates || {}
  } catch (e) {
    console.warn(`Failed to fetch rates for categories in ${targetCurrency}:`, e)
  }

  const map = new Map()
  for (const r of list) {
    if (r.amount < 0) {
      let amountInTarget = Math.abs(r.amount)
      const txCurrency = r.currency || 'INR'

      if (txCurrency !== targetCurrency) {
        const rateToTx = rates[txCurrency]
        if (rateToTx && rateToTx > 0) {
          amountInTarget = amountInTarget / rateToTx
        }
      }

      map.set(r.category, (map.get(r.category) || 0) + amountInTarget)
    }
  }
  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

export async function exportJSON() {
  const all = await getAllTransactions()
  return JSON.stringify(all, null, 2)
}

export async function importJSON(jsonText) {
  const arr = JSON.parse(jsonText)
  if (!Array.isArray(arr)) throw new Error('Invalid JSON')
  let imported = 0
  for (const r of arr) {
    try {
      const { id, ...rest } = r
      if (rest.createdAt) rest.createdAt = rest.createdAt
      await addTransaction(rest)
      imported++
    } catch (e) {
      console.warn('Failed to import row:', e)
    }
  }
  return imported
}

export async function clearAll() {
  const os = await tx('readwrite')
  return new Promise((resolve, reject) => {
    const req = os.clear()
    req.onsuccess = () => resolve(true)
    req.onerror = () => reject(req.error)
  })
}
