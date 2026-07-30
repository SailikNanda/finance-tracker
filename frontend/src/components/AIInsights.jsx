import React, { useState, useEffect, useRef } from 'react'
import { BarChartIcon, LightbulbIcon, ZapIcon, BookOpenIcon, TargetIcon, RefreshIcon, SendIcon } from './Icons'
import { getFinancialInsights, getSavingsSuggestions, hasGroqKey, chatWithFinancialAssistant } from '../utils/groq'
import * as db from '../utils/db'

function ReportView({ text }) {
  if (!text) return null
  const sections = []
  const lines = text.split('\n')
  let current = { heading: null, body: [] }
  const isHeading = (l) => /^[A-Z][A-Z\s\-/&]{2,40}$/.test(l.trim())
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (isHeading(line)) {
      if (current.heading || current.body.length) sections.push(current)
      current = { heading: line.trim(), body: [] }
    } else if (line.trim()) {
      current.body.push(line)
    } else if (current.body.length) {
      current.body.push('')
    }
  }
  if (current.heading || current.body.length) sections.push(current)

  return (
    <div className="ai-report">
      {sections.map((s, i) => (
        <div className="ai-report__section" key={i}>
          {s.heading && <h4 className="ai-report__heading">{s.heading}</h4>}
          {s.body.map((para, j) => {
            const t = para.trim()
            if (!t) return <div key={j} className="ai-report__spacer" />
            if (/^[-*\u2022]\s+/.test(t)) {
              return (
                <div key={j} className="ai-report__bullet">
                  <span className="ai-report__dot" />
                  <span>{t.replace(/^[-*\u2022]\s+/, '')}</span>
                </div>
              )
            }
            return <p key={j} className="ai-report__para">{t}</p>
          })}
        </div>
      ))}
    </div>
  )
}

