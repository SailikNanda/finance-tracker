import { Capacitor, registerPlugin } from '@capacitor/core'

const vault = registerPlugin('CredentialVault')
const values = { groq: '', tavily: '' }
const legacy = { groq: 'ft_groq_api_key', tavily: 'ft_tavily_api_key' }
let sessionOnly = !Capacitor.isNativePlatform()
let generation = 0
export const getCredentialRevision = () => generation
export const usesSessionKeys = () => sessionOnly
export const getCredential = provider => values[provider] || ''

function changed() {
  generation++
  globalThis.dispatchEvent?.(new Event('finera-credentials-change'))
}

export async function initializeCredentials() {
  if (Capacitor.isNativePlatform()) {
    const stored = await vault.read()
    sessionOnly = !!stored.sessionOnly
    Object.assign(values, stored.values || {})
  }
  for (const provider of Object.keys(values)) {
    let old = ''
    try { old = localStorage.getItem(legacy[provider]) || '' } catch {}
    if (old && !values[provider]) await setCredential(provider, old)
    // Delete plaintext only after a successful encrypted write/memory migration.
    try { localStorage.removeItem(legacy[provider]) } catch {}
  }
  changed()
}

export async function setCredential(provider, key) {
  if (!Object.prototype.hasOwnProperty.call(values, provider)) throw new Error('Unknown credential provider')
  const value = String(key || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '')
  if (!sessionOnly) await vault.write({ provider, value })
  values[provider] = value
  try { localStorage.removeItem(legacy[provider]) } catch {}
  changed()
}
