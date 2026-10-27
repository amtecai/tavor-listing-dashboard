// Reads a realcommercial listing through Expand AI (the only route past the site's bot protection).
// The JSON response has the text; photo and floor-plan file hashes only appear in the snapshot's
// rendered HTML, so we fetch that too.
import { retry } from './http'

const API = 'https://api.expand.ai/v1'
const key = () => process.env.EXPAND_API_KEY ?? process.env.expand_ai_key ?? ''

export type ListingImage = { name: string; kind: 'photo' | 'floorplan'; url: string }
export type Scrape = { page: { meta: any; markdown: string; json: any[] }; images: ListingImage[] }

export async function scrapeListing(url: string): Promise<Scrape> {
  if (!key()) throw new Error('EXPAND_API_KEY is not set')
  const page = await retry(async () => {
    const res = await fetch(`${API}/fetch/json`, {
      method: 'POST',
      headers: { 'x-expand-api-key': key(), 'content-type': 'application/json' },
      body: JSON.stringify({ url, include: { markdown: true, json: true, meta: true } }),
      signal: AbortSignal.timeout(150_000),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.markdown) throw new Error(`Expand could not read the listing (${res.status}): ${JSON.stringify(body).slice(0, 300)}`)
    return body
  }, 3, 20_000)

  let images: ListingImage[] = []
  const snapshot = page.meta?.resources?.snapshotId
  if (snapshot) {
    const res = await fetch(`${API}/public/snapshots/${snapshot}/artifacts/html.original/content`, {
      headers: { 'x-expand-api-key': key() },
      signal: AbortSignal.timeout(60_000),
    })
    if (res.ok) images = listingImages(await res.text())
  }
  return { page: { meta: page.meta, markdown: page.markdown, json: page.json ?? [] }, images }
}

export function listingImages(html: string): ListingImage[] {
  const seen = new Map<string, ListingImage>()
  for (const m of html.matchAll(/([0-9a-f]{64})\\*\/((image|floorplan)(\d+)\.jpg)/g)) {
    const name = m[2]
    if (seen.has(name)) continue
    seen.set(name, { name, kind: m[3] === 'image' ? 'photo' : 'floorplan', url: `https://i1.au.reastatic.net/2400x1800-fit,quality=90/${m[1]}/${name}` })
  }
  const num = (n: string) => Number(n.match(/\d+/)![0])
  return [...seen.values()].sort((a, b) => a.kind.localeCompare(b.kind) || num(a.name) - num(b.name))
}
