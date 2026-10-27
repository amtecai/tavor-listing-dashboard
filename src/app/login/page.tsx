'use client'
import { useState } from 'react'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) })
    setBusy(false)
    if (!res.ok) return setError((await res.json()).error ?? 'Could not sign in')
    const next = new URLSearchParams(location.search).get('next') || '/'
    location.href = next.startsWith('/') ? next : '/'
  }
  return (
    <main className="login">
      <form onSubmit={submit}>
        <img src="/brand/wordmark.png" alt="Tavor Partners" style={{ width: 140 }} />
        <h1 className="serif" style={{ fontSize: 26 }}>Property summaries</h1>
        <label>
          <span className="label">Team password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy || !password} style={{ justifyContent: 'center' }}>
          {busy && <span className="spinner" />} Sign in
        </button>
      </form>
    </main>
  )
}
