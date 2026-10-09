import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { aggregateTransactions, requireComplete } from '../src/utils/finance.js'

const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key) }
globalThis.fetch = async () => { throw new Error('Tests must not use a live provider') }
const legacyRow = { name: 'Old expense', amount: -500, type: 'expense', category: 'Food', currency: 'INR', date: '2026-10-08T10:00:00.000Z', month: 10, year: 2026, createdAt: 1791453600000 }
await new Promise((resolve, reject) => {
  const request = indexedDB.open('finera_db', 2)
  request.onupgradeneeded = () => {
    const store = request.result.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true })
    store.createIndex('monthYear', ['month', 'year'])
  }
  request.onerror = () => reject(request.error)
  request.onsuccess = () => {
    const database = request.result
    const txn = database.transaction('transactions', 'readwrite')
    txn.objectStore('transactions').add(legacyRow)
    txn.oncomplete = () => { database.close(); resolve() }
  }
})
const db = await import('../src/utils/db.js')
const migrated = await db.getAllTransactions()
const transaction = (overrides = {}) => ({ name: 'Salary', amount: 100, type: 'income', category: 'Salary', currency: 'INR', date: '2026-10-08T10:00:00.000Z', ...overrides })
beforeEach(async () => { await db.clearAll(); memory.clear() })

test('v2 migration preserves ledger fields and adds stable identifiers', () => {
  assert.equal(migrated.length, 1)
  assert.equal(migrated[0].amount, -500)
  assert.equal(migrated[0].date, legacyRow.date)
  assert.ok(migrated[0].uuid)
})
test('backup round trip preserves expense sign, date, currency and uuid', async () => {
  const original = await db.addTransaction(transaction({ amount: 500, type: 'expense', category: 'Food' }))
  const backup = await db.exportJSON()
  await db.clearAll()
  assert.equal((await db.importJSON(backup)).imported, 1)
  const [restored] = await db.getAllTransactions()
  for (const field of ['amount', 'date', 'currency', 'uuid', 'type', 'month', 'year']) assert.equal(restored[field], original[field])
  assert.equal((await db.getSummary(10, 2026)).total_expense, 500)
})
test('restoring twice skips duplicates but preserves identical legitimate new transactions', async () => {
  await db.addTransaction(transaction()); await db.addTransaction(transaction())
  const backup = await db.exportJSON()
  await db.clearAll()
  assert.equal((await db.importJSON(backup)).imported, 2)
  assert.equal((await db.importJSON(backup)).skipped, 2)
  assert.equal(await db.countTransactions(), 2)
})
test('legacy array backups restore signed expenses and repeated restores do not duplicate', async () => {
  const backup = JSON.stringify([{ ...legacyRow, id: 7 }])
  await db.importJSON(backup); await db.importJSON(backup)
  assert.equal(await db.countTransactions(), 1)
  assert.equal((await db.getAllTransactions())[0].amount, -500)
})
test('invalid replacement validates the entire file before deleting any record', async () => {
  await db.addTransaction(transaction())
  const backup = JSON.stringify([{ ...legacyRow }, transaction({ name: ' ', amount: 'Infinity' })])
  await assert.rejects(db.importJSON(backup, { mode: 'replace' }), /Backup row 2/)
  assert.equal(await db.countTransactions(), 1)
})
test('invalid dates, currencies and nonfinite direct writes are rejected', async () => {
  for (const invalid of [{ date: 'broken' }, { date: '2026-02-30T10:00:00Z' }, { name: {} }, { currency: 'FAKE' }, { amount: NaN }, { amount: Infinity }, { category: ' ' }]) await assert.rejects(db.addTransaction(transaction(invalid)))
  assert.equal(await db.countTransactions(), 0)
})
test('conflicting backup identifiers are rejected before replacement', async () => {
  await db.addTransaction(transaction())
  const records = [transaction({ uuid: 'duplicate', amount: 100 }), transaction({ uuid: 'duplicate', amount: 200 })]
  await assert.rejects(db.importJSON(JSON.stringify({ format: 'finera-backup', version: 1, transactions: records }), { mode: 'replace' }), /conflicting transaction identifier/)
  assert.equal(await db.countTransactions(), 1)
})
test('mixed currency totals agree and unavailable rates never become 1:1', () => {
  const rows = [transaction({ amount: 1000 }), transaction({ amount: 100, currency: 'USD' })]
  assert.equal(aggregateTransactions(rows, 'INR', { USD: 1 / 80 }).summary.total_income, 9000)
  const missing = aggregateTransactions(rows, 'INR', {}).summary
  assert.equal(missing.total_income, null)
  assert.equal(missing.complete, false)
  assert.throws(() => requireComplete(missing), /USD/)
})
test('same-currency ledger does not fetch rates', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('offline') }
  await db.addTransaction(transaction())
  const summary = await db.getSummary(10, 2026)
  assert.equal(summary.total_income, 100)
  assert.equal(calls, 0)
})
test('six-month totals include every one of 2200 transactions', async () => {
  const records = Array.from({ length: 2200 }, (_, index) => ({ ...legacyRow, uuid: `fixture-${index}`, date: index < 5 ? `2026-0${5 + index}-08T10:00:00Z` : legacyRow.date, month: index < 5 ? 5 + index : 10, amount: -1 }))
  await db.importJSON(JSON.stringify({ format: 'finera-backup', version: 1, transactions: records }))
  const buckets = await db.getMonthlyBuckets(6, 'INR', 10, 2026)
  assert.equal(buckets.find(row => row.month === 10).expense, 2195)
  assert.equal(buckets.reduce((total, row) => total + row.expense, 0), 2200)
})
test('bounded export pagination never drops records sharing the same date', async () => {
  for (let index = 0; index < 120; index++) await db.addTransaction(transaction())
  const ids = new Set()
  let after = null
  while (true) {
    const rows = await db.getTransactionPage(after, 17)
    if (!rows.length) break
    rows.forEach(row => { assert.ok(!ids.has(row.id)); ids.add(row.id) })
    const last = rows[rows.length - 1]; after = [last.date, last.id]
  }
  assert.equal(ids.size, 120)
})
test('save rejects an abort after request success rather than reporting success', async () => {
  const original = IDBObjectStore.prototype.add
  IDBObjectStore.prototype.add = function (...args) {
    const request = original.apply(this, args)
    request.addEventListener('success', () => this.transaction.abort())
    return request
  }
  try { await assert.rejects(db.addTransaction(transaction()), /abort/i) }
  finally { IDBObjectStore.prototype.add = original }
  assert.equal(await db.countTransactions(), 0)
})
