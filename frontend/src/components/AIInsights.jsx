import React, { useState, useEffect, useRef } from 'react'
import { BarChartIcon, LightbulbIcon, ZapIcon, BookOpenIcon, TargetIcon, RefreshIcon, SendIcon } from './Icons'
import { getFinancialInsights, getSavingsSuggestions, hasGroqKey, chatWithFinancialAssistant } from '../utils/groq'
import * as db from '../utils/db'
import { requireComplete } from '../utils/finance.js'
import { hasAIConsent } from '../utils/privacy.js'

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

function AIInsights({ month, year, symbol, currency = 'INR', ledgerRevision = 0, credentialRevision = 0, isActive = true }) {
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
    const updated = [...chatMessages, userMsg].slice(-24)
    setChatMessages(updated)
    setChatInput('')
    setSendingChat(true)
    try {
      const response = await chatWithFinancialAssistant(updated, { currency })
      setChatMessages([...updated, { role: 'assistant', content: response }])
    } catch (errVal) {
      setChatMessages([...updated, { role: 'assistant', content: `Error: ${errVal.message || 'Something went wrong.'}` }])
    } finally {
      setSendingChat(false)
    }
  }

  // Abort previous load if month/year changes quickly
  const loadAbortRef = useRef(null)
  const load = async (force = false) => {
    if (loadAbortRef.current) loadAbortRef.current.aborted = true
    const token = { aborted: false }
    loadAbortRef.current = token
    setLoadingInsights(true)
    setLoadingSuggestions(true)
    setErr('')
    setInsights(null)
    setSuggestions(null)
    try {
      // Fully parallel: current + previous + 6-month buckets in one go (was serial waterfall)
      const [cur, prev, sug] = await Promise.all([
        buildCurrentData(month, year, currency),
        buildPreviousData(month, year, currency),
        db.getMonthlyBuckets(6, currency, month, year),
      ])
      if (token.aborted) return
      const [i, s] = await Promise.all([
        getFinancialInsights(cur, prev, month, year, { force: force === true, currency }),
        getSavingsSuggestions(sug, { force: force === true, currency }),
      ])
      if (token.aborted) return
      setInsights(i)
      setSuggestions(s)
    } catch (e) {
      if (token.aborted) return
      setErr(e.message || 'Failed to load AI data')
      console.error('AI load failed:', e)
    } finally {
      if (!token.aborted) {
        setLoadingInsights(false)
        setLoadingSuggestions(false)
      }
    }
  }

  useEffect(() => {
    if (isActive) load()
    return () => { if (loadAbortRef.current) loadAbortRef.current.aborted = true }
  }, [month, year, currency, ledgerRevision, credentialRevision, isActive])

  const isLoading = activeView === 'insights' ? loadingInsights : (activeView === 'suggestions' ? loadingSuggestions : false)

  return (
    <div className="ai-insights surface">
      <div className="ai-header">
        <div>
          <h2>AI Financial Advisor</h2>
          <p>
            {insights?.ai_configured
              ? 'Personalized analysis powered by ' + (insights.model || 'Groq')
              : (insights?.error || 'Built-in tips. Add a Groq key and enable AI data sharing in Settings for personalized analysis.')}
          </p>
        </div>
        <button className="refresh-btn" onClick={() => load(true)} disabled={isLoading}>
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
                    <div className="chat-message-bubble thinking-label">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      <span>Thinking...</span>
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
                  maxLength={2000}
                  disabled={sendingChat || !hasGroqKey() || !hasAIConsent()}
                />
                <button type="submit" disabled={sendingChat || !chatInput.trim() || !hasGroqKey() || !hasAIConsent()}>
                  <SendIcon />
                  <span className="send-btn-text">Send</span>
                </button>
              </form>
              {(!hasGroqKey() || !hasAIConsent()) && (
                <div className="chat-no-key-warning">
                  Add your Groq key and enable AI data sharing in Settings to use chat. Recent transaction details are sent with your question.
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

async function buildCurrentData(month, year, currency) {
  const data = await db.getMonthOverview(month, year, currency)
  const summary = requireComplete(data.summary)
  return { income: summary.total_income, expense: summary.total_expense, categories: Object.fromEntries(data.categories.map(c => [c.category, c.total])), currency }
}

async function buildPreviousData(month, year, currency) {
  const pm = month > 1 ? month - 1 : 12
  const py = month > 1 ? year : year - 1
  return buildCurrentData(pm, py, currency)
}

export default AIInsights
