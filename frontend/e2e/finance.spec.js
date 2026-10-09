import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'

const row = overrides => {
  const date = new Date()
  return { uuid: `fixture-${Math.random()}`, name: 'Fixture income', amount: 100, category: 'Salary', type: 'income', currency: 'INR', date: date.toISOString(), createdAt: date.getTime(), ...overrides }
}
const panel = page => page.locator('.tab-panel.active')
async function tab(page, name) { await page.locator('.tab-nav').getByRole('button', { name, exact: true }).click() }
async function restore(page, rows) {
  await tab(page, 'More')
  await page.getByLabel('Choose JSON backup').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'finera-backup', version: 1, transactions: rows })) })
  await expect(panel(page).getByRole('status').filter({ hasText: 'Restored' })).toBeVisible()
}
test.beforeEach(async ({ page }) => {
  await page.route('https://open.er-api.com/**', route => {
    const base = route.request().url().split('/').pop()
    const rates = base === 'USD' ? { INR: 80, EUR: 0.888888 } : base === 'EUR' ? { INR: 90, USD: 1.125 } : { USD: 0.0125, EUR: 1 / 90 }
    return route.fulfill({ json: { result: 'success', rates, time_last_update_unix: 1780000000 } })
  })
  await page.route('https://api.groq.com/**', route => route.fulfill({ json: { choices: [{ message: { content: 'For your budget, save INR 100 this month.' } }] } }))
  await page.route('https://api.github.com/**', route => route.fulfill({ json: route.request().url().includes('per_page') ? [] : { tag_name: 'v2.2.8', assets: [{ name: 'finera.apk', browser_download_url: 'https://github.com/SailikNanda/finance-tracker/releases/download/v2.2.8/finera.apk', digest: 'sha256:' + 'a'.repeat(64) }] } }))
  await page.goto('/')
  await expect(page.locator('.stats-grid')).toBeVisible()
})

test('production startup excludes PDF worker and opens history/month without crashing', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name))
  expect(resources.some(name => /pdfWorker|html2canvas|purify\.es|pdfExport/.test(name))).toBeFalsy()
  await restore(page, [row({ amount: -500, type: 'expense', category: 'Food' })])
  await tab(page, 'History')
  await expect(panel(page).locator('.transaction-row')).toHaveCount(1)
  await page.getByRole('button', { name: 'Previous month', exact: true }).click()
  await expect(panel(page).getByText('No transactions yet')).toBeVisible()
  await page.getByRole('button', { name: 'Next month', exact: true }).click()
  await expect(panel(page).locator('.transaction-row')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('restorable JSON preserves expenses, repeat restore skips duplicates, cancelled wipe keeps ledger', async ({ page }) => {
  await restore(page, [row({ amount: -500, type: 'expense', category: 'Food' })])
  const downloadEvent = page.waitForEvent('download')
  await panel(page).getByRole('button', { name: 'Export JSON', exact: true }).click()
  const backup = await downloadEvent
  const contents = await fs.readFile(await backup.path(), 'utf8')
  expect(JSON.parse(contents).transactions[0].amount).toBe(-500)
  await page.getByLabel('Choose JSON backup').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(contents) })
  await expect(panel(page).getByText('Restored 0 transactions; skipped 1 duplicates.')).toBeVisible()
  page.once('dialog', dialog => dialog.dismiss())
  await panel(page).getByRole('button', { name: 'Delete all', exact: true }).click()
  await tab(page, 'History')
  await expect(panel(page).locator('.transaction-row')).toHaveCount(1)
  await tab(page, 'More')
  page.once('dialog', dialog => dialog.accept())
  await panel(page).getByRole('button', { name: 'Delete all', exact: true }).click()
  await expect(panel(page).getByText('All transactions deleted')).toBeVisible()
  await tab(page, 'History')
  await expect(panel(page).getByText('No transactions yet')).toBeVisible()
})

test('invalid replace leaves existing ledger unchanged and shows useful validation', async ({ page }) => {
  await restore(page, [row({ name: 'Safe existing record' })])
  await page.getByLabel('Restore mode').selectOption('replace')
  page.once('dialog', dialog => dialog.accept())
  await page.getByLabel('Choose JSON backup').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'finera-backup', version: 1, transactions: [row({ name: ' ' })] })) })
  await expect(panel(page).getByText(/Backup row 1/)).toBeVisible()
  await tab(page, 'History')
  await expect(panel(page).getByText('Safe existing record')).toBeVisible()
})

