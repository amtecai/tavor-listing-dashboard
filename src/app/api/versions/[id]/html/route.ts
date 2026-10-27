import { getVersion } from '@/lib/db'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const v = await getVersion(id)
  if (!v) return new Response('Not found', { status: 404 })
  return new Response(v.html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=31536000, immutable' } })
}
