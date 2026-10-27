'use client'
// One summary: pipeline progress while it builds, then the studio (designer chat, details form,
// sources) beside a live preview of the selected version.
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { STEPS, type Development, type Row, type SummaryFields } from '@/lib/types'

type Version = { id: string; number: number; source: string; note: string; created_at: string }
type Image = { url: string; kind: string; width: number; height: number }
type Data = {
  listing: { id: string; url: string; status: string; step: string; error: string | null; warnings: string[]; sources: Record<string, unknown>; facts: Record<string, unknown> | null }
  draft: { id: string; title: string; fields: SummaryFields | null; current_version_id: string | null; share_slug: string | null; shared_version_id: string | null } | null
  versions: Version[]
  images: Image[]
}
type Message = { id: string; role: 'user' | 'assistant'; content: string; version_id: string | null; pending?: boolean }

const SOURCE_LABEL: Record<string, string> = { generated: 'Generated', claude: 'Claude', details: 'Details', restore: 'Restored', upload: 'Upload' }
const versionLabel = (v: Version) => `v${v.number} · ${SOURCE_LABEL[v.source] ?? v.source}: ${v.note}`.slice(0, 80)

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body
}

export function Studio({ listingId }: { listingId: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [loadError, setLoadError] = useState('')
  const [viewId, setViewId] = useState<string | null>(null)
  const [tab, setTab] = useState<'designer' | 'details' | 'sources'>('designer')
  const [shareUrl, setShareUrl] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    try {
      const d = await json<Data>(await fetch(`/api/listings/${listingId}`, { cache: 'no-store' }))
      setData(d)
      setViewId((cur) => (cur && d.versions.some((v) => v.id === cur) ? cur : d.draft?.current_version_id ?? null))
      if (d.draft?.share_slug && d.draft.shared_version_id) setShareUrl(`${location.origin}/p/${d.draft.share_slug}`)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }, [listingId])

  useEffect(() => { load() }, [load])
  const ready = data?.listing.status === 'ready' && data.draft?.current_version_id
  useEffect(() => {
    if (!data || ready || data.listing.status === 'failed') return
    const t = setTimeout(load, 2500)
    return () => clearTimeout(t)
  }, [data, ready, load])

  const onNewVersion = useCallback(async (versionId: string) => {
    await load()
    setViewId(versionId)
  }, [load])

  if (loadError) return <div className="progress-wrap"><div className="card"><p className="error">{loadError}</p><Link className="btn" href="/">Back</Link></div></div>
  if (!data) return <div className="progress-wrap muted">Loading…</div>
  if (!ready) return <Progress data={data} reload={load} />

  const draft = data.draft!
  const current = draft.current_version_id
  const viewing = data.versions.find((v) => v.id === viewId) ?? data.versions[0]
  const address = draft.fields?.address ?? draft.title

  async function share() {
    setBusy('share')
    try {
      const r = await json<{ url: string }>(await fetch(`/api/drafts/${draft.id}/share`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ versionId: viewing.id }) }))
      setShareUrl(r.url)
      await navigator.clipboard?.writeText(r.url).catch(() => {})
      await load()
    } finally {
      setBusy('')
    }
  }

  async function restore() {
    setBusy('restore')
    try {
      const r = await json<{ version: Version }>(await fetch(`/api/drafts/${draft.id}/restore`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ versionId: viewing.id }) }))
      await onNewVersion(r.version.id)
    } finally {
      setBusy('')
    }
  }

  const sharedIsViewing = draft.shared_version_id === viewing.id

  return (
    <div className="studio">
      <header className="topbar">
        <Link className="btn ghost sm" href="/">← Summaries</Link>
        <span className="title">{address}</span>
        <span className="spacer" />
        <select className="select" value={viewing.id} onChange={(e) => setViewId(e.target.value)} aria-label="Version">
          {data.versions.map((v) => (
            <option key={v.id} value={v.id}>{versionLabel(v)}{v.id === current ? ' (current)' : ''}</option>
          ))}
        </select>
        <button className="btn" onClick={share} disabled={busy === 'share'} title={shareUrl ? 'Point the hosted link at this version and copy it' : 'Create a hosted link for this version'}>
          {busy === 'share' && <span className="spinner" />}
          {shareUrl ? (sharedIsViewing ? 'Copy link' : 'Share this version') : 'Create hosted link'}
        </button>
        <a className="btn primary" href={`/api/versions/${viewing.id}/pdf`} onClick={() => { setBusy('pdf'); setTimeout(() => setBusy(''), 12000) }}>
          {busy === 'pdf' && <span className="spinner" />} Download PDF
        </a>
      </header>
      <div className="body">
        <aside className="side">
          <div className="tabs">
            {(['designer', 'details', 'sources'] as const).map((t) => (
              <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t === 'designer' ? 'Designer' : t === 'details' ? 'Details' : 'Sources'}</button>
            ))}
          </div>
          {tab === 'designer' && <Designer draftId={draft.id} baseVersionId={viewing.id} onVersion={onNewVersion} onShowVersion={setViewId} />}
          {tab === 'details' && draft.fields && <Details key={current} draftId={draft.id} listingId={listingId} fields={draft.fields} images={data.images} onVersion={onNewVersion} />}
          {tab === 'sources' && <Sources data={data} shareUrl={shareUrl} />}
        </aside>
        <section className="preview">
          {viewing.id !== current && (
            <div className="note">
              Viewing version {viewing.number}. The current version is newer.
              <button className="btn sm" onClick={restore} disabled={busy === 'restore'}>{busy === 'restore' && <span className="spinner" />} Make this current</button>
            </div>
          )}
          <iframe key={viewing.id} src={`/api/versions/${viewing.id}/html`} title="Summary preview" />
        </section>
      </div>
    </div>
  )
}

