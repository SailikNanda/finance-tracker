import { canDownloadInApp, saveFileBase64 } from './apkUpdater.js'

export async function saveBlob(blob, fileName, mimeType = blob.type) {
  if (canDownloadInApp()) {
    if (blob.size > 20 * 1024 * 1024) throw new Error('Export exceeds the 20 MB Android transfer limit. Use JSON backup or export from a browser.')
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1])
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    await saveFileBase64(base64, fileName, mimeType)
    return 'downloads'
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'browser'
}
