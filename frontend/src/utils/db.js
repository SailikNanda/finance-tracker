import { getRates } from './tavily'
// IndexedDB wrapper - all transaction data lives on the phone.
// No backend. No cloud. No upload. Pure local.

const DB_NAME = 'finera_db'
const DB_VERSION = 2
const STORE = 'transactions'

let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = req.result
      const oldVersion = e.oldVersion || 0
      if (oldVersion < 1) {
        const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        os.createIndex('month', 'month', { unique: false })
        os.createIndex('year', 'year', { unique: false })
        os.createIndex('type', 'type', { unique: false })
        os.createIndex('category', 'category', { unique: false })
        os.createIndex('monthYear', ['month', 'year'], { unique: false })
      } else if (oldVersion < 2) {
        const os = req.transaction.objectStore(STORE)
        if (!os.indexNames.contains('monthYear')) {
          os.createIndex('monthYear', ['month', 'year'], { unique: false })
        }
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
    return { store: t.objectStore(STORE), txn: t }
  })
}

function parseDateField(date, fallbackCreatedAt) {
  if (date) {
    const d = new Date(date)
    if (!Number.isNaN(d.getTime())) return d
  }
  const now = new Date()
  if (fallbackCreatedAt) now.setTime(Number(fallbackCreatedAt) || now.getTime())
  return now
}

function buildRow({ name, amount, category, type, currency, date, createdAt }) {
  const d = parseDateField(date, createdAt)
  return {
    name: String(name || '').trim(),
    amount: type === 'income' ? Number(amount) : -Number(amount),
    category: String(category || '').trim(),
    type,
    currency: currency || 'INR',
    date: d.toISOString(),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
    createdAt: Number(createdAt) || d.getTime(),
  }
}

export async function addTransaction(data) {
  const { store, txn } = await tx('readwrite')
  const row = buildRow(data)
  return new Promise((resolve, reject) => {
    const req = store.add(row)
    req.onsuccess = () => resolve({ ...row, id: req.result })
    req.onerror = () => reject(req.error)
  })
}

export async function updateTransaction(id, data) {
  const { store } = await tx('readwrite')
  return new Promise((resolve, reject) => {
    const getReq = store.get(Number(id))
    getReq.onerror = () => reject(getReq.error)
    getReq.onsuccess = () => {
      const existing = getReq.result
      if (!existing) { reject(new Error('Transaction not found')); return }
      const merged = data.date
        ? { ...existing, ...buildRow(data), id: Number(id) }
        : { ...existing, ...buildRow({ ...data, date: existing.date, createdAt: existing.createdAt }), id: Number(id) }
      const putReq = store.put(merged)
      putReq.onsuccess = () => resolve(merged)
      putReq.onerror = () => reject(putReq.error)
    }
  })
}

export async function getTransactions(month, year) {
  const { store } = await tx('readonly')
  month = Number(month); year = Number(year)
  return new Promise((resolve, reject) => {
    let req
    const idx = store.index('monthYear')
    try {
      req = idx.getAll(IDBKeyRange.bound([month, year], [month, year]))
    } catch (e) {
      req = store.getAll()
    }
    req.onsuccess = () => {
      const all = req.result || []
      if (req.source.indexName === 'monthYear') {
        all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      } else {
        const filtered = all.filter(r => r.month === month && r.year === year)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        resolve(filtered)
        return
      }
      resolve(all)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteTransaction(id) {
  const { store } = await tx('readwrite')
  return new Promise((resolve, reject) => {
    const req = store.delete(Number(id))
    req.onsuccess = () => resolve(true)
    req.onerror = () => reject(req.error)
  })
}

export async function getAllTransactions() {
  const { store } = await tx('readonly')
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    req.onerror = () => reject(req.error)
  })
}

// Share one in-flight rates request between concurrent calls (getSummary + getCategories).
const inflightRates = {}
function getRatesShared(targetCurrency) {
  if (!inflightRates[targetCurrency]) {
    inflightRates[targetCurrency] = getRates(targetCurrency)
      .catch(err => { delete inflightRates[targetCurrency]; throw err })
    inflightRates[targetCurrency].finally(() => {
      if (inflightRates[targetCurrency]) delete inflightRates[targetCurrency]
    })
  }
  return inflightRates[targetCurrency]
}

async function loadRates(targetCurrency) {
  try {
    const data = await getRatesShared(targetCurrency)
    return data.rates || {}
  } catch (e) {
    console.warn(`Failed to fetch rates for ${targetCurrency}:`, e)
    return {}
  }
}

function toTargetAmount(amount, txCurrency, targetCurrency, rates) {
  let amountInTarget = Math.abs(amount)
  if (txCurrency !== targetCurrency) {
    const rateToTx = rates[txCurrency]
    if (rateToTx && rateToTx > 0) {
      amountInTarget = amountInTarget / rateToTx
    }
  }
  return amountInTarget
}

export async function getSummary(month, year, targetCurrency = 'INR') {
  const list = await getTransactions(month, year)
  const rates = await loadRates(targetCurrency)

  let income = 0, expense = 0
  for (const r of list) {
    const amountInTarget = toTargetAmount(r.amount, r.currency || 'INR', targetCurrency, rates)
    if (r.amount > 0) income += amountInTarget
    else expense += amountInTarget
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
  const rates = await loadRates(targetCurrency)

  const map = new Map()
  for (const r of list) {
    if (r.amount < 0) {
      const amountInTarget = toTargetAmount(r.amount, r.currency || 'INR', targetCurrency, rates)
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
      await addTransaction(rest)
      imported++
    } catch (e) {
      console.warn('Failed to import row:', e)
    }
  }
  return imported
}

export async function clearAll() {
  const { store } = await tx('readwrite')
  return new Promise((resolve, reject) => {
    const req = store.clear()
    req.onsuccess = () => resolve(true)
    req.onerror = () => reject(req.error)
  })
}