function Progress({ data, reload }: { data: Data; reload: () => void }) {
  const idx = STEPS.findIndex((s) => s.key === data.listing.step)
  const failed = data.listing.status === 'failed'
  const [retrying, setRetrying] = useState(false)
  async function retry() {
    setRetrying(true)
    await fetch(`/api/listings/${data.listing.id}/retry`, { method: 'POST' })
    setTimeout(() => { setRetrying(false); reload() }, 1500)
  }
  return (
    <div className="progress-wrap">
      <Link className="btn ghost sm" href="/">← Summaries</Link>
      <div className="card" style={{ marginTop: 12 }}>
        <h1 className="serif" style={{ fontSize: 28 }}>{data.draft?.title && data.listing.facts ? data.draft.title : 'Building the summary'}</h1>
        <p className="muted small" style={{ wordBreak: 'break-all' }}>{data.listing.url}</p>
        <ul className="steps">
          {STEPS.map((s, i) => {
            const state = i < idx || data.listing.status === 'ready' ? 'done' : i === idx ? (failed ? 'fail' : 'now') : ''
            return (
              <li key={s.key} className={state}>
                <span className="dot">{state === 'done' ? '✓' : state === 'now' ? <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> : state === 'fail' ? '!' : ''}</span>
                {s.label}
              </li>
            )
          })}
        </ul>
        {failed ? (
          <div style={{ marginTop: 16 }}>
            <p className="error">This step stopped: {data.listing.error}</p>
            <button className="btn primary" style={{ marginTop: 10 }} onClick={retry} disabled={retrying}>{retrying && <span className="spinner" />} Try again</button>
          </div>
        ) : (
          <p className="muted small" style={{ marginTop: 14 }}>This takes about three to five minutes. You can leave this page; the summary keeps building.</p>
        )}
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  'Make the cover photo fill more of the page',
  'Shorten the description so it reads in one breath',
  'Use the second listing photo on the cover instead',
  'Add a short "Key features" list under the details table',
]

function Designer({ draftId, baseVersionId, onVersion, onShowVersion }: { draftId: string; baseVersionId: string; onVersion: (id: string) => void; onShowVersion: (id: string) => void }) {
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/drafts/${draftId}/chat`).then((r) => r.json()).then(setMessages).catch(() => setMessages([]))
  }, [draftId])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  async function send(message: string) {
    if (!message.trim() || sending) return
    setSending(true)
    setText('')
    setMessages((m) => [...(m ?? []), { id: `tmp-${Date.now()}`, role: 'user', content: message, version_id: null }])
    try {
      const res = await fetch(`/api/drafts/${draftId}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, versionId: baseVersionId }) })
      const body = await res.json().catch(() => ({}))
      if (body.reply) setMessages((m) => [...(m ?? []), body.reply])
      else setMessages((m) => [...(m ?? []), { id: `err-${Date.now()}`, role: 'assistant', content: body.error ?? 'Something went wrong. Try again.', version_id: null }])
      if (body.version?.id) onVersion(body.version.id)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages && messages.length === 0 && (
          <div className="intro">
            <p><b style={{ fontWeight: 500 }}>Ask Claude to change the summary.</b> Each change is saved as a new version, so you can always go back.</p>
            <div className="suggest">{SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>
          </div>
        )}
        {messages?.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            {m.content}
            {m.version_id && <div><button className="chip vlink" onClick={() => onShowVersion(m.version_id!)}>View this version</button></div>}
          </div>
        ))}
        {sending && <div className="msg assistant" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="spinner" /> Claude is editing the summary…</div>}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text) }}>
        <div className="box">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe a change, e.g. make the headings larger" rows={2}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }} />
          <button className="btn primary" disabled={sending || !text.trim()}>Send</button>
        </div>
        <p className="muted small" style={{ marginTop: 6 }}>Edits apply to the version you are viewing.</p>
      </form>
    </div>
  )
}

