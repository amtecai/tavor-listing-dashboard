import { sql } from '@/lib/db'

// The hosted link a tenant opens: the shared version, with a small download bar on screen only.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const [row] = await sql`select v.html from drafts d join versions v on v.id = d.shared_version_id where d.share_slug = ${slug}`
  if (!row) return new Response('This summary is no longer shared.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  const bar = `<style>@media screen{body{padding-top:72px!important}.tavor-bar{position:fixed;inset:0 0 auto 0;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:#08403B;color:#fff;font:400 14px Poppins,sans-serif;z-index:10}.tavor-bar img{height:14px;filter:brightness(0) invert(1)}.tavor-bar a{color:#08403B;background:#EDEDE8;border-radius:999px;padding:8px 16px;text-decoration:none;font-weight:500}}@media print{.tavor-bar{display:none}}</style>
<div class="tavor-bar"><img src="/brand/wordmark.png" alt="Tavor Partners"><a href="/p/${slug}/pdf">Download PDF</a></div>`
  const html = (row.html as string).replace(/<body([^>]*)>/i, (m) => `${m}${bar}`)
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' } })
}
