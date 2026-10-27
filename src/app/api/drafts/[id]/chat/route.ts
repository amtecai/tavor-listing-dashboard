import { NextResponse } from 'next/server'
import { applyEdits, designerEdit } from '@/lib/claude'
import { addVersion, getDraft, getVersion, sql } from '@/lib/db'

export const maxDuration = 300

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return NextResponse.json(await sql`select id, role, content, version_id, created_at from chat_messages where draft_id = ${id} order by created_at`)
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { message, versionId } = await req.json().catch(() => ({}))
  if (!message?.trim()) return NextResponse.json({ error: 'Type what you want to change' }, { status: 400 })
  const draft = await getDraft(id)
  if (!draft?.current_version_id) return NextResponse.json({ error: 'This summary has no document yet' }, { status: 409 })
  const base = await getVersion(versionId ?? draft.current_version_id)
  if (!base || base.draft_id !== id) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

  const history = (await sql`select role, content from chat_messages where draft_id = ${id} order by created_at`) as { role: 'user' | 'assistant'; content: string }[]
  const images = (await sql`select id, kind, width, height from assets where listing_id = ${draft.listing_id} order by created_at`).map((a) => ({ url: `/api/assets/${a.id}`, kind: a.kind, width: a.width, height: a.height }))
  await sql`insert into chat_messages (draft_id, role, content) values (${id}, 'user', ${message.trim()})`

  try {
    let result = await designerEdit({ html: base.html, request: message.trim(), history, images })
    let html = result.html?.trim() ? result.html : null
    if (!html && result.edits.length) {
      let applied = applyEdits(base.html, result.edits)
      if (applied.failed.length) {
        // One retry, telling Claude which find strings did not match.
        result = await designerEdit({
          html: base.html,
          request: `${message.trim()}\n\n(Your previous edits could not be applied: these find strings were not found exactly once: ${applied.failed.map((f) => JSON.stringify(f)).join(', ')}. Copy find strings exactly from the current HTML.)`,
          history,
          images,
        })
        applied = result.html?.trim() ? { html: result.html, failed: [] } : applyEdits(base.html, result.edits)
      }
      if (applied.failed.length) throw new Error('Claude could not apply its edits cleanly. Try rephrasing the request.')
      html = applied.html
    }
    let version = null
    if (html && html !== base.html) {
      version = await addVersion(id, html, 'claude', message.trim().slice(0, 140))
    }
    const [reply] = await sql`insert into chat_messages (draft_id, role, content, version_id) values (${id}, 'assistant', ${result.reply}, ${version?.id ?? null}) returning id, role, content, version_id, created_at`
    return NextResponse.json({ reply, version })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const [reply] = await sql`insert into chat_messages (draft_id, role, content) values (${id}, 'assistant', ${`Sorry, that did not work: ${msg}`}) returning id, role, content, version_id, created_at`
    return NextResponse.json({ reply, version: null, error: msg }, { status: 500 })
  }
}