function ImagePicker({ value, images, onChange, listingId, kinds }: { value: string | null; images: Image[]; onChange: (url: string | null) => void; listingId: string; kinds?: string[] }) {
  const [uploading, setUploading] = useState(false)
  const [extra, setExtra] = useState<Image[]>([])
  const list = useMemo(() => {
    const all = [...images, ...extra].filter((i) => !kinds || kinds.includes(i.kind) || i.url === value)
    if (value && !all.some((i) => i.url === value)) all.unshift({ url: value, kind: 'current', width: 0, height: 0 })
    return all
  }, [images, extra, kinds, value])
  async function upload(file: File) {
    setUploading(true)
    const form = new FormData()
    form.set('file', file)
    form.set('listingId', listingId)
    try {
      const img = await json<Image>(await fetch('/api/assets', { method: 'POST', body: form }))
      setExtra((e) => [...e, img])
      onChange(img.url)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }
  return (
    <div className="thumbs">
      {list.map((i) => (
        <button type="button" key={i.url} className={`thumb${i.url === value ? ' on' : ''}`} onClick={() => onChange(i.url)} title={i.kind}>
          <img src={i.url} alt="" loading="lazy" />
        </button>
      ))}
      <button type="button" className={`thumb none${value ? '' : ' on'}`} onClick={() => onChange(null)}>None</button>
      <label className="upload">
        {uploading ? <span className="spinner" /> : 'Upload'}
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
    </div>
  )
}

function RowsEditor({ rows, onChange, addLabel }: { rows: Row[]; onChange: (rows: Row[]) => void; addLabel: string }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {rows.map((r, i) => (
        <div className="kv" key={i}>
          <input className="input" value={r.label} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Label" />
          <input className="input" value={r.value} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} aria-label="Value" />
          <button type="button" className="icon-btn" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove row">✕</button>
        </div>
      ))}
      <button type="button" className="btn sm" style={{ justifySelf: 'start' }} onClick={() => onChange([...rows, { label: '', value: '' }])}>+ {addLabel}</button>
    </div>
  )
}

