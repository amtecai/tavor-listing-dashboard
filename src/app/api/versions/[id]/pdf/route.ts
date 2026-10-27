import { getDraft, getVersion } from '@/lib/db'
import { originOf } from '@/lib/kick'
import { pdfResponse } from '@/lib/pdf-response'

export const maxDuration = 120

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const v = await getVersion(id)
  if (!v) return new Response('Not found', { status: 404 })
  const draft = await getDraft(v.draft_id)
  return pdfResponse(v.html, originOf(req), draft?.fields?.address ?? draft?.title ?? '')
}
