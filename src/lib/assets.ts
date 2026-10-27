// Images live in Neon (assets table) and are served from /api/assets/<id>.
import sharp from 'sharp'
import { sql } from './db'

export const assetUrl = (id: string) => `/api/assets/${id}`

export async function saveAsset(listingId: string | null, kind: string, bytes: Buffer, opts: { mime?: string; sourceUrl?: string; maxWidth?: number } = {}) {
  let out = bytes
  let mime = opts.mime ?? 'image/jpeg'
  let meta = { width: 0, height: 0 }
  if (mime !== 'image/svg+xml') {
    // Normalise to a web-size JPEG (PNG kept for transparency) so versions and PDFs stay light.
    const img = sharp(bytes, { failOn: 'none' }).rotate()
    const m = await img.metadata()
    const resized = img.resize({ width: opts.maxWidth ?? 2000, withoutEnlargement: true })
    if (m.hasAlpha && m.format === 'png') {
      out = await resized.png({ compressionLevel: 9 }).toBuffer()
      mime = 'image/png'
    } else {
      out = await resized.flatten({ background: '#ffffff' }).jpeg({ quality: 85, mozjpeg: true }).toBuffer()
      mime = 'image/jpeg'
    }
    const s = await sharp(out).metadata()
    meta = { width: s.width ?? 0, height: s.height ?? 0 }
  }
  const [row] = await sql`insert into assets (listing_id, kind, mime, bytes, width, height, source_url)
    values (${listingId}, ${kind}, ${mime}, ${out}, ${meta.width}, ${meta.height}, ${opts.sourceUrl ?? null}) returning id`
  return { id: row.id as string, url: assetUrl(row.id as string), ...meta }
}

export async function downloadAsset(listingId: string, kind: string, url: string, maxWidth?: number) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TavorSummary/1.0)' }, signal: AbortSignal.timeout(30_000) })
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !type.startsWith('image/')) throw new Error(`${url}: ${res.status} ${type}`)
  return saveAsset(listingId, kind, Buffer.from(await res.arrayBuffer()), { sourceUrl: url, maxWidth })
}

export async function readAsset(id: string) {
  const [row] = await sql`select mime, bytes from assets where id = ${id}`
  return row ? { mime: row.mime as string, bytes: row.bytes as Buffer } : null
}
