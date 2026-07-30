// Direct Tavily client - calls Tavily API straight from the phone.
// Real-time, day-to-day currency rates via web search.

const TAVILY_URL = 'https://api.tavily.com/search'
const KEY_STORAGE = 'ft_tavily_api_key'
const CACHE_KEY = 'ft_tavily_cache'
const CACHE_TTL = 60 * 60 * 1000

const CURRENCY_NAMES = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen',
  AUD: 'Australian Dollar', CAD: 'Canadian Dollar', CHF: 'Swiss Franc',
  NZD: 'New Zealand Dollar', SEK: 'Swedish Krona', NOK: 'Norwegian Krone',
  DKK: 'Danish Krone', INR: 'Indian Rupee', SGD: 'Singapore Dollar',
  HKD: 'Hong Kong Dollar', KRW: 'South Korean Won', CNY: 'Chinese Yuan',
  MYR: 'Malaysian Ringgit', THB: 'Thai Baht', IDR: 'Indonesian Rupiah',
  PHP: 'Philippine Peso', VND: 'Vietnamese Dong', AED: 'UAE Dirham',
  SAR: 'Saudi Riyal', TRY: 'Turkish Lira', ZAR: 'South African Rand',
  BRL: 'Brazilian Real', MXN: 'Mexican Peso', RUB: 'Russian Ruble',
  PLN: 'Polish Zloty', CZK: 'Czech Koruna', HUF: 'Hungarian Forint',
  ILS: 'Israeli Shekel', TWD: 'Taiwan Dollar', NGN: 'Nigerian Naira',
}

const SUPPORTED = new Set(Object.keys(CURRENCY_NAMES))

function cleanKey(k) {
  return String(k || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').trim()
}

export function getTavilyKey() {
  try { return cleanKey(localStorage.getItem(KEY_STORAGE) || '') } catch { return '' }
}
export function setTavilyKey(k) {
  try {
    const v = cleanKey(k)
    if (v) localStorage.setItem(KEY_STORAGE, v)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {}
}
export function hasTavilyKey() {
  return !!getTavilyKey()
}

function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} } }
function writeCache(obj) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(obj)) } catch {} }

function parseJsonRates(text) {
  if (!text) return {}
  let s = String(text)
  s = s.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const candidates = []

  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced) candidates.push(fenced[1])

  const firstBrace = s.indexOf('{')
  const lastBrace = s.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(s.slice(firstBrace, lastBrace + 1))
  }

  candidates.push(s)

  for (const c of candidates) {
    if (!c || !c.includes('{')) continue
    try {
      const obj = JSON.parse(c)
      const out = {}
      for (const [k, v] of Object.entries(obj)) {
        const n = Number(v)
        if (Number.isFinite(n) && n > 0) out[String(k).toUpperCase()] = n
      }
      if (Object.keys(out).length) return out
    } catch {}
  }

  const re = /"([A-Z]{3})"\s*:\s*([\d.,]+)/g
  const obj = {}
  let m
  while ((m = re.exec(s))) {
    const n = parseFloat(m[2].replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) obj[m[1].toUpperCase()] = n
  }
  return obj
}

function parseLooseRates(text) {
  if (!text) return {}
  const out = {}
  const patterns = [
    /(?:^|\s)(\d+(?:\.\d+)?)\s*([A-Z]{3})\b/g,
    /\b([A-Z]{3})\b\s*[:=]?\s*(\d+(?:\.\d+)?)/g,
    /(\d+(?:\.\d+)?)\s*(?:to|→)\s*([A-Z]{3})/gi,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(text))) {
      let code, num
      if (/^[A-Z]{3}$/.test(m[1]) && Number.isFinite(parseFloat(m[2]))) {
        code = m[1]; num = parseFloat(m[2])
      } else if (Number.isFinite(parseFloat(m[1])) && /^[A-Z]{3}$/.test(m[2])) {
        code = m[2]; num = parseFloat(m[1])
      } else {
        continue
      }
      if (code && Number.isFinite(num) && num > 0 && num < 1000000) {
        out[code.toUpperCase()] = num
      }
    }
    if (Object.keys(out).length) return out
  }
  return out
}

export async function testConnection() {
  const key = getTavilyKey()
  if (!key) return { ok: false, message: 'No Tavily key saved.' }
  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: 'What is the current exchange rate from 1 USD to INR? Reply with JSON like {"INR": 83.5}.',
        search_depth: 'basic',
        include_answer: true,
        max_results: 3,
        topic: 'finance',
      }),
    })
    if (res.status === 401) return { ok: false, message: 'Invalid API key (401). Check and try again.' }
    if (res.status === 432) return { ok: false, message: 'Monthly quota exceeded.' }
    if (res.status === 429) return { ok: false, message: 'Rate limited. Try again in a moment.' }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, message: `HTTP ${res.status}. ${body.slice(0, 120)}` }
    }
    const data = await res.json()
    const ans = data.answer || ''
    const rates = parseJsonRates(ans) || (Array.isArray(data.results) ? parseLooseRates(data.results[0]?.content || '') : {})
    if (Object.keys(rates).length) return { ok: true, message: 'Connected. Live rates ready.' }
    return { ok: true, message: 'Connected. (Tavily may not return rates outside converter context.)' }
  } catch (e) {
    if (e.name === 'TypeError') return { ok: false, message: 'Network error. Check your internet connection.' }
    return { ok: false, message: e.message || 'Connection failed' }
  }
}

