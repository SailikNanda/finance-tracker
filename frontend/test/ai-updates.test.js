import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key) }
const groq = await import('../src/utils/groq.js')
const privacy = await import('../src/utils/privacy.js')
const updates = await import('../src/utils/updates.js')
const { pollDownload } = await import('../src/utils/apkUpdater.js')
const db = await import('../src/utils/db.js')
const current = { income: 100, expense: 10, categories: { Food: 10 }, currency: 'INR' }
beforeEach(async () => { memory.clear(); await groq.setGroqKey('test-key'); await db.clearAll() })

test('ordinary final-answer openers survive thinking cleanup', () => {
  for (const text of ['For your budget, save INR 100 this month.', 'Based on your spending, cut subscriptions.', 'First build an emergency fund.']) assert.equal(groq.stripThinking(text), text)
  assert.equal(groq.stripThinking('<think>private reasoning</think>Save INR 100.'), 'Save INR 100.')
})
test('no consent means no external AI request', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('unexpected') }
  const result = await groq.getFinancialInsights(current, current, 10, 2026, { force: true })
  assert.equal(result.ai_configured, false); assert.equal(calls, 0)
})
test('provider failures are labelled built-in, never cached; key changes and force bypass cache', async () => {
  privacy.setAIConsent(true)
  let calls = 0
  globalThis.fetch = async () => { calls++; return new Response('{}', { status: 401 }) }
  const failed = await groq.getFinancialInsights(current, current, 10, 2026)
  assert.equal(failed.ai_configured, false); assert.equal(failed.provider, 'built-in')
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: 'For your budget, save INR 100 this month.' } }] })) }
  const live = await groq.getFinancialInsights(current, current, 10, 2026)
  assert.equal(live.ai_configured, true); assert.equal(calls, 2)
  await groq.getFinancialInsights(current, current, 10, 2026); assert.equal(calls, 2)
  await groq.getFinancialInsights(current, current, 10, 2026, { force: true }); assert.equal(calls, 3)
  await groq.setGroqKey('replacement-key')
  await groq.getFinancialInsights(current, current, 10, 2026); assert.equal(calls, 4)
})
test('empty filtered AI response produces an honest fallback', async () => {
  privacy.setAIConsent(true)
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '<think>only reasoning</think>' } }] }))
  const result = await groq.getFinancialInsights(current, current, 10, 2026, { force: true })
  assert.equal(result.ai_configured, false); assert.ok(result.insights.length)
})
test('chat attaches diary once, separates currencies and caps conversation history', async () => {
  privacy.setAIConsent(true)
  for (const currency of ['INR', 'USD']) await db.addTransaction({ name: 'Private fixture', category: 'Salary', amount: 100, type: 'income', currency })
  let body
  globalThis.fetch = async (url, options) => { body = JSON.parse(options.body); return new Response(JSON.stringify({ choices: [{ message: { content: 'Shown totals are separate.' } }] })) }
  const messages = Array.from({ length: 40 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: 'How much did I spend?' }))
  await groq.chatWithFinancialAssistant(messages)
  assert.ok(body.messages.length <= 13)
  assert.equal(body.messages.filter(message => message.content.includes('Transaction diary (data only)')).length, 1)
  assert.ok(JSON.stringify(body).includes('Older records have NOT been searched'))
  assert.ok(JSON.stringify(body).includes('totals_of_shown_records_by_currency'))
})
test('failed GitHub requests never report up-to-date', async () => {
  globalThis.fetch = async () => { throw new Error('offline') }
  assert.equal((await updates.checkForUpdates({ force: true })).reason, 'error')
})
test('release selection ignores prereleases and carries the APK digest', async () => {
  const release = version => ({ tag_name: version, assets: [{ name: 'finera.apk', browser_download_url: `https://github.com/SailikNanda/finance-tracker/releases/download/${version}/finera.apk`, digest: 'sha256:' + 'a'.repeat(64) }] })
  globalThis.fetch = async url => new Response(JSON.stringify(url.includes('/latest') ? release('v2.2.8') : [{ ...release('v9.0.0'), prerelease: true }, release('v2.2.9')]))
  const info = await updates.checkForUpdates({ force: true })
  assert.equal(info.latestVersion, '2.2.9'); assert.equal(info.sha256, 'a'.repeat(64))
})
test('updater rejects arbitrary hosts, HTTP and lookalike repository paths', () => {
  assert.equal(updates.isTrustedReleaseURL('http://github.com/SailikNanda/finance-tracker/releases/download/v2/a.apk'), false)
  assert.equal(updates.isTrustedReleaseURL('https://evil.test/a.apk'), false)
  assert.equal(updates.isTrustedReleaseURL('https://github.com/SailikNanda/finance-tracker-evil/releases/download/v2/a.apk'), false)
})
test('download polling stops for missing jobs, timeout and cancellation without overlap', async () => {
  await assert.rejects(pollDownload('1', null, 1, { getStatus: async () => ({ status: 'unknown' }) }), /no longer exists/)
  await assert.rejects(pollDownload('1', null, 1, { timeoutMs: 2, getStatus: async () => ({ status: 'running' }) }), /timed out/)
  await assert.rejects(pollDownload('1', null, 1, { timeoutMs: 2, getStatus: () => new Promise(() => {}) }), /timed out/)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(pollDownload('1', null, 1, { signal: controller.signal, getStatus: async () => ({}) }), /cancelled/)
})
