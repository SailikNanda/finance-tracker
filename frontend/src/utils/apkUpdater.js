import { Capacitor, registerPlugin } from '@capacitor/core'
import { isTrustedReleaseURL } from './updates.js'
const updater = registerPlugin('ApkUpdater')
const plugin = () => Capacitor.isNativePlatform() ? updater : null
export const canDownloadInApp = () => !!plugin()
export async function canInstallUnknownApps() {
  if (!plugin()) return false
  return !!(await updater.canInstallUnknownApps()).allowed
}
export async function downloadApk(url) {
  if (!plugin()) throw new Error('In-app download is only available on Android')
  if (!isTrustedReleaseURL(url)) throw new Error('Untrusted APK download URL')
  return updater.download({ url })
}
export async function getDownloadStatus(downloadId) {
  if (!plugin()) throw new Error('In-app download is only available on Android')
  return updater.getDownloadStatus({ downloadId })
}
export async function installApk(filePath, sha256) {
  if (!plugin()) throw new Error('In-app install is only available on Android')
  if (!/^[a-f\d]{64}$/i.test(sha256 || '')) throw new Error('Missing verified update checksum')
  return updater.install({ filePath, sha256 })
}
export async function saveFileBase64(base64, fileName, mimeType = 'application/pdf') {
  if (!plugin()) throw new Error('Native file saving is only available on Android')
  return updater.saveFile({ base64, fileName, mimeType })
}
export async function cancelDownload(downloadId) {
  if (plugin()) await updater.cancelDownload({ downloadId })
}

export async function pollDownload(downloadId, onProgress, intervalMs = 2000, { signal, timeoutMs = 10 * 60 * 1000, getStatus = getDownloadStatus } = {}) {
  const started = Date.now()
  while (true) {
    if (signal?.aborted) throw new Error('Download cancelled')
    if (Date.now() - started > timeoutMs) throw new Error('Download timed out. Please retry.')
    const status = await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
      const abort = () => { cleanup(); reject(new Error('Download cancelled')) }
      const timer = setTimeout(() => { cleanup(); reject(new Error('Download status timed out. Please retry.')) }, Math.max(1, Math.min(30000, timeoutMs - (Date.now() - started))))
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) { abort(); return }
      Promise.resolve().then(() => getStatus(downloadId)).then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
    })
    onProgress?.(status)
    if (status.status === 'unknown') throw new Error('Download no longer exists. Please retry.')
    if (status.finished) {
      if (status.status === 'successful') return status
      throw new Error(`Download failed (${status.status})`)
    }
    await new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new Error('Download cancelled')) }
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, intervalMs)
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) abort()
    })
  }
}
