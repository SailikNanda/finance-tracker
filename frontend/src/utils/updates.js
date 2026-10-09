import { APP_VERSION } from './version.js'
const REPO = (import.meta.env?.VITE_GITHUB_REPO || 'SailikNanda/finance-tracker').trim()
const CACHE_KEY = 'ft_update_check'
const CACHE_TTL = 5 * 60 * 1000
export const hasUpdateRepo = () => /^[\w.-]+\/[\w.-]+$/.test(REPO)
export const getRepo = () => REPO
export const getCurrentVersion = () => APP_VERSION.replace(/^v/i, '')

export function compareVersions(a, b) {
  const parse = value => String(value).replace(/^v/i, '').split('.').map(Number)
  const aa = parse(a), bb = parse(b)
  for (let index = 0; index < 3; index++) {
    const diff = (aa[index] || 0) - (bb[index] || 0)
    if (diff) return diff
  }
  return 0
}

export function isTrustedReleaseURL(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com' && !parsed.port && !parsed.username && !parsed.password && !parsed.search && !parsed.hash && parsed.pathname.startsWith(`/${REPO}/releases/download/`)
  } catch { return false }
}

async function getJSON(path) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`)
    return await response.json()
  } finally { clearTimeout(timeout) }
}

export async function checkForUpdates({ force = false } = {}) {
  const currentVersion = getCurrentVersion()
  if (!hasUpdateRepo()) return { updateAvailable: false, reason: 'no-repo', currentVersion }
  if (!force) {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
      if (cache.repo === REPO && Date.now() - cache.checkedAt < CACHE_TTL && cache.payload.latestVersion) {
        const updateAvailable = compareVersions(cache.payload.latestVersion, currentVersion) > 0
        return { ...cache.payload, currentVersion, updateAvailable, reason: updateAvailable ? 'new-version' : 'up-to-date', fromCache: true }
      }
    } catch {}
  }
  try {
    // A failed lookup is an error, never evidence that the app is current.
    let release
    try { release = await getJSON('releases/latest') } catch { release = null }
    let list = []
    if (!release || compareVersions(release.tag_name, currentVersion) <= 0) {
      const result = await getJSON('releases?per_page=20')
      if (result && !Array.isArray(result)) throw new Error('Invalid release response')
      list = result || []
    }
    const releases = [release, ...list].filter(row => row && !row.draft && !row.prerelease && /^v?\d+\.\d+\.\d+$/.test(row.tag_name || ''))
      .sort((a, b) => compareVersions(b.tag_name, a.tag_name))
    const candidate = releases[0]
    if (!candidate) return { updateAvailable: false, reason: 'no-release', currentVersion }
    const asset = (candidate.assets || []).find(row => /\.apk$/i.test(row.name || '') && isTrustedReleaseURL(row.browser_download_url))
    if (!asset) return { updateAvailable: false, reason: 'no-apk', currentVersion }
    const sha = (candidate.assets || []).find(row => row.name === `${asset.name}.sha256` && isTrustedReleaseURL(row.browser_download_url))
    const latestVersion = candidate.tag_name.replace(/^v/i, '')
    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0
    const payload = {
      updateAvailable, reason: updateAvailable ? 'new-version' : 'up-to-date', currentVersion, latestVersion,
      url: asset.browser_download_url, checksumUrl: sha?.browser_download_url || null,
      sha256: /^sha256:[a-f\d]{64}$/i.test(asset.digest || '') ? asset.digest.slice(7).toLowerCase() : null,
      size: asset.size || 0, publishedAt: candidate.published_at, name: candidate.name, body: candidate.body || '',
    }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ repo: REPO, checkedAt: Date.now(), payload })) } catch {}
    return payload
  } catch (error) { return { updateAvailable: false, reason: 'error', currentVersion, error: error.message || 'Update check failed' } }
}

export async function getUpdateChecksum(info) {
  if (/^[a-f\d]{64}$/i.test(info.sha256 || '')) return info.sha256.toLowerCase()
  if (!isTrustedReleaseURL(info.checksumUrl)) throw new Error('This release has no verifiable SHA-256 checksum. Contact the developer before installing it.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(info.checksumUrl, { signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new Error('Could not retrieve the update checksum')
    const text = await response.text()
    const hash = text.trim().match(/^([a-f\d]{64})(?:\s|$)/i)?.[1]
    if (!hash) throw new Error('Invalid update checksum')
    return hash.toLowerCase()
  } finally { clearTimeout(timer) }
}
export function clearUpdateCache() { try { localStorage.removeItem(CACHE_KEY) } catch {} }
export function formatSize(bytes) {
  if (!bytes) return ''
  const mb = bytes / 1048576
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
