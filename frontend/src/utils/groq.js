import { getTavilyKey } from './tavily'
// Direct Groq client - calls Groq API straight from the phone.
// No backend proxy. API key stored in localStorage on phone.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const KEY_STORAGE = 'ft_groq_api_key'

function cleanKey(k) {
  return String(k || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').trim()
}

export function getGroqKey() {
  try { return cleanKey(localStorage.getItem(KEY_STORAGE) || '') } catch { return '' }
}

export function setGroqKey(k) {
  try {
    const v = cleanKey(k)
    if (v) localStorage.setItem(KEY_STORAGE, v)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {}
}

export function hasGroqKey() {
  return !!getGroqKey()
}

export async function testConnection() {
  const key = getGroqKey()
  if (!key) return { ok: false, message: 'No Groq key saved.' }
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'Reply with one short word: ok' }],
        max_tokens: 10,
        temperature: 0,
      }),
    })
    if (res.status === 401) return { ok: false, message: 'Invalid Groq key (401).' }
    if (res.status === 429) return { ok: false, message: 'Rate limited. Try again later.' }
    if (res.status === 402) return { ok: false, message: 'Groq credits exhausted.' }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, message: err.error?.message || `HTTP ${res.status}` }
    }
    return { ok: true, message: 'Connected. AI ready.' }
  } catch (e) {
    if (e.name === 'TypeError') return { ok: false, message: 'No internet. Check your connection.' }
    return { ok: false, message: e.message || 'Connection failed' }
  }
}

async function callGroq(prompt) {
  const key = getGroqKey()
  if (!key) throw new Error('Add a Groq API key in Settings to unlock live AI.')
  let res
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })
  } catch (e) {
    if (e.name === 'TypeError') throw new Error('No internet. Check your connection.')
    throw new Error('Network error: ' + (e.message || 'unknown'))
  }
  if (res.status === 401) throw new Error('Groq rejected the key (401). Update it in Settings.')
  if (res.status === 429) throw new Error('Groq rate-limited. Try again in a moment.')
  if (res.status === 402) throw new Error('Groq credits exhausted.')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Groq HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

const FALLBACK_INSIGHTS = `MONTHLY FINANCIAL REPORT

Overview
Track your spending patterns to identify areas where small adjustments can compound into meaningful savings.

Spending Analysis
Categorize your expenses into needs, wants, and savings to maintain a balanced financial lifestyle.

Action Items
- Review recurring subscriptions and cancel any that are unused.
- Set up an automatic monthly transfer to a savings account.
- Look for opportunities to reduce discretionary spending.

Outlook
Consistent, small changes to spending habits lead to significant long-term financial growth.

Add a free Groq API key in Settings to receive a personalized AI report based on your transaction data.`

const FALLBACK_TIPS = `PERSONALIZED SAVINGS PLAN

Framework
Apply the 50/30/20 rule as a starting point: 50% for needs, 30% for wants, 20% for savings and debt repayment.

Action Items
- Record every expense, no matter how small, to maintain awareness of cash flow.
- Build an emergency fund covering three to six months of essential expenses.
- Audit subscriptions quarterly and cancel services that no longer provide value.
- Use cashback or rewards programs for routine purchases.
- Review category-level spending each month to spot trends early.

Outlook
Disciplined tracking and incremental savings create a strong financial base over time.

Add a free Groq API key in Settings to receive a tailored savings plan based on your data.`

function fallbackFor(prompt) {
  return prompt.toLowerCase().includes('overview') ? FALLBACK_INSIGHTS : FALLBACK_TIPS
}

