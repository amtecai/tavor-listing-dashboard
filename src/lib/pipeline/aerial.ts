// Aerial overview like the example's page 4: Google satellite with labels (captured by Anchor Browser),
// the site boundary outlined in red, cropped to the example's 2.2:1 frame. Falls back to Esri imagery.
import sharp from 'sharp'

const ZOOM = 19
const VIEW = { w: 2400, h: 1300 }
const CROP = { w: 1540, h: 700 } // 2.2:1, Power St to Balwyn Rd scale in the Balwyn example

type Ring = [number, number][]

const merc = (lat: number, lng: number, z = ZOOM) => {
  const s = 256 * 2 ** z
  const r = (lat * Math.PI) / 180
  return { x: ((lng + 180) / 360) * s, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * s }
}

function outline(rings: Ring[], center: { lat: number; lng: number }, offset: { x: number; y: number }, size: { w: number; h: number }, z = ZOOM) {
  const c = merc(center.lat, center.lng, z)
  const paths = rings.map((ring) => 'M' + ring.map(([lng, lat]) => {
    const p = merc(lat, lng, z)
    return `${(size.w / 2 + p.x - c.x - offset.x).toFixed(1)},${(size.h / 2 + p.y - c.y - offset.y).toFixed(1)}`
  }).join('L') + 'Z')
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size.w}" height="${size.h}"><path d="${paths.join(' ')}" fill="none" stroke="#e01e1e" stroke-width="4" stroke-linejoin="round"/></svg>`)
}

async function googleViaAnchor(lat: number, lng: number) {
  const key = process.env.ANCHOR_API_KEY
  if (!key) throw new Error('ANCHOR_API_KEY is not set')
  const res = await fetch('https://api.anchorbrowser.io/v1/tools/screenshot', {
    method: 'POST',
    headers: { 'anchor-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ url: `https://www.google.com/maps/@${lat},${lng},${ZOOM}z/data=!3m1!1e3?hl=en`, width: VIEW.w, height: VIEW.h, wait: 6000 }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) throw new Error(`Anchor screenshot failed (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

export async function aerialImage(lat: number, lng: number, parcels: Ring[]) {
  try {
    const shot = await googleViaAnchor(lat, lng)
    // Site sits just above the middle of the frame, as in the example; the crop stays clear of Google's UI.
    const left = Math.round(VIEW.w / 2 - CROP.w / 2)
    const top = Math.round(VIEW.h / 2 - CROP.h * 0.45)
    const svg = outline(parcels, { lat, lng }, { x: left - (VIEW.w - CROP.w) / 2, y: top - (VIEW.h - CROP.h) / 2 }, CROP)
    const bytes = await sharp(shot).extract({ left, top, width: CROP.w, height: CROP.h }).composite([{ input: svg }]).jpeg({ quality: 88 }).toBuffer()
    return { bytes, credit: 'Imagery ©Airbus, Maxar Technologies, Vexcel Imaging · Map data ©Google', source: `Google Maps satellite via Anchor Browser at ${lat}, ${lng}, zoom ${ZOOM}; Vicmap parcel outlined in red` }
  } catch (err) {
    console.warn('[aerial] Google capture failed, using Esri imagery', err)
  }
  // Esri World Imagery export, same frame, no labels.
  const c = merc(lat, lng, ZOOM)
  const m = 20037508.34
  const toMeters = (px: number, py: number) => {
    const s = 256 * 2 ** ZOOM
    return [(px / s) * 2 * m - m, m - (py / s) * 2 * m]
  }
  const [x0, y1] = toMeters(c.x - CROP.w / 2, c.y - CROP.h * 0.45)
  const [x1, y0] = toMeters(c.x + CROP.w / 2, c.y + CROP.h * 0.55)
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${x0},${y0},${x1},${y1}&bboxSR=3857&imageSR=3857&size=${CROP.w},${CROP.h}&format=jpg&f=image`
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`Esri imagery returned ${res.status}`)
  const svg = outline(parcels, { lat, lng }, { x: 0, y: -CROP.h * 0.05 }, CROP)
  const bytes = await sharp(Buffer.from(await res.arrayBuffer())).composite([{ input: svg }]).jpeg({ quality: 88 }).toBuffer()
  return { bytes, credit: 'Imagery ©Esri, Maxar, Earthstar Geographics', source: `Esri World Imagery at ${lat}, ${lng}; Vicmap parcel outlined in red` }
}
