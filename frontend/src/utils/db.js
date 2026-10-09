import { getRates } from './tavily.js'
import { aggregateTransactions, normalizeCurrency, requireComplete } from './finance.js'

const DB_NAME = 'finera_db'
const DB_VERSION = 3
const STORE = 'transactions'
let dbPromise = null
let revision = 0
export const getRevision = () => revision

function uid() {
  return globalThis.crypto?.randomUUID?.() || `tx-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const database = req.result
      const store = database.objectStoreNames.contains(STORE)
        ? req.transaction.objectStore(STORE)
        : database.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      for (const [name, path] of Object.entries({ month: 'month', year: 'year', type: 'type', category: 'category', monthYear: ['month', 'year'], yearMonth: ['year', 'month'], createdAt: 'createdAt', date: 'date', dateId: ['date', 'id'] })) {
        if (!store.indexNames.contains(name)) store.createIndex(name, path)
      }
      if (!store.indexNames.contains('uuid')) store.createIndex('uuid', 'uuid', { unique: true })
      const cursor = store.openCursor()
      cursor.onsuccess = () => {
        const c = cursor.result
        if (!c) return
        if (!c.value.uuid) c.update({ ...c.value, uuid: uid() })
        c.continue()
      }
    }
    req.onsuccess = () => {
      const database = req.result
      database.onversionchange = () => { database.close(); dbPromise = null }
      resolve(database)
    }
    req.onerror = () => { dbPromise = null; reject(req.error) }
    req.onblocked = () => { dbPromise = null; reject(new Error('Close other Finera tabs and retry to finish the database upgrade.')) }
  })
  return dbPromise
}

function buildRow(data, { strictDate = false } = {}) {
  if (!data || typeof data !== 'object') throw new Error('Invalid transaction')
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  const category = typeof data.category === 'string' ? data.category.trim() : ''
  const amount = Number(data.amount)
  if (!name || name.length > 200) throw new Error('Transaction name must contain 1–200 characters')
  if (!category || category.length > 80) throw new Error('Category must contain 1–80 characters')
  if (!['income', 'expense'].includes(data.type)) throw new Error('Invalid transaction type')
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1e12) throw new Error('Amount must be a finite nonzero value below 1 trillion')
  const date = data.date ?? (strictDate ? null : new Date().toISOString())
  const parts = typeof date === 'string' && date.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/)
  if (!parts) throw new Error('Invalid transaction date')
  const calendar = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])))
  if (calendar.getUTCFullYear() !== Number(parts[1]) || calendar.getUTCMonth() + 1 !== Number(parts[2]) || calendar.getUTCDate() !== Number(parts[3])) throw new Error('Invalid transaction date')
  const d = new Date(date)
  if (!date || !Number.isFinite(d.getTime())) throw new Error('Invalid transaction date')
  const createdAt = data.createdAt ?? d.getTime()
  if (!Number.isFinite(Number(createdAt)) || Number(createdAt) < 0) throw new Error('Invalid creation timestamp')
  const uuid = data.uuid ?? uid()
  if (typeof uuid !== 'string' || !uuid || uuid.length > 200) throw new Error('Invalid transaction identifier')
  return {
    uuid, name, category, type: data.type,
    amount: (data.type === 'income' ? 1 : -1) * Math.abs(amount),
    currency: normalizeCurrency(data.currency || 'INR'), date: d.toISOString(),
    month: data.month ?? d.getMonth() + 1, year: data.year ?? d.getFullYear(), createdAt: Number(createdAt),
  }
}

async function write(operation) {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const txn = database.transaction(STORE, 'readwrite')
    let result
    const fail = () => reject(txn.error || new Error('Database transaction aborted; no changes saved'))
    txn.onerror = fail
    txn.onabort = fail
    txn.oncomplete = () => {
      revision++
      globalThis.dispatchEvent?.(new Event('finera-ledger-change'))
      resolve(result)
    }
    try { operation(txn.objectStore(STORE), value => { result = value }, txn) }
    catch (error) { txn.abort(); reject(error) }
  })
}

export async function addTransaction(data) {
  const row = buildRow(data)
  return write((store, done) => {
    const req = store.add(row)
    req.onsuccess = () => done({ ...row, id: req.result })
  })
}

export async function updateTransaction(id, data) {
  return write((store, done, txn) => {
    const req = store.get(Number(id))
    req.onsuccess = () => {
      if (!req.result) { txn.abort(); return }
      try {
        const old = req.result
        const row = buildRow({ ...old, ...data, uuid: old.uuid, createdAt: old.createdAt, month: undefined, year: undefined })
        const put = store.put({ ...row, id: Number(id) })
        put.onsuccess = () => done({ ...row, id: Number(id) })
      } catch { txn.abort() }
    }
  })
}

async function read(request) {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const txn = database.transaction(STORE, 'readonly')
    const req = request(txn.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    txn.onabort = () => reject(txn.error || new Error('Database read aborted'))
  })
}

export async function getTransactions(month, year) {
  const rows = await read(store => store.index('monthYear').getAll(IDBKeyRange.only([Number(month), Number(year)])))
  return rows.sort((a, b) => b.createdAt - a.createdAt)
}

export const getAllTransactions = () => read(store => store.index('date').getAll()).then(rows => rows.reverse())
export const countTransactions = () => read(store => store.count())
export const deleteTransaction = id => write((store, done) => { store.delete(Number(id)); done(true) })
export const clearAll = () => write((store, done) => { store.clear(); done(true) })

export async function getRecentTransactions(limit = 100) {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const txn = database.transaction(STORE, 'readonly')
    const req = txn.objectStore(STORE).index('date').openCursor(null, 'prev')
    const rows = []
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor || rows.length >= limit) { resolve(rows); return }
      rows.push(cursor.value)
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getTransactionPage(after = null, limit = 250) {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const txn = database.transaction(STORE, 'readonly')
    const req = txn.objectStore(STORE).index('dateId').openCursor(after ? IDBKeyRange.upperBound(after, true) : null, 'prev')
    const rows = []
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor || rows.length >= limit) { resolve(rows); return }
      rows.push(cursor.value)
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

const rateRequests = new Map()
async function ratesFor(rows, currency) {
  if (!rows.some(row => (row.currency || 'INR') !== currency)) return { rates: {}, stale: false }
  if (!rateRequests.has(currency)) {
    const request = getRates(currency).catch(() => ({ rates: {}, unavailable: true })).finally(() => rateRequests.delete(currency))
    rateRequests.set(currency, request)
  }
  return rateRequests.get(currency)
}

export async function valueTransactions(rows, currency = 'INR', rateData = null) {
  currency = normalizeCurrency(currency)
  const data = rateData ?? await ratesFor(rows, currency)
  return { ...aggregateTransactions(rows, currency, data.rates ?? data), rateData: data }
}

export async function getSummary(month, year, currency = 'INR', list = null, rates = null) {
  return (await valueTransactions(list ?? await getTransactions(month, year), currency, rates === null ? null : { rates })).summary
}
export async function getCategories(month, year, currency = 'INR', list = null, rates = null) {
  return (await valueTransactions(list ?? await getTransactions(month, year), currency, rates === null ? null : { rates })).categories
}
export async function getMonthOverview(month, year, currency = 'INR') {
  const transactions = await getTransactions(month, year)
  return { transactions, ...await valueTransactions(transactions, currency) }
}

export async function getMonthlyBuckets(limitMonths = 6, currency = 'INR', month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
  const end = new Date(year, month - 1, 1)
  const start = new Date(year, month - limitMonths, 1)
  const rows = await read(store => store.index('yearMonth').getAll(IDBKeyRange.bound([start.getFullYear(), start.getMonth() + 1], [end.getFullYear(), end.getMonth() + 1])))
  const rates = await ratesFor(rows, currency)
  return Array.from({ length: limitMonths }, (_, index) => {
    const date = new Date(year, month - 1 - index, 1)
    const m = date.getMonth() + 1, y = date.getFullYear()
    const { summary } = aggregateTransactions(rows.filter(row => row.month === m && row.year === y), currency, rates.rates)
    requireComplete(summary)
    return { month: m, year: y, income: summary.total_income, expense: summary.total_expense, currency }
  })
}

export async function exportJSON() {
  return JSON.stringify({ format: 'finera-backup', version: 1, exportedAt: new Date().toISOString(), transactions: await getAllTransactions() }, null, 2)
}

const fingerprint = row => JSON.stringify([row.name, row.amount, row.category, row.type, row.currency, row.date, row.createdAt])
export async function importJSON(text, { mode = 'merge' } = {}) {
  if (!['merge', 'replace'].includes(mode)) throw new Error('Invalid restore mode')
  if (text.length > 20 * 1024 * 1024) throw new Error('Backup is too large (maximum 20 MB)')
  const parsed = JSON.parse(text)
  const legacy = Array.isArray(parsed)
  if (!legacy && (parsed?.format !== 'finera-backup' || parsed?.version !== 1)) throw new Error('Unsupported backup format or version')
  const input = legacy ? parsed : parsed.transactions
  if (!Array.isArray(input) || input.length > 100000) throw new Error('Backup must contain at most 100,000 transactions')
  const rows = input.map((row, index) => {
    try {
      const normalized = buildRow(row, { strictDate: true })
      if (!Number.isInteger(normalized.month) || normalized.month < 1 || normalized.month > 12 || !Number.isInteger(normalized.year) || normalized.year < 1970 || normalized.year > 9999) throw new Error('Invalid month/year')
      if (!legacy && !row.uuid) throw new Error('Missing transaction identifier')
      return normalized
    } catch (error) { throw new Error(`Backup row ${index + 1}: ${error.message}`) }
  })
  const backupIdentifiers = new Map()
  rows.forEach((row, index) => {
    const content = JSON.stringify(row)
    if (backupIdentifiers.has(row.uuid) && backupIdentifiers.get(row.uuid) !== content) throw new Error(`Backup row ${index + 1}: conflicting transaction identifier`)
    backupIdentifiers.set(row.uuid, content)
  })
  return write((store, done) => {
    const req = store.getAll()
    req.onsuccess = () => {
      const existing = mode === 'replace' ? [] : req.result
      const identifiers = new Set(existing.map(row => row.uuid))
      const oldRows = new Map()
      for (const row of existing) oldRows.set(fingerprint(row), (oldRows.get(fingerprint(row)) || 0) + 1)
      if (mode === 'replace') store.clear()
      let imported = 0, skipped = 0
      for (const row of rows) {
        const key = fingerprint(row)
        if (identifiers.has(row.uuid) || (legacy && oldRows.get(key) > 0)) {
          skipped++
          if (legacy) oldRows.set(key, oldRows.get(key) - 1)
          continue
        }
        identifiers.add(row.uuid)
        store.add(row)
        imported++
      }
      done({ imported, skipped, mode })
    }
  })
}
