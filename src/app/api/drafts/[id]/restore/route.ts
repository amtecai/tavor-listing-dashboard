import { NextResponse } from 'next/server'
import { addVersion, getVersion } from '@/lib/db'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { versionId } = await req.json().catch(() => ({}))
  const v = await getVersion(versionId)
  if (!v || v.draft_id !== id) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  const version = await addVersion(id, v.html, 'restore', `Restored version ${v.number}`)
  return NextResponse.json({ version })
}
