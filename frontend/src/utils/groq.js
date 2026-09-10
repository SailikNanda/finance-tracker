import { getTavilyKey } from './tavily'
import * as db from './db'
// Direct Groq client - calls Groq API straight from the phone.
// No backend proxy. API key stored in localStorage on phone.
// Now includes local transaction diary for detailed Q&A.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODELS = [
  'qwen/qwen3.8-27b',
]

const GROQ_TIMEOUT = 15000
const TAVILY_TIMEOUT = 8000
const AI_CACHE_TTL = 30 * 60 * 1000 // 30 min frontend cache
const insightsCache = new Map() // key -> {data, ts}
const suggestionsCache = new Map()

const KEY_STORAGE = 'ft_groq_api_key'
let activeModel = MODELS[0]
const MODEL = () => activeModel

// Qwen3 on Groq: reasoning_effort 'none' truly disables thinking
// (reasoning_format 'hidden' is kept as a safety net to never surface thinking text).
const REQ_COMMON = { reasoning_effort: 'none', reasoning_format: 'hidden' }

function fetchWithTimeout(url, options = {}, timeoutMs = GROQ_TIMEOUT) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  const opts = { ...options, signal: controller.signal }
  return fetch(url, opts).finally(() => clearTimeout(id))
}

function getCache(cache, key) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < AI_CACHE_TTL) return hit.data
  if (hit) cache.delete(key)
  return null
}
function setCache(cache, key, data) {
  cache.set(key, { data, ts: Date.now() })
  // keep cache small (max 20 entries)
  if (cache.size > 20) {
    const firstKey = cache.keys().next().value
    cache.delete(firstKey)
  }
}

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
    const res = await fetchWithTimeout(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL(),
        messages: [{ role: 'user', content: 'Reply with one short word: ok' }],
        max_completion_tokens: 10,
        temperature: 0,
        ...REQ_COMMON,
      }),
    }, 10000)
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

async function groqRequest(prompt, messages) {
  const key = getGroqKey()
  if (!key) throw new Error('Add a Groq API key in Settings to unlock live AI.')
  const body = messages
    ? { model: MODEL(), messages, temperature: 0.5, max_completion_tokens: 2048, ...REQ_COMMON }
    : { model: MODEL(), messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_completion_tokens: 2048, ...REQ_COMMON }
  let res
  try {
    res = await fetchWithTimeout(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    }, GROQ_TIMEOUT)
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Groq timed out (15s). Try again.')
    if (e.name === 'TypeError') throw new Error('No internet. Check your connection.')
    throw new Error('Network error: ' + (e.message || 'unknown'))
  }
  if (res.status === 401) throw new Error('Groq rejected the key (401). Update it in Settings.')
  if (res.status === 429) throw new Error('Groq rate-limited. Try again in a moment.')
  if (res.status === 402) throw new Error('Groq credits exhausted.')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error?.message || `Groq HTTP ${res.status}`
    const e = new Error(msg)
    e.status = res.status
    throw e
  }
  const data = await res.json()
  const msg = data.choices?.[0]?.message || {}
  const content = String(msg.content || '').trim()
  if (!content) {
    // Empty content (e.g. budget exhausted during thinking) must never render
    // as a blank report ΓÇö let the caller fall back to the built-in text.
    throw new Error('The AI returned an empty response. Please try again.')
  }
  let result = stripThinking(content)
  // Some Qwen3 responses separate the answer with a "final answer:" marker.
  const finalAnswerIdx = result.search(/final\s+answer\s*[:∩╝Ü]/i)
  if (finalAnswerIdx > 0) result = result.slice(finalAnswerIdx).replace(/final\s+answer\s*[:∩╝Ü]/i, '')
  // If result still starts with a thinking phrase, strip leading lines
  if (/^\s*(Okay|Alright|Ok|Sure|Hmm|Well|Let me|I need|I should|I must|I will|First|The user|Looking at|Based on|To answer|To provide|My approach|Step\s*\d)/i.test(result)) {
    result = stripThinking(result)
  }
  return result.trim()
}

