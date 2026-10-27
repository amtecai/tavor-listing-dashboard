import { after, NextResponse } from 'next/server'
import { sql, type DraftRow, type ListingRow } from '@/lib/db'
import { kick, originOf } from '@/lib/kick'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const [l] = (await sql`select * from listings where id = ${id}`) as ListingRow[]
  if (!l) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const [draft] = (await sql`select * from drafts where listing_id = ${id}`) as DraftRow[]
  const versions = draft
    ? await sql`select id, number, source, note, created_at from versions where draft_id = ${draft.id} order by number desc`
    : []
  const assets = await sql`select id, kind, width, height from assets where listing_id = ${id} order by created_at`

  // A step that stopped without handing over (timeout, cold start) is restarted by whoever is watching.
  const age = Date.now() - new Date(l.step_started_at ?? l.updated_at).getTime()
  if ((l.status === 'running' && age > 6 * 60_000) || (l.status === 'queued' && age > 45_000)) {
    const origin = originOf(req)
    after(() => kick(origin, id))
  }
  return NextResponse.json({
    listing: { id: l.id, url: l.url, status: l.status, step: l.step, error: l.error, warnings: l.data.warnings ?? [], sources: l.data.sources ?? {}, facts: l.data.facts ?? null },
    draft,
    versions,
    images: assets.map((a) => ({ url: `/api/assets/${a.id}`, kind: a.kind, width: a.width, height: a.height })),
  })
}
