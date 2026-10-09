// Shared accounting rules for the dashboard, AI and exported reports.
export const CURRENCY_CODES = new Set('USD EUR GBP JPY AUD CAD CHF NZD SEK NOK DKK INR SGD HKD KRW CNY MYR THB IDR PHP VND AED SAR TRY ZAR BRL MXN RUB PLN CZK HUF ILS TWD NGN'.split(' '))

export function normalizeCurrency(value = 'INR') {
  const code = String(value).trim().toUpperCase()
  if (!CURRENCY_CODES.has(code)) throw new Error(`Unsupported currency: ${code}`)
  return code
}

export function convertAmount(amount, source, target, rates = {}) {
  if (!Number.isFinite(Number(amount))) throw new Error('Amount must be finite')
  if (source === target) return Number(amount)
  const rate = Number(rates[source])
  if (!Number.isFinite(rate) || rate <= 0) return null
  const result = Number(amount) / rate
  return Number.isFinite(result) ? result : null
}

export function aggregateTransactions(rows, currency = 'INR', rates = {}) {
  currency = normalizeCurrency(currency)
  let income = 0, expense = 0
  const categories = new Map()
  const missing = new Set()
  for (const row of rows) {
    const source = row.currency || 'INR'
    const converted = convertAmount(row.amount, source, currency, rates)
    if (converted === null) { missing.add(source); continue }
    if (row.type === 'income') income += Math.abs(converted)
    else {
      expense += Math.abs(converted)
      categories.set(row.category, (categories.get(row.category) || 0) + Math.abs(converted))
    }
  }
  const complete = missing.size === 0
  const balance = income - expense
  return {
    summary: {
      currency, complete, missing_currencies: [...missing],
      total_income: complete ? income : null,
      total_expense: complete ? expense : null,
      balance: complete ? balance : null,
      savings_rate: complete ? (income > 0 ? balance / income * 100 : 0) : null,
      transaction_count: rows.length,
    },
    categories: complete ? [...categories].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total) : [],
  }
}

export function requireComplete(summary) {
  if (!summary.complete) throw new Error(`Exchange rates unavailable for ${summary.missing_currencies.join(', ')} → ${summary.currency}. Totals are unavailable; your transactions are safe.`)
  return summary
}
