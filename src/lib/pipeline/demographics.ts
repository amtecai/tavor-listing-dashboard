// Demographic Insights rows from the ABS Data API (ERP by SA2 + Census 2021) for the site's SA2.
import { getJson, retry, UA } from './http'
import type { Row } from '../types'

const ABS = 'https://data.api.abs.gov.au/rest/data'

async function absCsv(flow: string, key: string) {
  return retry(async () => {
    const res = await fetch(`${ABS}/ABS,${flow}/${key}?dimensionAtObservation=AllDimensions`, {
      headers: { ...UA, Accept: 'application/vnd.sdmx.data+csv;labels=both' },
      signal: AbortSignal.timeout(90_000),
    })
    if (!res.ok) throw new Error(`ABS ${flow} returned ${res.status}`)
    return parseCsv(await res.text())
  }, 3, 2000)
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows.filter((r) => r.length > 1)
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}

const col = (rows: Record<string, string>[], prefix: string) => Object.keys(rows[0] ?? {}).find((k) => k.startsWith(prefix))!
const num = (s: string) => Number(s)
const pct = (x: number) => `${Math.round(x * 100)}%`

export type Demographics = { rows: Row[]; sa2: { code: string; name: string }; source: string; notes: string[] }

export async function demographicsAt(lat: number, lng: number): Promise<Demographics> {
  const sa2q = new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outFields: 'sa2_code_2021,sa2_name_2021', returnGeometry: 'false', f: 'json' })
  const sa2r = await retry(() => getJson(`https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SA2/MapServer/0/query?${sa2q}`, { timeoutMs: 30_000 }), 3)
  const a = sa2r.features?.[0]?.attributes
  if (!a) throw new Error('No ABS SA2 at this point')
  const code: string = a.sa2_code_2021
  const name: string = a.sa2_name_2021

  const [erpRows, g02, g46, g60, rt, vicErp] = await Promise.all([
    absCsv('ABS_ANNUAL_ERP_ASGS2021', `ERP.SA2.${code}.A`),
    absCsv('C21_G02_SA2', `.${code}.SA2.`),
    absCsv('C21_G46_SA2', `3...${code}.SA2.`),
    absCsv('C21_G60_SA2', `3._T..${code}.SA2.`),
    absCsv('RT', 'M1.20.20.2.M').catch(() => null),
    absCsv('ABS_ANNUAL_ERP_ASGS2021', 'ERP.STE.2.A').catch(() => null),
  ])

  const tp = col(erpRows, 'TIME_PERIOD')
  const erp = new Map(erpRows.map((r) => [Number(r[tp].split(':')[0]), num(r.OBS_VALUE)]))
  const y1 = Math.max(...erp.keys())
  const y0 = 2021
  const growth = (erp.get(y1)! / erp.get(y0)!) ** (1 / (y1 - y0)) - 1
  const projYear = y1 + 6
  const projected = Math.round(erp.get(y1)! * (1 + growth) ** 6)

  const med = col(g02, 'MEDAVG')
  const medianAge = num(g02.find((r) => r[med].startsWith('1:'))!.OBS_VALUE)
  const lfs = col(g46, 'LFSP')
  const age46 = col(g46, 'AGEP')
  const lf = g46.filter((r) => r[age46].startsWith('_T'))
  const employed = num(lf.find((r) => r[lfs].startsWith('5:'))!.OBS_VALUE) / num(lf.find((r) => r[lfs].startsWith('9:'))!.OBS_VALUE)
  const occ = col(g60, 'OCCP')
  const occupation = new Map(g60.map((r) => [r[occ].split(':')[0], num(r.OBS_VALUE)]))
  const whiteCollar = (occupation.get('1')! + occupation.get('2')!) / occupation.get('_T')!

  const rows: Row[] = [
    { label: 'Estimated Population (current)', value: erp.get(y1)!.toLocaleString('en-AU') },
    { label: 'Projected Population', value: `${projected.toLocaleString('en-AU')} (${projYear})` },
    { label: 'Population Growth Rate', value: `${(growth * 100).toFixed(2)}% p.a` },
    { label: 'Median Age', value: String(Math.round(medianAge)) },
    { label: 'Worker Professions', value: `White-collar (${pct(whiteCollar)})` },
    { label: 'Employment', value: `${pct(employed)} employed` },
  ]
  const notes = [
    `Projected population carries the ${y0}-${y1} ERP growth rate forward to ${projYear}; it is a trend, not an official forecast.`,
    'White-collar = managers and professionals (Census 2021, place of usual residence).',
  ]

  // Retail spend per head: Victorian retail turnover over the last 12 months / Victorian ERP. No suburb figure exists.
  if (rt && vicErp) {
    const t = col(rt, 'TIME_PERIOD')
    const last12 = rt.map((r) => ({ p: r[t], v: num(r.OBS_VALUE) })).filter((r) => Number.isFinite(r.v)).sort((x, y) => x.p.localeCompare(y.p)).slice(-12)
    const vt = col(vicErp, 'TIME_PERIOD')
    const vic = vicErp.map((r) => ({ y: Number(r[vt].split(':')[0]), v: num(r.OBS_VALUE) })).sort((x, y) => x.y - y.y).at(-1)
    if (last12.length === 12 && vic) {
      const perHead = (last12.reduce((s, r) => s + r.v, 0) * 1e6) / vic.v
      rows.push({ label: 'Retail Spending Per Capita', value: `$${(Math.round(perHead / 50) * 50).toLocaleString('en-AU')} p.a (Vic avg)` })
      notes.push(`Retail spend per capita = ABS Retail Trade, Victoria, ${last12[0].p.slice(0, 7)} to ${last12[11].p.slice(0, 7)}, divided by Victorian ERP ${vic.y}. Victorian average; no suburb figure is published.`)
    }
  }
  return { rows, sa2: { code, name }, source: `ABS Data API: ERP ${y1} and Census 2021, SA2 ${code} ${name}`, notes }
}
