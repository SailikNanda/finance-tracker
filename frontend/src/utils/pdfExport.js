import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as db from './db'
import { canDownloadInApp, saveFileBase64 } from './apkUpdater'

const SYMBOLS = {
  INR: '\u20B9', USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5',
  AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: '\u062F.\u0625', SAR: '\uFDFC',
  MYR: 'RM', THB: '\u0E3F', KRW: '\u20A9', CNY: '\u00A5', NGN: '\u20A6',
}

const pad = (n) => String(n).padStart(2, '0')

function formatDateTime(iso) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch { return String(iso) }
}

function formatAmount(row) {
  const symbol = SYMBOLS[row.currency] || row.currency || ''
  return `${symbol}${Math.abs(row.amount).toFixed(2)}`
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function exportTransactionsPDF(currency = 'INR') {
  const all = await db.getAllTransactions()
  const sorted = [...all].sort((a, b) => {
    const da = new Date(a.date || a.createdAt).getTime() || 0
    const dbd = new Date(b.date || b.createdAt).getTime() || 0
    return dbd - da
  })

  let income = 0, expense = 0
  for (const r of sorted) {
    if (r.amount > 0) income += r.amount
    else expense += Math.abs(r.amount)
  }
  const balance = income - expense
  const savingsRate = income > 0 ? (balance / income) * 100 : 0
  const mainSymbol = SYMBOLS[currency] || currency || ''

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Header band
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, 210, 32, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text('Finera - Transaction Report', 14, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184)
  doc.text(`Generated: ${formatDateTime(new Date().toISOString())}`, 14, 21)
  doc.text(`Transactions: ${sorted.length}  |  Period: all time`, 14, 26)

  // Summary row
  autoTable(doc, {
    startY: 38,
    head: [['Total Income', 'Total Expense', 'Balance', 'Savings Rate']],
    body: [[
      `${mainSymbol}${income.toFixed(2)}`, `${mainSymbol}${expense.toFixed(2)}`,
      `${mainSymbol}${balance.toFixed(2)}`, `${savingsRate.toFixed(1)}%`,
    ]],
    theme: 'grid',
    styles: { fontSize: 10, fontStyle: 'bold', halign: 'center', cellPadding: 4 },
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59] },
  })

  // Transactions table
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [['#', 'Date & Time', 'Description', 'Category', 'Type', 'Amount']],
    body: sorted.map((r, i) => [
      String(i + 1),
      formatDateTime(r.date || r.createdAt),
      r.name || '',
      r.category || '',
      r.amount > 0 ? 'Income' : 'Expense',
      formatAmount(r),
    ]),
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [51, 65, 85] },
    headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 36 },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5 && data.row.index !== undefined) {
        const tx = sorted[data.row.index]
        if (tx) data.cell.styles.textColor = tx.amount > 0 ? [22, 101, 52] : [190, 18, 60]
      }
    },
  })

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(`Finera - Page ${i} / ${pageCount}`, 105, 291, { align: 'center' })
  }

  const blob = doc.output('blob')
  const now = new Date()
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  const fileName = `Finera-Report-${stamp}.pdf`

  if (canDownloadInApp()) {
    const base64 = await blobToBase64(blob)
    await saveFileBase64(base64, fileName)
    return { fileName, saved: 'downloads', count: sorted.length }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
  return { fileName, saved: 'browser', count: sorted.length }
}