function AIInsights({ month, year, symbol }) {
  const [insights, setInsights] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [activeView, setActiveView] = useState('insights')
  const [err, setErr] = useState('')

  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your AI Financial Assistant. Ask me anything about banking, savings, loans, or stock markets. (I can search the web for real-time rates!)' }
  ])
  const [chatInput, setChatInput] = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    if (activeView === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, activeView])

  const handleSendChat = async (e) => {
    e.preventDefault()
    if (!chatInput.trim() || sendingChat) return
    const userMsg = { role: 'user', content: chatInput.trim() }
    const updated = [...chatMessages, userMsg]
    setChatMessages(updated)
    setChatInput('')
    setSendingChat(true)
    try {
      const response = await chatWithFinancialAssistant(updated)
      setChatMessages([...updated, { role: 'assistant', content: response }])
    } catch (errVal) {
      setChatMessages([...updated, { role: 'assistant', content: `Error: ${errVal.message || 'Something went wrong.'}` }])
    } finally {
      setSendingChat(false)
    }
  }

  const load = async () => {
    setLoadingInsights(true)
    setLoadingSuggestions(true)
    setErr('')
    try {
      const [cur, sug] = await Promise.all([
        buildCurrentData(month, year),
        buildMonthlyData(),
      ])
      const prev = await buildPreviousData(month, year)
      const [i, s] = await Promise.all([
        getFinancialInsights(cur, prev, month, year),
        getSavingsSuggestions(sug),
      ])
      setInsights(i)
      setSuggestions(s)
    } catch (e) {
      setErr(e.message || 'Failed to load AI data')
      console.error('AI load failed:', e)
    } finally {
      setLoadingInsights(false)
      setLoadingSuggestions(false)
    }
  }

  useEffect(() => { load() }, [month, year])

  const isLoading = activeView === 'insights' ? loadingInsights : (activeView === 'suggestions' ? loadingSuggestions : false)

  return (
    <div className="ai-insights surface">
      <div className="ai-header">
        <div>
          <h2>AI Financial Advisor</h2>
          <p>
            {insights?.ai_configured
              ? 'Personalized analysis powered by ' + (insights.model || 'Groq')
              : 'Showing built-in tips. Add a free Groq API key in Settings to unlock live AI analysis.'}
          </p>
        </div>
        <button className="refresh-btn" onClick={load} disabled={isLoading}>
          <RefreshIcon />
          <span>Refresh</span>
        </button>
      </div>

      <div className="ai-nav">
        <button
          type="button"
          className={`ai-nav-btn ${activeView === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveView('insights')}
        >
          <BarChartIcon /> <span>Insights</span>
        </button>
        <button
          type="button"
          className={`ai-nav-btn ${activeView === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveView('suggestions')}
        >
          <LightbulbIcon /> <span>Tips</span>
        </button>
        <button
          type="button"
          className={`ai-nav-btn ${activeView === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveView('chat')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Chat</span>
        </button>
      </div>

      {err && <div className="error-message" role="alert">{err}</div>}

      {isLoading ? (
        <div className="loading">
          <div className="spinner" />
          <span>Analyzing your finances...</span>
        </div>
      ) : (
        <>
          {activeView === 'insights' && (
            <div className="ai-card">
              {insights ? (
                <>
                  <div className="ai-card-head">
                    <h3>{insights.month} {insights.year} Analysis</h3>
                    <div className="ai-pills">
                      <span className="ai-pill ai-pill--green">
                        <span className="ai-pill-label">Income</span>
                        <span className="ai-pill-value">{symbol}{insights.highlights.income.toFixed(2)}</span>
                      </span>
                      <span className="ai-pill ai-pill--red">
                        <span className="ai-pill-label">Spent</span>
                        <span className="ai-pill-value">{symbol}{insights.highlights.expenses.toFixed(2)}</span>
                      </span>
                      <span className="ai-pill ai-pill--blue">
                        <span className="ai-pill-label">Saved</span>
                        <span className="ai-pill-value">{symbol}{insights.highlights.savings.toFixed(2)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="ai-card-body">
                    <ReportView text={insights.insights} />
                  </div>
                </>
              ) : (
                <div className="empty-state empty-state--inline">
                  <h3>No insights yet</h3>
                  <p>Add some transactions for this month to generate insights.</p>
                </div>
              )}
            </div>
          )}

          {activeView === 'suggestions' && (
            <div className="ai-card">
              {suggestions ? (
                <>
                  <div className="ai-card-head">
                    <h3>Personalized Savings Tips</h3>
                    <div className="ai-pills">
                      <span className="ai-pill ai-pill--green">
                        <span className="ai-pill-label">Avg income</span>
                        <span className="ai-pill-value">{symbol}{suggestions.average_income.toFixed(2)}</span>
                      </span>
                      <span className="ai-pill ai-pill--red">
                        <span className="ai-pill-label">Avg spent</span>
                        <span className="ai-pill-value">{symbol}{suggestions.average_expense.toFixed(2)}</span>
                      </span>
                      <span className="ai-pill ai-pill--purple">
                        <span className="ai-pill-label">Window</span>
                        <span className="ai-pill-value">{suggestions.analysis_period}</span>
                      </span>
                    </div>
                  </div>
                  <div className="ai-card-body">
                    <ReportView text={suggestions.suggestions} />
                  </div>
                </>
              ) : (
                <div className="empty-state empty-state--inline">
                  <h3>No tips yet</h3>
                  <p>Track transactions for a few months to receive tips.</p>
                </div>
              )}
            </div>
          )}

          {activeView === 'chat' && (
            <div className="ai-card chat-card">
              <div className="ai-card-head">
                <h3>Financial Chat Assistant</h3>
                <p>Ask about banking terms, current interest rates, or generic saving strategies.</p>
              </div>
              <div className="chat-messages-container">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`chat-message chat-message--${msg.role}`}>
                    <div className="chat-message-bubble">
                      {msg.content}
                    </div>
                  </div>
                ))}
                {sendingChat && (
                  <div className="chat-message chat-message--assistant typing">
                    <div className="chat-message-bubble">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendChat} className="chat-input-form">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={sendingChat ? "AI is typing..." : "Type your financial question..."}
                  disabled={sendingChat || !insights?.ai_configured}
                />
                <button type="submit" disabled={sendingChat || !chatInput.trim() || !insights?.ai_configured}>
                  <SendIcon />
                  <span className="send-btn-text">Send</span>
                </button>
              </form>
              {!insights?.ai_configured && (
                <div className="chat-no-key-warning">
                  Add your Groq API key in Settings to use the Financial Chat.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeView !== 'chat' && (
        <div className="ai-features">
          <div className="feature-card">
            <div className="feature-icon"><ZapIcon /></div>
            <h4>Smart tracking</h4>
            <p>Categorize spending automatically</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><BookOpenIcon /></div>
            <h4>Trend analysis</h4>
            <p>Track month-over-month changes</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><TargetIcon /></div>
            <h4>Proactive tips</h4>
            <p>Save more with custom advice</p>
          </div>
        </div>
      )}
    </div>
  )
}

async function buildCurrentData(month, year) {
  const list = await db.getTransactions(month, year)
  const cats = await db.getCategories(month, year)
  const categories = {}
  for (const c of cats) categories[c.category] = c.total
  let income = 0, expense = 0
  for (const r of list) {
    if (r.amount > 0) income += r.amount
    else expense += Math.abs(r.amount)
  }
  return { income, expense, categories, transactions: list }
}

async function buildPreviousData(month, year) {
  const pm = month > 1 ? month - 1 : 12
  const py = month > 1 ? year : year - 1
  const list = await db.getTransactions(pm, py)
  let income = 0, expense = 0
  for (const r of list) {
    if (r.amount > 0) income += r.amount
    else expense += Math.abs(r.amount)
  }
  return { income, expense }
}

async function buildMonthlyData() {
  const all = await db.getAllTransactions()
  const buckets = new Map()
  for (const r of all) {
    const k = `${r.year}-${String(r.month).padStart(2, '0')}`
    const b = buckets.get(k) || { month: r.month, year: r.year, income: 0, expense: 0 }
    if (r.amount > 0) b.income += r.amount
    else b.expense += Math.abs(r.amount)
    buckets.set(k, b)
  }
  const sorted = Array.from(buckets.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month))
  return sorted.slice(0, 6)
}

export default AIInsights
