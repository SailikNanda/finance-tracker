const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow
let backendProcess

function pickPython() {
  const candidates = process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python']
  return candidates
}

function startBackend() {
  const backendPath = path.join(__dirname, '..', 'backend', 'app.py')
  const fs = require('fs')
  if (!fs.existsSync(backendPath)) {
    console.error('Backend app.py not found at:', backendPath)
    createWindow()
    return
  }
  const candidates = pickPython()
  let attempt = 0

  const trySpawn = () => {
    if (attempt >= candidates.length) {
      console.error('Could not find a Python interpreter. Tried:', candidates.join(', '))
      console.error('Install Python 3.10+ from https://python.org and restart the app.')
      createWindow()
      return
    }
    const cmd = candidates[attempt++]
    console.log(`Starting backend with: ${cmd} ${backendPath}`)
    try {
      backendProcess = spawn(cmd, [backendPath], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..', 'backend'),
        windowsHide: true,
      })
      backendProcess.on('error', (err) => {
        if (err.code === 'ENOENT') {
          trySpawn()
        } else {
          console.error('Failed to start backend:', err)
        }
      })
      backendProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.error(`Backend exited with code ${code}`)
        }
      })
    } catch (err) {
      console.error('Failed to spawn backend:', err)
      trySpawn()
    }
  }

  trySpawn()
  setTimeout(createWindow, 3000)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#07070d',
    title: 'Finance Tracker',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  const isDev = process.env.NODE_ENV === 'development'
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'))
  }

  mainWindow.setMenuBarVisibility(false)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  startBackend()
})

app.on('window-all-closed', () => {
  if (backendProcess) {
    try { backendProcess.kill() } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  if (backendProcess) {
    try { backendProcess.kill() } catch {}
  }
})
