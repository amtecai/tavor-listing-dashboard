import { after, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { kick, originOf } from '@/lib/kick'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await sql`update listings set status = 'queued', error = null, updated_at = now() where id = ${id} and status = 'failed'`
  const origin = originOf(req)
  after(() => kick(origin, id))
  return NextResponse.json({ ok: true })
}
