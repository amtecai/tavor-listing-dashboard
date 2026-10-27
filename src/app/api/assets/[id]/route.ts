import { readAsset } from '@/lib/assets'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 })
  const asset = await readAsset(id)
  if (!asset) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(asset.bytes), { headers: { 'Content-Type': asset.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' } })
}
