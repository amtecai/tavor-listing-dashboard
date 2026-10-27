import { after, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { kick, originOf } from '@/lib/kick'

export async function GET() {
  const rows = await sql`
    select l.id, l.url, l.status, l.step, l.error, l.created_at, l.updated_at,
           d.id as draft_id, d.title, d.fields->>'heroImage' as hero, d.share_slug,
           (select count(*)::int from versions v where v.draft_id = d.id) as versions
    from listings l left join drafts d on d.listing_id = l.id
    order by l.created_at desc limit 50`
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const { url } = await req.json().catch(() => ({}))
  let parsed: URL
  try {
    parsed = new URL(String(url).trim())
    if (!/^https?:$/.test(parsed.protocol)) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Paste a full listing link, starting with https://' }, { status: 400 })
  }
  if (!/(^|\.)realcommercial\.com\.au$/.test(parsed.hostname)) {
    return NextResponse.json({ error: 'For now this works with realcommercial.com.au listing links' }, { status: 400 })
  }
  const [listing] = await sql`insert into listings (url) values (${parsed.toString()}) returning id`
  await sql`insert into drafts (listing_id, title) values (${listing.id}, ${parsed.pathname.split('/').pop()?.replace(/-\d+$/, '').replace(/-/g, ' ') ?? ''})`
  const origin = originOf(req)
  after(() => kick(origin, listing.id))
  return NextResponse.json({ id: listing.id })
}
