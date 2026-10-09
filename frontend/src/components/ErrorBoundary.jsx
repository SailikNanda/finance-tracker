import React from 'react'

export default class ErrorBoundary extends React.Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return (
      <main className="settings surface" role="alert">
        <h2>Finera could not display this screen</h2>
        <p>Your saved transactions remain on this device. Reload to try again.</p>
        <button className="update-btn" onClick={() => window.location.reload()}>Reload app</button>
      </main>
    )
    return this.props.children
  }
}
