'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Shell } from '@/components/Shell'
import { STEPS } from '@/lib/types'

type Item = { id: string; url: string; status: string; step: string; error: string | null; title: string; hero: string | null; share_slug: string | null; versions: number; updated_at: string }

const stepLabel = (key: string) => STEPS.find((s) => s.key === key)?.label ?? key
const when = (iso: string) => new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function Home() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<Item[] | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/listings').then((r) => r.json()).then((d) => alive && Array.isArray(d) && setItems(d)).catch(() => {})
    load()
    const t = setInterval(load, 8000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  async function start(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/listings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
    const body = await res.json()
    if (!res.ok) { setBusy(false); return setError(body.error ?? 'Could not start') }
    location.href = `/summaries/${body.id}`
  }

  return (
    <Shell>
      <h1 className="serif hero-title">Property Opportunity Summary</h1>
      <p className="lead">Paste a realcommercial.com.au link. In a few minutes you get a Tavor summary with zoning, transport, an aerial, demographics and nearby developments, ready to edit and send.</p>
      <form className="paste" onSubmit={start}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.realcommercial.com.au/for-sale/property-…" aria-label="Listing link" />
        <button className="btn primary" disabled={busy || !url.trim()}>{busy && <span className="spinner" />} Create summary</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="flow">
        <div><b>1. Read</b>The listing, photos and floor plan</div>
        <div><b>2. Enrich</b>Zoning, transport, aerial, ABS data, developments</div>
        <div><b>3. Edit</b>Change details, or ask Claude to redesign</div>
        <div><b>4. Send</b>Download the PDF or share a hosted link</div>
      </div>

      <h2 className="serif section-title">Recent summaries</h2>
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="empty-state">No summaries yet. Paste a listing link above to make the first one.</div>
      ) : (
        <div className="list">
          {items.map((it, i) => (
            <Link key={it.id} className="row-link" href={`/summaries/${it.id}`} style={{ animationDelay: `${i * 30}ms` }}>
              {it.hero ? <img className="thumb-img" src={it.hero} alt="" /> : <div className="thumb-img" />}
              <div style={{ minWidth: 0 }}>
                <div className="t" style={{ textTransform: it.status === 'ready' ? 'none' : 'capitalize' }}>{it.title || it.url}</div>
                <div className="muted small">{when(it.updated_at)}{it.versions ? ` · ${it.versions} version${it.versions > 1 ? 's' : ''}` : ''}{it.share_slug ? ' · shared' : ''}</div>
              </div>
              {it.status === 'ready' ? <span className="chip ok">Ready</span> : it.status === 'failed' ? <span className="chip bad">Stopped</span> : <span className="chip run"><span className="spinner" style={{ width: 10, height: 10 }} />{stepLabel(it.step)}</span>}
            </Link>
          ))}
        </div>
      )}
    </Shell>
  )
}
