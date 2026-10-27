import { sql } from '@/lib/db'
import { originOf } from '@/lib/kick'
import { pdfResponse } from '@/lib/pdf-response'

export const maxDuration = 120

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const [row] = await sql`select v.html, d.title, d.fields->>'address' as address from drafts d join versions v on v.id = d.shared_version_id where d.share_slug = ${slug}`
  if (!row) return new Response('Not found', { status: 404 })
  return pdfResponse(row.html, originOf(req), row.address ?? row.title)
}
