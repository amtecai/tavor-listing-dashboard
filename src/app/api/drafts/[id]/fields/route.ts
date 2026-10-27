import { NextResponse } from 'next/server'
import { addVersion, getDraft, getVersion } from '@/lib/db'
import { htmlForFields } from '@/lib/document/patch'
import { renderDocument } from '@/lib/document/render'
import type { SummaryFields } from '@/lib/types'

// Saves the details form. mode "patch" keeps design changes; "regenerate" re-renders from the layout.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { fields, mode } = (await req.json().catch(() => ({}))) as { fields?: SummaryFields; mode?: 'patch' | 'regenerate' }
  if (!fields?.address) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const draft = await getDraft(id)
  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const current = draft.current_version_id ? await getVersion(draft.current_version_id) : null
  const { html, regenerated } = mode === 'regenerate' ? { html: renderDocument(fields), regenerated: true } : htmlForFields(current?.html ?? null, draft.fields, fields)
  const version = await addVersion(id, html, 'details', regenerated ? 'Rebuilt from the details' : 'Edited the details', fields)
  return NextResponse.json({ version, regenerated })
}
