import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { initializeCredentials } from './utils/credentials.js'
import './styles/global.css'
import './styles/animations.css'

const root = ReactDOM.createRoot(document.getElementById('root'))
initializeCredentials().then(() => root.render(
  <React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>
)).catch(() => root.render(
  <React.StrictMode><ErrorBoundary><App startupWarning="Secure API key storage could not be opened. Your ledger is available and saved keys have not been deleted. Restart after unlocking the device to retry." /></ErrorBoundary></React.StrictMode>
))
