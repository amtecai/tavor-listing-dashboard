import { after, NextResponse } from 'next/server'
import { advance } from '@/lib/pipeline/run'
import { kick, originOf } from '@/lib/kick'

export const maxDuration = 300

// Runs one pipeline step after responding, then hands the next step to a fresh invocation.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const origin = originOf(req)
  after(async () => {
    if (await advance(id)) await kick(origin, id)
  })
  return NextResponse.json({ ok: true }, { status: 202 })
}