test('history pagination bounds DOM rows and searching finds later records', async ({ page }) => {
  await restore(page, Array.from({ length: 121 }, (_, index) => row({ name: `Record ${index}` })))
  await tab(page, 'History')
  await expect(panel(page).locator('.transaction-row')).toHaveCount(50)
  await panel(page).getByRole('button', { name: 'Next', exact: true }).click()
  await expect(panel(page).getByText('Page 2 of 3')).toBeVisible()
  await panel(page).getByPlaceholder('Search...').fill('Record 120')
  await expect(panel(page).locator('.transaction-row')).toHaveCount(1)
})

test('mixed currency dashboard and worker PDF use the same converted total', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await restore(page, [row({ amount: 1000 }), row({ amount: 100, currency: 'USD' })])
  await tab(page, 'Home')
  await expect(panel(page).locator('.stat-card--income .stat-value')).toHaveText('₹9000.00')
  await tab(page, 'More')
  const event = page.waitForEvent('download')
  await panel(page).getByRole('button', { name: 'Export PDF', exact: true }).click()
  const download = await event
  const pdf = await fs.readFile(await download.path())
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
  expect(pdf.toString()).toContain('INR 9000.00')
  expect(pdf.toString()).toContain('USD 100.00')
  expect(errors).toEqual([])
})

test('AI updates after a new transaction and keys are not persisted as plaintext', async ({ page }) => {
  await restore(page, [row({ amount: 100 })])
  await page.locator('#apikey-groq').fill('gsk_test_dummy_key')
  await page.locator('.api-form').first().getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Allow financial data to be sent for AI features' }).check()
  await tab(page, 'AI')
  await expect(panel(page).locator('.ai-pill--green .ai-pill-value').first()).toHaveText('₹100.00')
  await expect(panel(page).getByText('For your budget, save INR 100 this month.')).toBeVisible()
  await tab(page, 'Add')
  await panel(page).getByRole('tab', { name: 'Income', exact: true }).click()
  await page.locator('#tx-name').fill('Extra income')
  await page.locator('#tx-amount').fill('50')
  await panel(page).locator('.category-chip').filter({ hasText: 'Salary' }).click()
  await panel(page).getByRole('button', { name: 'Add Income', exact: true }).click()
  await expect(panel(page).getByRole('status')).toBeVisible()
  await tab(page, 'AI')
  await expect(panel(page).locator('.ai-pill--green .ai-pill-value').first()).toHaveText('₹150.00')
  const key = await page.evaluate(() => localStorage.getItem('ft_groq_api_key'))
  expect(key).toBeNull()
})

test('slow earlier currency request never overwrites the current selection', async ({ page }) => {
  await page.route('https://open.er-api.com/v6/latest/EUR', async route => {
    await new Promise(resolve => setTimeout(resolve, 400))
    await route.fulfill({ json: { result: 'success', rates: { INR: 90, USD: 1.125 }, time_last_update_unix: 1780000000 } })
  })
  await tab(page, 'Convert')
  const from = panel(page).locator('.converter-select').first()
  const to = panel(page).locator('.converter-select').nth(1)
  await to.selectOption('INR')
  const requested = page.waitForRequest('https://open.er-api.com/v6/latest/EUR')
  const previousResponse = page.waitForResponse('https://open.er-api.com/v6/latest/EUR')
  await from.selectOption('EUR'); await requested
  await from.selectOption('USD')
  await expect(panel(page).getByText('1 USD = 80.0000 INR', { exact: true })).toBeVisible()
  await (await previousResponse).finished()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expect(panel(page).getByText('1 USD = 80.0000 INR', { exact: true })).toBeVisible()
  await expect(panel(page).getByText('1 USD = 90.0000 INR', { exact: true })).toHaveCount(0)
})

test('offline mixed-currency totals and failed update checks are labelled unavailable', async ({ page }) => {
  await page.route('https://open.er-api.com/**', route => route.abort())
  await page.route('https://api.github.com/**', route => route.abort())
  await restore(page, [row({ amount: 100, currency: 'EUR' })])
  await tab(page, 'Home')
  await expect(panel(page).locator('.stat-card--income .stat-value')).toHaveText('Unavailable')
  await tab(page, 'More')
  await expect(panel(page).getByText('Check failed', { exact: true })).toBeVisible()
})
