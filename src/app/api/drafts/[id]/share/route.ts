import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDraft, sql } from '@/lib/db'
import { originOf } from '@/lib/kick'

// Publishes a version at /p/<slug>. The link stays the same; republishing moves it to another version.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { versionId } = await req.json().catch(() => ({}))
  const draft = await getDraft(id)
  if (!draft?.current_version_id) return NextResponse.json({ error: 'Nothing to share yet' }, { status: 409 })
  const base = (draft.fields?.address ?? draft.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  const slug = draft.share_slug ?? `${base}-${randomBytes(4).toString('hex')}`
  await sql`update drafts set share_slug = ${slug}, shared_version_id = ${versionId ?? draft.current_version_id}, updated_at = now() where id = ${id}`
  return NextResponse.json({ url: `${originOf(req)}/p/${slug}`, slug })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await sql`update drafts set shared_version_id = null where id = ${id}`
  return NextResponse.json({ ok: true })
}
