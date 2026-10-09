import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

let doc
function tableRows(rows, offset) {
  return rows.map((row, index) => [String(offset + index + 1), new Date(row.date).toLocaleString(), row.name, row.category, row.type, `${row.currency || 'INR'} ${Math.abs(row.amount).toFixed(2)}`])
}
self.onmessage = ({ data }) => {
  try {
    if (data.action === 'start') {
      const s = data.summary
      doc = new jsPDF({ unit: 'mm', format: 'a4' })
      doc.setFontSize(17)
      doc.text('Finera - Transaction Report', 14, 18)
      doc.setFontSize(9)
      doc.text(`Generated ${new Date().toISOString()} | ${data.count} transactions`, 14, 25)
      doc.text(`Totals valued in ${s.currency}${data.rateData?.stale ? ' (cached rates)' : ''}. Individual rows retain their original currency.`, 14, 31)
      autoTable(doc, { startY: 36, head: [['Income', 'Expense', 'Balance', 'Savings rate']], body: [[`${s.currency} ${s.total_income.toFixed(2)}`, `${s.currency} ${s.total_expense.toFixed(2)}`, `${s.currency} ${s.balance.toFixed(2)}`, `${s.savings_rate.toFixed(1)}%`]], styles: { fontSize: 9 } })
    } else if (data.action === 'rows') {
      const start = (doc.lastAutoTable?.finalY || 44) + 5
      if (start > 265) doc.addPage()
      autoTable(doc, {
        startY: start > 265 ? 15 : start,
        head: [['#', 'Date & time', 'Description', 'Category', 'Type', 'Amount']],
        body: tableRows(data.rows, data.offset), styles: { fontSize: 8, cellPadding: 2 },
        margin: { top: 15, bottom: 18 }, columnStyles: { 0: { cellWidth: 10 }, 5: { halign: 'right' } },
      })
    } else if (data.action === 'finish') {
      const pages = doc.getNumberOfPages()
      for (let page = 1; page <= pages; page++) { doc.setPage(page); doc.setFontSize(8); doc.text(`Finera - Page ${page} / ${pages}`, 105, 291, { align: 'center' }) }
      const buffer = doc.output('arraybuffer')
      self.postMessage({ id: data.id, buffer }, [buffer])
      doc = null
      return
    }
    self.postMessage({ id: data.id })
  } catch (error) { self.postMessage({ id: data.id, error: error.message || 'PDF generation failed' }) }
}
