import * as db from './db.js'
import { requireComplete } from './finance.js'
import { saveBlob } from './files.js'

export async function exportTransactionsPDF(currency = 'INR') {
  const revision = db.getRevision()
  const totals = new Map()
  let count = 0, after = null
  // Sum native currencies in bounded pages, then value their totals once.
  while (true) {
    const rows = await db.getTransactionPage(after)
    if (!rows.length) break
    for (const row of rows) {
      const code = row.currency || 'INR'
      const group = totals.get(code) || { income: 0, expense: 0 }
      group[row.type] += Math.abs(row.amount)
      totals.set(code, group)
    }
    count += rows.length
    const last = rows[rows.length - 1]
    after = [last.date, last.id]
    if (db.getRevision() !== revision) throw new Error('Ledger changed during export. Please retry.')
  }
  const synthetic = [...totals].flatMap(([code, sums]) => Object.entries(sums).map(([type, amount]) => ({ type, amount: type === 'expense' ? -amount : amount, currency: code, category: 'Total' })))
  const valuation = await db.valueTransactions(synthetic, currency)
  const summary = requireComplete(valuation.summary)
  const worker = new Worker(new URL('./pdfWorker.js', import.meta.url), { type: 'module' })
  try {
    let sequence = 0
    const request = payload => new Promise((resolve, reject) => {
      const id = ++sequence
      const timer = setTimeout(() => { cleanup(); reject(new Error('PDF generation timed out. Try a smaller export.')) }, 120000)
      const message = event => {
        if (event.data.id !== id) return
        cleanup()
        event.data.error ? reject(new Error(event.data.error)) : resolve(event.data)
      }
      const error = () => { cleanup(); reject(new Error('Could not generate PDF')) }
      const cleanup = () => { clearTimeout(timer); worker.removeEventListener('message', message); worker.removeEventListener('error', error) }
      worker.addEventListener('message', message)
      worker.addEventListener('error', error)
      worker.postMessage({ id, ...payload })
    })
    await request({ action: 'start', summary, count, rateData: valuation.rateData })
    after = null
    let written = 0
    while (true) {
      const rows = await db.getTransactionPage(after)
      if (!rows.length) break
      if (db.getRevision() !== revision) throw new Error('Ledger changed during export. Please retry.')
      await request({ action: 'rows', rows, offset: written })
      written += rows.length
      const last = rows[rows.length - 1]
      after = [last.date, last.id]
    }
    if (written !== count || db.getRevision() !== revision) throw new Error('Ledger changed during export. Please retry.')
    const { buffer } = await request({ action: 'finish' })
    const fileName = `Finera-Report-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`
    const saved = await saveBlob(new Blob([buffer], { type: 'application/pdf' }), fileName)
    return { fileName, saved, count }
  } finally { worker.terminate() }
}
