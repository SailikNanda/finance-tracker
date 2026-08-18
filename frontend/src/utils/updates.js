// GitHub-based update checker.
// The app queries the GitHub Releases API of the configured repo.
// When the developer pushes a new tag with an APK asset, users see an
// "Update available" button and can download + install the new APK in-app.

const REPO = (import.meta.env.VITE_GITHUB_REPO || '').trim()
const CACHE_KEY = 'ft_update_check'
const CACHE_TTL = 60 * 60 * 1000 // re-check every hour max

export function hasUpdateRepo() {
  return !!REPO
}

export function getRepo() {
  return REPO
}

export function getCurrentVersion() {
  const v = import.meta.env.VITE_APP_VERSION || '2.0.0'
  return String(v).replace(/^v/i, '')
}

function parseVersion(v) {
  const parts = String(v).replace(/^v/i, '').split(/[._-]/).map(n => parseInt(n, 10))
  while (parts.length < 3) parts.push(0)
  return parts.map(n => (Number.isFinite(n) ? n : 0))
}

// Returns > 0 if a > b, < 0 if a < b, 0 if equal.
export function compareVersions(a, b) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} } }
function writeCache(obj) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(obj)) } catch {} }

export async function checkForUpdates({ force = false } = {}) {
  if (!REPO) {
    return { updateAvailable: false, reason: 'no-repo', currentVersion: getCurrentVersion() }
  }

  const cache = readCache()
  if (!force && cache.checkedAt && Date.now() - cache.checkedAt < CACHE_TTL) {
    const cached = { ...cache.payload, fromCache: true }
    cached.currentVersion = getCurrentVersion()
    cached.updateAvailable = compareVersions(cached.latestVersion || '', cached.currentVersion) > 0
    cached.reason = cached.updateAvailable ? 'new-version' : 'up-to-date'
    return cached
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (res.status === 404) {
      return { updateAvailable: false, reason: 'no-release', currentVersion: getCurrentVersion() }
    }
    if (!res.ok) {
      throw new Error(`GitHub HTTP ${res.status}`)
    }
    const release = await res.json()
    const apkAsset = (release.assets || []).find(a =>
      /\.apk$/i.test(a.name || '') && a.browser_download_url
    )
    if (!apkAsset) {
      return { updateAvailable: false, reason: 'no-apk', currentVersion: getCurrentVersion() }
    }

    const latest = String(release.tag_name || '').replace(/^v/i, '')
    const current = getCurrentVersion()
    const updateAvailable = compareVersions(latest, current) > 0

    const payload = {
      updateAvailable,
      reason: updateAvailable ? 'new-version' : 'up-to-date',
      currentVersion: current,
      latestVersion: latest,
      url: apkAsset.browser_download_url,
      size: apkAsset.size || 0,
      publishedAt: release.published_at || null,
      name: release.name || `v${latest}`,
      body: release.body || '',
    }
    cache.checkedAt = Date.now()
    cache.payload = payload
    writeCache(cache)
    return payload
  } catch (e) {
    console.warn('Update check failed:', e)
    return { updateAvailable: false, reason: 'error', currentVersion: getCurrentVersion(), error: e.message }
  }
}

export function clearUpdateCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}

export function formatSize(bytes) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}