// Remove any embedded thinking blocks that may leak into content.
function stripThinking(text) {
  let s = String(text)

  // ΓöÇΓöÇ Step 1: If the response contains <think>...</think>, keep ONLY what comes after </think> ΓöÇΓöÇ
  const afterClose = s.replace(/[\s\S]*?<\/think>\s*/i, '')
  if (afterClose.trim().length > 20) s = afterClose

  // ΓöÇΓöÇ Step 2: Strip explicit thinking containers ΓöÇΓöÇ
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '')
  s = s.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  s = s.replace(/<\/?think>/gi, '')
  s = s.replace(/```thinking[\s\S]*?```/gi, '')
  s = s.replace(/```\s*think[\s\S]*?```/gi, '')

  // ΓöÇΓöÇ Step 3: Strip Qwen-specific reasoning patterns ΓöÇΓöÇ
  // "Here's a thinking process:" followed by numbered reasoning
  s = s.replace(/^Here'?s?\s+a\s+thinking\s+process[\s\S]*$/im, '')
  // "thinking:" prefix
  s = s.replace(/^thinking:\s*[\s\S]*?\n{2,}/im, '')

  // ΓöÇΓöÇ Step 4: Strip common reasoning openers (greedy ΓÇö consume everything until double-newline) ΓöÇΓöÇ
  const openers = [
    /^\s*(Okay|Alright|Ok|Sure|Hmm|Well|Let's see|Now)[\s,\.]+.{0,20}?\n{2,}/im,
    /^\s*Let me\s+(think|consider|analyze|break down|review|examine|look at|go through|work through|reason through|process|start|begin|outline|structure|organize|plan|calculate|compute|determine|evaluate|assess|examine|compare|estimate|measure|figure out|work on|think about|look into|check|verify|validate|confirm|double.check)[\s\S]*?\n{2,}/im,
    /^\s*First[\s,]+I\s+(need|should|must|will|have to|ought to)\s+[\s\S]*?\n{2,}/im,
    /^\s*(I need to|I should|I must|I will|I'll|My approach|My plan|My strategy|To answer|To respond|To address|To provide|To give|To generate|To create|To write|To produce|To draft|To prepare|To formulate|To draft)[\s\S]*?\n{2,}/im,
    /^\s*(The user|The question|Looking at|Based on|From the|Considering|Given the|Reviewing|Analyzing|Examining|Assessing|Evaluating)[\s\S]*?\n{2,}/im,
    /^\s*(Step\s*\d|Phase\s*\d|Part\s*\d)[\s\S]*?\n{2,}/im,
    /^\s*(To|For|In|On|At|With|From|By|As)[\s]+(?:this|the|a|an|my|your|our)\s+(?:question|request|query|problem|task|prompt|input)[\s\S]*?\n{2,}/im,
  ]
  for (const re of openers) s = s.replace(re, '')

  // ΓöÇΓöÇ Step 5: If the first meaningful line looks like reasoning, drop it ΓöÇΓöÇ
  const lines = s.split('\n')
  let startIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (!l) { startIdx = i + 1; continue }
    if (/^(Okay|Alright|Ok|Sure|Hmm|Well|Let me|I need|I should|I must|I will|First|The user|Looking at|Based on|To |For |In |On |Step|Phase|Part)\b/i.test(l)) {
      startIdx = i + 1
      continue
    }
    break
  }
  if (startIdx > 0) s = lines.slice(startIdx).join('\n')

  // ΓöÇΓöÇ Step 6: Clean up orphaned newlines ΓöÇΓöÇ
  s = s.replace(/\n{3,}/g, '\n\n').trim()
  return s
}

async function callGroq(prompt) {
  try {
    return await groqRequest(prompt, null)
  } catch (e) {
    // Model not found or unavailable -> fall back to the next model in the list.
    const modelIssues = e.status === 404 || e.status === 400
      || /model/i.test(e.message || '') || /not found/i.test(e.message || '')
    if (modelIssues && activeModel !== MODELS[MODELS.length - 1]) {
      const idx = MODELS.indexOf(activeModel)
      activeModel = MODELS[idx + 1]
      try {
        return await groqRequest(prompt, null)
      } catch (e2) {
        activeModel = MODELS[0]
        throw e2
      }
    }
    throw e
  }
}

async function callGroqChat(messages) {
  try {
    return await groqRequest(null, messages)
  } catch (e) {
    const modelIssues = e.status === 404 || e.status === 400
      || /model/i.test(e.message || '') || /not found/i.test(e.message || '')
    if (modelIssues && activeModel !== MODELS[MODELS.length - 1]) {
      const idx = MODELS.indexOf(activeModel)
      activeModel = MODELS[idx + 1]
      try {
        return await groqRequest(null, messages)
      } catch (e2) {
        activeModel = MODELS[0]
        throw e2
      }
    }
    throw e
  }
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
  // frontend cache - same month data should not hit Groq again within 30 min
  const cacheKey = `ins:${month}:${year}:${currentMonth.income}:${currentMonth.expense}:${JSON.stringify(currentMonth.categories)}:${previousMonth.income}:${previousMonth.expense}:${hasGroqKey() ? MODEL() : 'nokey'}`
  const cached = getCache(insightsCache, cacheKey)
  if (cached) return cached

  const catText = Object.entries(currentMonth.categories || {})
    .map(([k, v]) => `\u2022 ${k}: ${Number(v).toFixed(2)}`)
    .join('\n') || 'No expenses recorded yet'

  const prompt = `You are a professional financial advisor. Write a concise monthly financial report for ${MONTHS[month]} ${year} based on the data below. Do not use emojis, exclamation marks, or marketing language. Use a calm, analytical tone. CRITICAL: Do NOT include any thinking, reasoning, chain-of-thought, "Let me", "I need to", "Step 1", or any preamble. Output ONLY the final formatted report starting directly with the section headings below. Format as plain text with these sections:

OVERVIEW
- One short paragraph summarizing the month's financial position.

SPENDING ANALYSIS
- Two to three short observations about the spending pattern.
- Compare to the previous month only if previous data is non-zero.

CATEGORY BREAKDOWN
- For each non-zero category in the data, one line: "Category: amount ΓÇö brief comment."

RECOMMENDATIONS
- Three specific, realistic actions to improve next month. Start each line with a dash.

OUTLOOK
- One sentence on what to watch for next month.

Data:
Current month ΓÇö Income: ${currentMonth.income.toFixed(2)}, Expenses: ${currentMonth.expense.toFixed(2)}, Balance: ${(currentMonth.income - currentMonth.expense).toFixed(2)}.
Categories: ${catText}
Previous month ΓÇö Income: ${previousMonth.income.toFixed(2)}, Expenses: ${previousMonth.expense.toFixed(2)}.

Keep total response under 350 words.`

  let insights
  try { insights = await callGroq(prompt) }
  catch (e) { insights = fallbackFor(prompt); console.warn('Groq fallback:', e.message) }
  insights = stripEmoji(insights)

  const topCat = Object.entries(currentMonth.categories || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

  const result = {
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
    model: hasGroqKey() ? MODEL() : '',
  }
  setCache(insightsCache, cacheKey, result)
  return result
}

export async function getSavingsSuggestions(monthlyData) {
  const cacheKey = `sug:${JSON.stringify(monthlyData)}:${hasGroqKey() ? MODEL() : 'nokey'}`
  const cached = getCache(suggestionsCache, cacheKey)
  if (cached) return cached
  const dataText = monthlyData.map(d =>
    `\u2022 Month ${d.month}/${d.year}: Income ${d.income.toFixed(2)}, Expenses ${d.expense.toFixed(2)}, Saved ${(d.income - d.expense).toFixed(2)}`
  ).join('\n')

  const prompt = `You are a professional financial advisor. Write a personalized savings plan based on the data below. Do not use emojis, exclamation marks, or marketing language. Use a calm, analytical tone. CRITICAL: Do NOT include any thinking, reasoning, chain-of-thought, "Let me", "I need to", "Step 1", or any preamble. Output ONLY the final formatted plan starting directly with the section headings below. Format as plain text with these sections:

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
  const result = {
    suggestions,
    analysis_period: `${monthlyData.length} months`,
    average_income: avg(monthlyData.map(d => d.income)),
    average_expense: avg(monthlyData.map(d => d.expense)),
    ai_configured: hasGroqKey(),
    provider: 'groq',
    model: hasGroqKey() ? MODEL() : '',
  }
  setCache(suggestionsCache, cacheKey, result)
  return result
}

export async function chatWithFinancialAssistant(messages) {
  const groqKey = getGroqKey()
  if (!groqKey) throw new Error('Add a Groq API key in Settings to use the Chatbot.')

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || ''

  // --- Fetch local transaction diary (100% local, IndexedDB) ---
  let diaryContext = ""
  try {
    const all = await db.getAllTransactions()
    if (all && all.length) {
      // Take most recent 100, sorted by date desc (getAll already sorted)
      const recent = all.slice(0, 100)
      const totalIncome = recent.filter(t => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0)
      const totalExpense = recent.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
      const lines = recent.map(t => {
        const d = new Date(t.date)
        const ds = isNaN(d.getTime()) ? String(t.date).slice(0, 16) : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        const amt = `${t.type === 'income' ? '+' : '-'}${Math.abs(Number(t.amount)).toFixed(2)} ${t.currency || 'INR'}`
        return `${ds} | ${t.type} | ${t.category} | ${t.name} | ${amt}`
      }).join('\n')
      diaryContext = `[User's Local Transaction Diary - ${all.length} total records, showing last ${recent.length}]:\n` +
        `Summary of shown: Income ${totalIncome.toFixed(2)}, Expense ${totalExpense.toFixed(2)}, Balance ${(totalIncome - totalExpense).toFixed(2)}\n` +
        lines + "\n" +
        `Instruction: Use this diary to answer any question about dates, amounts, categories, where/when/how much. If user asks "5 Sep koto khoroch", filter by that date. Keep data local, never hallucinate. If no matching record, say "Ei tarikhe kono record nei".`
    } else {
      diaryContext = `[User's Local Transaction Diary: No transactions yet. User has not saved any income/expense.]`
    }
  } catch (e) {
    console.warn('Diary fetch failed:', e)
    diaryContext = `[Diary fetch error: ${e.message}]`
  }

  // System prompt to enforce banking/finance + diary assistant rules
  const systemPrompt = `You are a professional Financial & Banking Assistant with access to the user's LOCAL transaction diary.
Your instructions:
1. You must ONLY answer questions related to finance, banking, currency exchange, savings, investments, tax, loans, stock markets, card offers, general economy, AND the user's own transaction diary.
2. You HAVE the user's full diary below. When user asks "koto taka, kobe, kothay, kon category, kon tarikhe" - answer precisely from the diary. Quote date, name, amount, category. Do NOT hallucinate. If diary has no matching record, clearly say you don't have it.
3. If the user asks about coding, programming, web development, general trivia, math (unrelated to finance), science, history, translation (outside finance/diary), politely refuse.
4. You can converse in any language the user speaks (Bengali, English, Hindi). Match user's language.
5. If the user's query requires current real-time financial information (like interest rates, stock prices, exchange rates, banking news, today's rates), utilize the provided search context. If no search context is provided or it doesn't answer, state you don't have real-time access.
6. Do NOT include any thinking, reasoning, chain-of-thought, "Let me", "I need to", or any preamble. Output ONLY the final answer starting directly with the information requested.
7. For greetings (hi, hello, hey), reply briefly and offer to help with diary or finance questions.
8. Keep answers concise, practical, and highly professional. Use simple formatting, no excessive emojis.
`

  // Decide if we should do a web search using Tavily.
  const needsSearch = /rate|interest|current|today|latest|stock|price|news|bank|sbi|hdfc|icici|offer|loan|mortgage|market|yield|fd|rd|crypto|gold/i.test(lastUserMessage)
  
  let searchContext = ""
  const tavilyKey = getTavilyKey()

  if (needsSearch && tavilyKey) {
    try {
      const searchRes = await fetchWithTimeout('https://api.tavily.com/search', {
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
      }, TAVILY_TIMEOUT)
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

  // Combine diary + search context into the last user message
  const combinedContext = [diaryContext, searchContext].filter(Boolean).join('\n\n')

  // Build the message history for Groq
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => {
      if (m.role === 'user' && m.content === lastUserMessage && combinedContext) {
        return { role: 'user', content: `${combinedContext}\n\nUser Question: ${m.content}` }
      }
      return m
    })
  ]

  return callGroqChat(formattedMessages)
}
