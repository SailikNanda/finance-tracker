const KEY = 'ft_ai_data_consent'
export function hasAIConsent() {
  try { return localStorage.getItem(KEY) === 'yes' } catch { return false }
}
export function setAIConsent(enabled) {
  localStorage.setItem(KEY, enabled ? 'yes' : 'no')
  globalThis.dispatchEvent?.(new Event('finera-credentials-change'))
}
export function requireAIConsent() {
  if (!hasAIConsent()) throw new Error('Enable AI data sharing in Settings before sending financial data to Groq or chat searches to Tavily.')
}
