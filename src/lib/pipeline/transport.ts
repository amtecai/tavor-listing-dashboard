// Nearest train station, tram stop and bus stop from OpenStreetMap (Overpass), straight-line distances.
import { UA } from './http'

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

export type Transport = { summary: string; nearest: Record<string, { name: string | null; distance_m: number }>; source: string }

export async function transportNear(lat: number, lng: number): Promise<Transport> {
  const query = `[out:json][timeout:20];(node(around:2000,${lat},${lng})[railway=station];node(around:1000,${lat},${lng})[railway=tram_stop];node(around:600,${lat},${lng})[highway=bus_stop];);out body;`
  let data: any
  for (let attempt = 0; attempt < 4 && !data; attempt++) {
    try {
      const res = await fetch(ENDPOINTS[attempt % ENDPOINTS.length], { method: 'POST', headers: UA, body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(25_000) })
      if (res.ok) data = await res.json()
    } catch {}
    if (!data) await new Promise((r) => setTimeout(r, 1000))
  }
  if (!data) throw new Error('Overpass did not answer')
  const k = Math.cos((lat * Math.PI) / 180)
  const nearest: Transport['nearest'] = {}
  for (const e of data.elements ?? []) {
    const kind = e.tags?.railway === 'station' ? 'train' : e.tags?.railway === 'tram_stop' ? 'tram' : e.tags?.highway === 'bus_stop' ? 'bus' : null
    if (!kind) continue
    const d = Math.round(Math.hypot((e.lat - lat) * 110_950, (e.lon - lng) * 111_320 * k))
    if (!nearest[kind] || d < nearest[kind].distance_m) nearest[kind] = { name: e.tags?.name ?? null, distance_m: d }
  }
  const summary = ['train', 'tram', 'bus'].filter((m) => nearest[m]).map((m) => m[0].toUpperCase() + m.slice(1)).join(', ')
  return { summary, nearest, source: 'OpenStreetMap (Overpass): train within 2 km, tram within 1 km, bus within 600 m' }
}
