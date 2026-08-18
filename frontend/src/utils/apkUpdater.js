// JS bridge to the native ApkUpdaterPlugin (Android download + install).

function getPlugin() {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      return window.Capacitor.Plugins?.ApkUpdater || null
    }
  } catch {}
  return null
}

export function canDownloadInApp() {
  return !!getPlugin()
}

export async function downloadApk(url) {
  const plugin = getPlugin()
  if (!plugin) throw new Error('In-app download is only available on Android')
  const res = await plugin.download({ url })
  return { downloadId: res.downloadId, filePath: res.filePath }
}

export async function getDownloadStatus(downloadId) {
  const plugin = getPlugin()
  if (!plugin) throw new Error('In-app download is only available on Android')
  return plugin.getDownloadStatus({ downloadId })
}

export async function installApk(filePath) {
  const plugin = getPlugin()
  if (!plugin) throw new Error('In-app install is only available on Android')
  return plugin.install({ filePath })
}

export async function saveFileBase64(base64, fileName) {
  const plugin = getPlugin()
  if (!plugin) throw new Error('Native file saving is only available on Android')
  return plugin.saveFile({ base64, fileName })
}

export function pollDownload(downloadId, onProgress, intervalMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const st = await getDownloadStatus(downloadId)
        if (typeof onProgress === 'function') onProgress(st)
        if (st.finished) {
          clearInterval(timer)
          if (st.status === 'successful') resolve(st)
          else reject(new Error(`Download failed (${st.status})`))
        }
      } catch (e) {
        clearInterval(timer)
        reject(e)
      }
    }, intervalMs)
  })
}