// GitHub-based update checker.
// The app queries the GitHub Releases API of the configured repo.
// When the developer pushes a new tag with an APK asset, users see an
// "Update available" button and can download + install the new APK in-app.

const REPO = (import.meta.env.VITE_GITHUB_REPO || '').trim()
const CACHE_KEY = 'ft_update_check'
const CACHE_TTL = 5 * 60 * 1000 // re-check every 5 min max

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

  if (force) {
    clearUpdateCache()
  } else {
    const cache = readCache()
    if (cache.checkedAt && Date.now() - cache.checkedAt < CACHE_TTL) {
      const cached = { ...cache.payload, fromCache: true }
      cached.currentVersion = getCurrentVersion()
      cached.updateAvailable = compareVersions(cached.latestVersion || '', cached.currentVersion) > 0
      cached.reason = cached.updateAvailable ? 'new-version' : 'up-to-date'
      return cached
    }
  }

  try {
    const current = getCurrentVersion()
    const ts = Date.now()

    // 1) Query /releases/latest first with no-store cache control
    let release = null
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest?_t=${ts}`, {
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json' },
      })
      if (res.ok) {
        release = await res.json()
      }
    } catch (err) {
      console.warn('Failed to fetch releases/latest:', err)
    }

    // 2) If latest is missing, or not newer, check /releases list (catches recently published releases that CDN hasn't marked latest yet)
    let candidateRelease = release
    const latestVersion = release ? String(release.tag_name || '').replace(/^v/i, '') : ''
    const latestIsNewer = latestVersion ? compareVersions(latestVersion, current) > 0 : false

    if (!latestIsNewer) {
      try {
        const listRes = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=5&_t=${ts}`, {
          cache: 'no-store',
          headers: { Accept: 'application/vnd.github+json' },
        })
        if (listRes.ok) {
          const list = await listRes.json()
          if (Array.isArray(list) && list.length > 0) {
            for (const r of list) {
              if (r.draft || r.prerelease) continue
              const rVer = String(r.tag_name || '').replace(/^v/i, '')
              const hasApk = (r.assets || []).some(a => /\.apk$/i.test(a.name || ''))
              if (hasApk && compareVersions(rVer, current) > 0) {
                candidateRelease = r
                break
              }
            }
          }
        }
      } catch (e) {
        console.warn('Fallback releases list fetch failed:', e)
      }
    }

    if (!candidateRelease) {
      return { updateAvailable: false, reason: 'up-to-date', currentVersion: current }
    }

    const apkAsset = (candidateRelease.assets || []).find(a =>
      /\.apk$/i.test(a.name || '') && a.browser_download_url
    )
    if (!apkAsset) {
      return { updateAvailable: false, reason: 'no-apk', currentVersion: current }
    }

    const shaAsset = (candidateRelease.assets || []).find(a =>
      /\.sha256$/i.test(a.name || '') && a.browser_download_url
    )

    const resolvedLatest = String(candidateRelease.tag_name || '').replace(/^v/i, '')
    const updateAvailable = compareVersions(resolvedLatest, current) > 0

    const payload = {
      updateAvailable,
      reason: updateAvailable ? 'new-version' : 'up-to-date',
      currentVersion: current,
      latestVersion: resolvedLatest,
      url: apkAsset.browser_download_url,
      checksumUrl: shaAsset ? shaAsset.browser_download_url : null,
      size: apkAsset.size || 0,
      publishedAt: candidateRelease.published_at || null,
      name: candidateRelease.name || `v${resolvedLatest}`,
      body: candidateRelease.body || '',
    }

    writeCache({ checkedAt: Date.now(), payload })
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