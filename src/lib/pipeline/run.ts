// The listing pipeline as a chain of short steps. Each step runs in its own function invocation
// (well inside Vercel's time limit), stores what it found in listings.data, and names the next step.
import { downloadAsset, saveAsset } from '../assets'
import { extractFacts, researchDevelopments, writeDescription, type Facts } from '../claude'
import { addVersion, getListing, sql, updateListing, type ListingRow } from '../db'
import { renderDocument } from '../document/render'
import { STEPS, type StepKey, type SummaryFields } from '../types'
import { aerialImage } from './aerial'
import { demographicsAt, type Demographics } from './demographics'
import { scrapeListing } from './expand'
import { siteFor, type Site } from './site'
import { transportNear, type Transport } from './transport'

export const DISCLAIMER =
  'This summary is strictly confidential, provided by Tavor for discussion purposes only; it does not constitute an offer or binding commitment and must not be disclosed to any third party without Tavor’s written consent.'

type Img = { url: string; name: string; kind: 'photo' | 'floorplan'; width: number; height: number }

// Steps whose failure should not stop the summary: the row or page is left for the user to fill in.
const OPTIONAL: StepKey[] = ['site', 'aerial', 'demographics', 'developments']

const today = () => new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Melbourne' })

async function runStep(step: StepKey, l: ListingRow): Promise<Record<string, unknown>> {
  const d = l.data
  switch (step) {
    case 'scrape': {
      const scrape = await scrapeListing(l.url)
      const images: Img[] = []
      for (const im of scrape.images.slice(0, 8)) {
        try {
          const a = await downloadAsset(l.id, im.kind, im.url)
          images.push({ url: a.url, name: im.name, kind: im.kind, width: a.width, height: a.height })
        } catch (err) {
          console.warn('[scrape] image', im.url, err)
        }
      }
      return { scrape: scrape.page, images, sources: { listing: `Expand AI scrape of ${l.url}, ${new Date().toISOString()}`, photos: 'Listing photos and floor plans (realcommercial image server)' } }
    }
    case 'extract': {
      const facts = await extractFacts(d.scrape)
      await sql`update drafts set title = ${facts.address} where listing_id = ${l.id}`
      return { facts }
    }
    case 'site': {
      const site = await siteFor((d.facts as Facts).address)
      const facts = d.facts as Facts
      let transport: Transport
      try {
        transport = await transportNear(site.lat, site.lng)
      } catch {
        // Overpass is busy at times; fall back to the modes the listing itself mentions.
        const notes = `${facts.transportNotes} ${facts.features.join(' ')}`.toLowerCase()
        const modes = ['train', 'tram', 'bus'].filter((m) => new RegExp(`\\b${m}`).test(notes))
        transport = { summary: modes.map((m) => m[0].toUpperCase() + m.slice(1)).join(', '), nearest: {}, source: 'Listing text (OpenStreetMap was unavailable)' }
      }
      return { site, transport, sources: { ...d.sources, zoning: `Vicmap Planning: ${site.zoneName ?? 'no zone found'}${site.overlays.length ? `; overlays ${site.overlays.join(', ')}` : ''}`, parcel: site.source, transport: transport.source } }
    }
    case 'aerial': {
      const site = d.site as Site | undefined
      if (!site) throw new Error('No site location, so no aerial')
      const a = await aerialImage(site.lat, site.lng, site.parcels)
      const asset = await saveAsset(l.id, 'aerial', a.bytes, { maxWidth: 2400 })
      return { aerial: { url: asset.url, credit: a.credit }, sources: { ...d.sources, aerial: a.source } }
    }
    case 'demographics': {
      const site = d.site as Site | undefined
      if (!site) throw new Error('No site location, so no demographics')
      const demographics = await demographicsAt(site.lat, site.lng)
      return { demographics, sources: { ...d.sources, demographics: [demographics.source, ...demographics.notes].join(' ') } }
    }
    case 'developments': {
      const site = d.site as Site | undefined
      const facts = d.facts as Facts
      const found = await researchDevelopments(facts.address, site?.lat ?? 0, site?.lng ?? 0)
      const developments = []
      for (const [i, dev] of found.entries()) {
        let image: string | null = null
        if (dev.imageUrl) image = (await downloadAsset(l.id, 'development', dev.imageUrl, 1000).catch(() => null))?.url ?? null
        developments.push({ ...dev, image, order: i })
      }
      return { developments, sources: { ...d.sources, developments: found.map((x) => `${x.name}: ${x.sourceUrl}`) } }
    }
    case 'write': {
      const facts = d.facts as Facts
      const site = d.site as Site | undefined
      const transport = d.transport as Transport | undefined
      const description = await writeDescription({
        ...facts,
        zoning: site?.zoneName ? `${site.zoneName} (${site.zoneCode})` : facts.zoning,
        overlays: site?.overlays,
        transport: transport?.nearest ?? facts.transportNotes,
      })
      return { description: description.trim(), sources: { ...d.sources, description: `Written by Claude (${process.env.TAVOR_MODEL || 'claude-opus-5-5'}) from the listing facts in Tavor's voice` } }
    }
    case 'compose': {
      const fields = composeFields(l)
      const [draft] = await sql`select id from drafts where listing_id = ${l.id}`
      await addVersion(draft.id, renderDocument(fields), 'generated', 'Generated from the listing', fields)
      return {}
    }
  }
}

