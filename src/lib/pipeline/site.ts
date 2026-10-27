// Victorian parcel, zone and overlays from the open Vicmap WFS (opendata.maps.vic.gov.au, no key).
import { getJson, retry } from './http'

const WFS = 'https://opendata.maps.vic.gov.au/geoserver/wfs'
const ROAD_TYPES = 'Road|Street|Avenue|Parade|Highway|Drive|Lane|Place|Court|Boulevard|Crescent|Terrace|Way|Grove|Close|Circuit|Square|Esplanade|Rise|Walk|Track|Mall|Strand|Promenade|Boulevarde|Lane'

type Ring = [number, number][] // [lng, lat]

export type Site = {
  lat: number
  lng: number
  parcels: Ring[]
  frontageEstimate: string | null
  zoneCode: string | null
  zoneName: string | null
  lga: string | null
  overlays: string[]
  source: string
}

async function wfs(typeName: string, cql: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: `open-data-platform:${typeName}`, outputFormat: 'application/json', srsName: 'EPSG:4326', count: '20', CQL_FILTER: cql, ...extra })
  return retry(() => getJson(`${WFS}?${params}`, { timeoutMs: 30_000 }), 3, 1500)
}

const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
const quote = (s: string) => `'${s.toUpperCase().replace(/'/g, "''")}'`

function parseAddress(address: string) {
  const m = address.match(new RegExp(`^\\s*(?:[\\w]+\\/)?(\\d+)[A-Za-z]?(?:\\s*[-–]\\s*(\\d+)[A-Za-z]?)?\\s+(.+?)\\s+(${ROAD_TYPES})\\b,?\\s*([A-Za-z' ]+?),?\\s+(?:VIC|Victoria)\\b`, 'i'))
  if (!m) return null
  return { first: +m[1], last: m[2] ? +m[2] : null, road: m[3], type: m[4], locality: m[5].trim() }
}

async function geocodeNominatim(address: string) {
  const r = await getJson<any[]>(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ format: 'json', countrycodes: 'au', limit: '1', q: address })}`)
  return r[0] ? { lat: +r[0].lat, lng: +r[0].lon } : null
}

const edgeLengths = (ring: Ring, lat: number) => {
  const k = Math.cos((lat * Math.PI) / 180)
  return ring.slice(0, -1).map((a, i) => Math.hypot((a[0] - ring[i + 1][0]) * 111_320 * k, (a[1] - ring[i + 1][1]) * 110_950)).filter((e) => e > 2)
}

export async function siteFor(address: string): Promise<Site> {
  let point: { lat: number; lng: number } | null = null
  let parcels: Ring[] = []
  let source = 'Vicmap Address + Vicmap Property (opendata.maps.vic.gov.au WFS)'

  const a = parseAddress(address)
  if (a) {
    const numbers = a.last && a.last > a.first ? [a.first, a.last] : [a.first]
    const r = await wfs('address', `house_number_1 IN (${numbers.join(',')}) AND road_name=${quote(a.road)} AND road_type=${quote(a.type)} AND locality_name=${quote(a.locality)}`).catch(() => null)
    const feats = r?.features ?? []
    if (feats.length) {
      const pts = feats.map((f: any) => f.geometry.coordinates as [number, number])
      point = { lng: pts.reduce((s: number, p: number[]) => s + p[0], 0) / pts.length, lat: pts.reduce((s: number, p: number[]) => s + p[1], 0) / pts.length }
      const pfis = [...new Set(feats.map((f: any) => f.properties.property_pfi).filter(Boolean))] as string[]
      if (pfis.length) {
        const p = await wfs('v_property_mp', `prop_pfi IN (${pfis.map((x) => `'${x}'`).join(',')})`).catch(() => null)
        parcels = (p?.features ?? []).flatMap((f: any) => (f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates.map((poly: any) => poly[0]) : f.geometry ? [f.geometry.coordinates[0]] : []))
      }
    }
  }
  if (!point) {
    point = await geocodeNominatim(address)
    source = 'OpenStreetMap Nominatim (no Vicmap address match)'
  }
  if (!point) throw new Error(`Could not locate ${address}`)
  if (parcels.length) {
    const all = parcels.flatMap((r) => r.slice(0, -1))
    point = { lng: all.reduce((s, p) => s + p[0], 0) / all.length, lat: all.reduce((s, p) => s + p[1], 0) / all.length }
  }

  const at = `INTERSECTS(geom,SRID=4326;POINT(${point.lng} ${point.lat}))`
  const [zones, overlays] = await Promise.all([
    wfs('plan_zone', at, { propertyName: 'zone_code,zone_description,lga' }).catch(() => null),
    wfs('plan_overlay', at, { propertyName: 'zone_code,zone_description' }).catch(() => null),
  ])
  const zone = zones?.features?.[0]?.properties

  // Strip-shop parcels are deep and narrow, so each parcel's shortest boundary edge is its street frontage.
  const frontage = parcels.reduce((sum, r) => sum + Math.min(...edgeLengths(r, point!.lat)), 0)
  return {
    lat: +point.lat.toFixed(6),
    lng: +point.lng.toFixed(6),
    parcels,
    frontageEstimate: frontage > 0 && Number.isFinite(frontage) ? `${frontage.toFixed(1)}m` : null,
    zoneCode: zone?.zone_code ?? null,
    zoneName: zone?.zone_description ? title(zone.zone_description) : null,
    lga: zone?.lga ? title(zone.lga) : null,
    overlays: [...new Set<string>((overlays?.features ?? []).map((o: any) => `${o.properties.zone_code} ${title(o.properties.zone_description ?? '')}`.trim()))],
    source,
  }
}