function Details({ draftId, listingId, fields, images, onVersion }: { draftId: string; listingId: string; fields: SummaryFields; images: Image[]; onVersion: (id: string) => void }) {
  const [f, setF] = useState<SummaryFields>(fields)
  const [saving, setSaving] = useState('')
  const [msg, setMsg] = useState('')
  const dirty = JSON.stringify(f) !== JSON.stringify(fields)
  const set = <K extends keyof SummaryFields>(k: K, v: SummaryFields[K]) => setF((x) => ({ ...x, [k]: v }))
  const setDev = (i: number, patch: Partial<Development>) => set('developments', f.developments.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const photos = ['photo', 'upload', 'current']

  async function save(mode: 'patch' | 'regenerate') {
    setSaving(mode)
    setMsg('')
    try {
      const r = await json<{ version: { id: string }; regenerated: boolean }>(await fetch(`/api/drafts/${draftId}/fields`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields: f, mode }) }))
      setMsg(r.regenerated && mode === 'patch' ? 'Saved. Adding or removing rows rebuilt the layout from the details.' : 'Saved as a new version.')
      onVersion(r.version.id)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving('')
    }
  }

  return (
    <div className="pane">
      <div className="group">
        <h3>Cover</h3>
        <label><span className="label">Address</span><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></label>
        <label><span className="label">Date</span><input className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
        <span className="label">Cover photo</span>
        <ImagePicker value={f.heroImage} images={images} kinds={photos} listingId={listingId} onChange={(v) => set('heroImage', v)} />
      </div>
      <div className="group">
        <h3>Opportunity details</h3>
        <span className="label">Photo</span>
        <ImagePicker value={f.photo} images={images} kinds={photos} listingId={listingId} onChange={(v) => set('photo', v)} />
        <span className="label">Table</span>
        <RowsEditor rows={f.details} onChange={(v) => set('details', v)} addLabel="Add row" />
        <label><span className="label">Description (a blank line starts the second column)</span><textarea className="textarea" rows={9} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
      </div>
      <div className="group">
        <h3>Floor plan</h3>
        <ImagePicker value={f.floorPlan} images={images} kinds={['floorplan', 'upload', 'current']} listingId={listingId} onChange={(v) => set('floorPlan', v)} />
        <p className="muted small">Choose None to leave the floor plan page out.</p>
      </div>
      <div className="group">
        <h3>Aerial overview</h3>
        <ImagePicker value={f.aerialImage} images={images} kinds={['aerial', 'upload', 'current']} listingId={listingId} onChange={(v) => set('aerialImage', v)} />
      </div>
      <div className="group">
        <h3>Demographic insights</h3>
        <RowsEditor rows={f.demographics} onChange={(v) => set('demographics', v)} addLabel="Add row" />
      </div>
      <div className="group">
        <h3>Development activity</h3>
        {f.developments.map((d, i) => (
          <div className="dev-card" key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="label" style={{ margin: 0 }}>Development {i + 1}</span>
              <button type="button" className="icon-btn" onClick={() => set('developments', f.developments.filter((_, j) => j !== i))}>Remove</button>
            </div>
            <input className="input" placeholder="Name" value={d.name} onChange={(e) => setDev(i, { name: e.target.value })} />
            <input className="input" placeholder="Address" value={d.address} onChange={(e) => setDev(i, { address: e.target.value })} />
            <input className="input" placeholder="Type" value={d.type} onChange={(e) => setDev(i, { type: e.target.value })} />
            <textarea className="textarea" rows={3} value={d.description} onChange={(e) => setDev(i, { description: e.target.value })} />
            <ImagePicker value={d.image} images={images} kinds={['development', 'upload', 'current']} listingId={listingId} onChange={(v) => setDev(i, { image: v })} />
          </div>
        ))}
        {f.developments.length < 4 && (
          <button type="button" className="btn sm" style={{ justifySelf: 'start' }} onClick={() => set('developments', [...f.developments, { name: '', address: '', type: '', description: '', image: null }])}>+ Add development</button>
        )}
      </div>
      <div className="group">
        <h3>Back cover</h3>
        <label><span className="label">Disclaimer</span><textarea className="textarea" rows={3} value={f.disclaimer} onChange={(e) => set('disclaimer', e.target.value)} /></label>
      </div>
      <div className="savebar">
        <button className="btn primary" disabled={!dirty || Boolean(saving)} onClick={() => save('patch')}>{saving === 'patch' && <span className="spinner" />} Save changes</button>
        <button className="btn" disabled={Boolean(saving)} onClick={() => confirm('Rebuild the layout from these details? Design changes made in the designer will not carry over (older versions stay available).') && save('regenerate')}>
          {saving === 'regenerate' && <span className="spinner" />} Rebuild layout
        </button>
        {msg && <span className="muted small">{msg}</span>}
      </div>
    </div>
  )
}

function Sources({ data, shareUrl }: { data: Data; shareUrl: string }) {
  const entries = Object.entries(data.listing.sources ?? {})
  return (
    <div className="pane">
      {shareUrl && (
        <div className="group">
          <h3>Hosted link</h3>
          <a href={shareUrl} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>{shareUrl}</a>
          <p className="muted small">Anyone with this link can view and download the shared version.</p>
        </div>
      )}
      {data.listing.warnings.length > 0 && (
        <div className="group">
          <h3>Needs a look</h3>
          {data.listing.warnings.map((w) => <p key={w} className="small" style={{ color: 'var(--warn-fg)' }}>{w}</p>)}
        </div>
      )}
      <div className="group">
        <h3>Where the data came from</h3>
        <a className="small" href={data.listing.url} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>{data.listing.url}</a>
        <dl className="sources">
          {entries.map(([k, v]) => (
            <div key={k}>
              <dt>{k.replace(/([A-Z])/g, ' $1')}</dt>
              <dd>{Array.isArray(v) ? v.map((x) => <div key={String(x)}>{String(x)}</div>) : String(v ?? '')}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