export function composeFields(l: ListingRow): SummaryFields {
  const d = l.data
  const facts = d.facts as Facts
  const site = d.site as Site | undefined
  const transport = d.transport as Transport | undefined
  const images = (d.images ?? []) as Img[]
  const photos = images.filter((i) => i.kind === 'photo')
  const plans = images.filter((i) => i.kind === 'floorplan')
  const demographics = d.demographics as Demographics | undefined
  const details = [
    { label: 'Property Type', value: facts.propertyType },
    { label: 'Net Lettable Area', value: facts.nla || facts.buildingArea },
    { label: 'Frontage', value: facts.frontage || (site?.frontageEstimate ? `approx. ${site.frontageEstimate}` : '') },
    { label: 'Zoning', value: site?.zoneCode || facts.zoning },
    { label: 'Car Parking', value: facts.carParking },
    { label: 'Public Transport', value: transport?.summary || '' },
  ].filter((r) => r.value)
  return {
    address: facts.address,
    date: today(),
    heroImage: photos[0]?.url ?? null,
    photo: photos[1]?.url ?? photos[0]?.url ?? null,
    description: (d.description as string) ?? facts.description,
    details,
    floorPlan: plans[0]?.url ?? null,
    aerialImage: d.aerial?.url ?? null,
    demographics: demographics?.rows ?? [],
    developments: ((d.developments ?? []) as any[]).map((x) => ({ name: x.name, address: x.address, type: x.type, description: x.description, image: x.image })),
    qrImage: '/brand/qr.png',
    disclaimer: DISCLAIMER,
  }
}

const nextStep = (step: StepKey): StepKey | null => {
  const i = STEPS.findIndex((s) => s.key === step)
  return STEPS[i + 1]?.key ?? null
}

/**
 * Claims the listing's current step (unless another invocation is already on it), runs it and
 * advances. Returns true when there is another step to run.
 */
export async function advance(listingId: string): Promise<boolean> {
  const [claimed] = (await sql`
    update listings set status = 'running', step_started_at = now(), error = null, updated_at = now()
    where id = ${listingId}
      and status <> 'ready'
      and (status <> 'running' or step_started_at is null or step_started_at < now() - interval '6 minutes')
    returning *`) as ListingRow[]
  if (!claimed) return false
  const step = claimed.step as StepKey
  // A step that keeps dying (time limit, crash) must not loop forever.
  const attempts = { ...((claimed.data.attempts as Record<string, number>) ?? {}), [step]: ((claimed.data.attempts as Record<string, number>)?.[step] ?? 0) + 1 }
  await updateListing(listingId, { attempts })
  if (attempts[step] > 3) {
    const message = `${step} did not finish after 3 tries`
    if (OPTIONAL.includes(step)) {
      await updateListing(listingId, { warnings: [...((claimed.data.warnings as string[]) ?? []), message] }, { status: 'queued', step: nextStep(step)! })
      return true
    }
    await updateListing(listingId, {}, { status: 'failed', step, error: message })
    return false
  }
  try {
    const patch = await runStep(step, claimed)
    const next = nextStep(step)
    await updateListing(listingId, patch, next ? { status: 'queued', step: next } : { status: 'ready', step })
    return Boolean(next)
  } catch (err) {
    console.error(`[pipeline] ${step} failed`, err)
    const message = err instanceof Error ? err.message : String(err)
    if (OPTIONAL.includes(step)) {
      const warnings = [...((claimed.data.warnings as string[]) ?? []), `${step}: ${message}`]
      await updateListing(listingId, { warnings }, { status: 'queued', step: nextStep(step)! })
      return true
    }
    await updateListing(listingId, {}, { status: 'failed', step, error: message })
    return false
  }
}

export async function listingStatus(id: string) {
  const l = await getListing(id)
  if (!l) return null
  return { id: l.id, url: l.url, status: l.status, step: l.step, error: l.error, warnings: (l.data.warnings as string[]) ?? [], stepStartedAt: l.step_started_at }
}