function stripEmoji(s) {
  if (!s) return s
  return String(s)
    .replace(/[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2700}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export async function getFinancialInsights(currentMonth, previousMonth, month, year) {
  const catText = Object.entries(currentMonth.categories || {})
    .map(([k, v]) => `\u2022 ${k}: ${Number(v).toFixed(2)}`)
    .join('\n') || 'No expenses recorded yet'

  const prompt = `You are a professional financial advisor. Write a concise monthly financial report for ${MONTHS[month]} ${year} based on the data below. Do not use emojis, exclamation marks, or marketing language. Use a calm, analytical tone. Format as plain text with these sections:

OVERVIEW
- One short paragraph summarizing the month's financial position.

SPENDING ANALYSIS
- Two to three short observations about the spending pattern.
- Compare to the previous month only if previous data is non-zero.

CATEGORY BREAKDOWN
- For each non-zero category in the data, one line: "Category: amount — brief comment."

RECOMMENDATIONS
- Three specific, realistic actions to improve next month. Start each line with a dash.

OUTLOOK
- One sentence on what to watch for next month.

Data:
Current month — Income: ${currentMonth.income.toFixed(2)}, Expenses: ${currentMonth.expense.toFixed(2)}, Balance: ${(currentMonth.income - currentMonth.expense).toFixed(2)}.
Categories: ${catText}
Previous month — Income: ${previousMonth.income.toFixed(2)}, Expenses: ${previousMonth.expense.toFixed(2)}.

Keep total response under 350 words.`

  let insights
  try { insights = await callGroq(prompt) }
  catch (e) { insights = fallbackFor(prompt); console.warn('Groq fallback:', e.message) }
  insights = stripEmoji(insights)

  const topCat = Object.entries(currentMonth.categories || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

  return {
    month: MONTHS[month],
    year,
    insights,
    highlights: {
      income: currentMonth.income,
      expenses: currentMonth.expense,
      savings: currentMonth.income - currentMonth.expense,
      top_category: topCat,
    },
    ai_configured: hasGroqKey(),
    provider: 'groq',
    model: hasGroqKey() ? MODEL : '',
  }
}

export async function getSavingsSuggestions(monthlyData) {
  const dataText = monthlyData.map(d =>
    `\u2022 Month ${d.month}/${d.year}: Income ${d.income.toFixed(2)}, Expenses ${d.expense.toFixed(2)}, Saved ${(d.income - d.expense).toFixed(2)}`
  ).join('\n')

  const prompt = `You are a professional financial advisor. Write a personalized savings plan based on the data below. Do not use emojis, exclamation marks, or marketing language. Use a calm, analytical tone. Format as plain text with these sections:

TREND ANALYSIS
- Two to three short observations about the income and expense trends.

WATCH LIST
- Up to three categories or months that warrant attention.

SAVINGS STRATEGY
- Five specific, realistic actions to improve the savings rate. Each on its own line starting with a dash.

TARGETS
- A suggested monthly savings amount and savings-rate range.

RISK INDICATORS
- One or two early warning signs to monitor.

Data over ${monthlyData.length} months:
${dataText}

Keep total response under 350 words.`

  let suggestions
  try { suggestions = await callGroq(prompt) }
  catch (e) { suggestions = fallbackFor(prompt); console.warn('Groq fallback:', e.message) }
  suggestions = stripEmoji(suggestions)

  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  return {
    suggestions,
    analysis_period: `${monthlyData.length} months`,
    average_income: avg(monthlyData.map(d => d.income)),
    average_expense: avg(monthlyData.map(d => d.expense)),
    ai_configured: hasGroqKey(),
    provider: 'groq',
    model: hasGroqKey() ? MODEL : '',
  }
}

export async function chatWithFinancialAssistant(messages) {
  const groqKey = getGroqKey()
  if (!groqKey) throw new Error('Add a Groq API key in Settings to use the Chatbot.')

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || ''

  // System prompt to enforce banking/finance assistant rules
  const systemPrompt = `You are a professional Financial & Banking Assistant. 
Your instructions:
1. You must ONLY answer questions related to finance, banking, currency exchange, savings, investments, tax, loans, stock markets, card offers, and general economy.
2. If the user asks about coding, programming, web development, general trivia, math (unrelated to finance), science, history, translation (outside finance), or anything else outside finance, politely refuse to answer. You are NOT allowed to answer coding questions or other non-financial questions under any circumstances.
3. You can converse in any language the user speaks.
4. Keep your answers concise, practical, and highly professional.
5. If the user's query requires current real-time financial information (like interest rates, stock prices, exchange rates, banking news, today's rates, latest updates), utilize the provided search context. If no search context is provided or it doesn't answer the question, state that you don't have real-time access for it.
`

  // Decide if we should do a web search using Tavily.
  const needsSearch = /rate|interest|current|today|latest|stock|price|news|bank|sbi|hdfc|icici|offer|loan|mortgage|market|yield|fd|rd|crypto|gold/i.test(lastUserMessage)
  
  let searchContext = ""
  const tavilyKey = getTavilyKey()

  if (needsSearch && tavilyKey) {
    try {
      const searchRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: `finance banking: ${lastUserMessage}`,
          search_depth: 'basic',
          include_answer: true,
          max_results: 3,
          topic: 'finance',
        }),
      })
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        searchContext = `[Search Results from Internet]:\n${searchData.answer || ''}\n\n`
        if (searchData.results) {
          searchContext += searchData.results.map(r => `- ${r.title}: ${r.content}`).join('\n')
        }
      }
    } catch (e) {
      console.warn('Tavily search failed for chat:', e)
    }
  }

  // Build the message history for Groq
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => {
      if (m.role === 'user' && m.content === lastUserMessage && searchContext) {
        return { role: 'user', content: `${searchContext}\nUser Question: ${m.content}` }
      }
      return m
    })
  ]

  let res
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: formattedMessages,
        temperature: 0.5,
        max_tokens: 1024,
      }),
    })
  } catch (e) {
    if (e.name === 'TypeError') throw new Error('No internet connection.')
    throw e
  }

  if (res.status === 401) throw new Error('Groq API key is invalid.')
  if (res.status === 429) throw new Error('Groq rate limit. Try again in a moment.')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Groq error ${res.status}`)
  }

  const responseData = await res.json()
  return responseData.choices?.[0]?.message?.content || ''
}