async function fetchFromTavily(base) {
  const key = getTavilyKey()
  if (!key) throw new Error('Add a Tavily API key in Settings to get live rates.')
  const targetCodes = Object.keys(CURRENCY_NAMES).filter(c => c !== base)
  const codeList = targetCodes.join(' ')
  const prompt = `Current ${base} exchange rates in JSON only. Convert 1 ${base} to: ${codeList}. Output format exactly: {"INR":83.5,"EUR":0.91,...} No text, no markdown, JSON only.`

  let res
  try {
    res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: prompt,
        search_depth: 'advanced',
        include_answer: true,
        include_raw_content: true,
        max_results: 5,
        topic: 'finance',
      }),
    })
  } catch (e) {
    if (e.name === 'TypeError') throw new Error('No internet. Check your connection.')
    throw new Error('Network error: ' + (e.message || 'unknown'))
  }

  if (res.status === 401) throw new Error('Tavily rejected the key (401). Check it in Settings.')
  if (res.status === 429) throw new Error('Tavily rate limit. Wait 30 seconds and try again.')
  if (res.status === 432) throw new Error('Tavily monthly quota exceeded (1000 searches). Wait for next month or upgrade.')
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Tavily HTTP ${res.status}${body ? ': ' + body.slice(0, 80) : ''}`)
  }
  const data = await res.json()

  const sources = [data.answer || '']
  if (Array.isArray(data.results)) {
    for (const r of data.results) {
      if (r.content) sources.push(r.content)
      if (r.raw_content) sources.push(r.raw_content)
    }
  }

  let rates = {}
  for (const src of sources) {
    const j = parseJsonRates(src)
    if (Object.keys(j).length) { rates = j; break }
  }
  if (!Object.keys(rates).length) {
    for (const src of sources) {
      const l = parseLooseRates(src)
      if (Object.keys(l).length) { rates = l; break }
    }
  }
  if (!Object.keys(rates).length) {
    throw new Error('Could not parse rates from Tavily. Try again, or check your key.')
  }

  const filtered = {}
  for (const c of targetCodes) if (c in rates) filtered[c] = rates[c]
  if (!Object.keys(filtered).length) throw new Error('No usable rates returned.')

  return {
    base,
    rates: filtered,
    updated_at: new Date().toISOString(),
    provider: 'tavily',
  }
}

export async function getRates(base = 'USD', { force = false } = {}) {
  base = String(base).toUpperCase()
  if (!SUPPORTED.has(base)) throw new Error(`Unsupported base: ${base}`)

  const cache = readCache()
  const hit = cache[base]
  if (!force && hit && Date.now() - hit.cachedAt < CACHE_TTL) return hit.data

  // 1) Try open.er-api.com first (reliable real-time data, no API key required)
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`)
    if (res.ok) {
      const data = await res.json()
      if (data && data.result === 'success' && data.rates) {
        const targetCodes = Object.keys(CURRENCY_NAMES).filter(c => c !== base)
        const filtered = {}
        for (const c of targetCodes) {
          if (c in data.rates) filtered[c] = Number(data.rates[c])
        }
        if (Object.keys(filtered).length > 0) {
          const parsedData = {
            base,
            rates: filtered,
            updated_at: new Date(data.time_last_update_unix * 1000).toISOString(),
            provider: 'exchangerate-api',
          }
          cache[base] = { data: parsedData, cachedAt: Date.now() }
          writeCache(cache)
          return parsedData
        }
      }
    }
  } catch (e) {
    console.warn('Failed to fetch from open.er-api, trying Tavily fallback:', e)
  }

  // 2) Fallback to Tavily
  const data = await fetchFromTavily(base)
  cache[base] = { data, cachedAt: Date.now() }
  writeCache(cache)
  return data
}

export async function convert(amount, from, to) {
  from = String(from).toUpperCase()
  to = String(to).toUpperCase()
  if (from === to) return { amount, from_currency: from, to_currency: to, converted: amount, rate: 1, updated_at: null }
  const { rates, updated_at } = await getRates(from)
  const rate = rates[to]
  if (!rate) throw new Error(`No rate for ${to}`)
  return { amount, from_currency: from, to_currency: to, converted: amount * rate, rate, updated_at }
}
