// The editable content of one property summary. Every text and image slot in the document
// carries data-field="<path into this object>", so the details form can patch a version's HTML
// in place without throwing away design changes made in the designer.
export type Row = { label: string; value: string }

export type Development = {
  name: string
  address: string
  type: string
  description: string
  image: string | null
}

export type SummaryFields = {
  address: string
  date: string
  heroImage: string | null
  photo: string | null
  description: string
  details: Row[]
  floorPlan: string | null
  aerialImage: string | null
  demographics: Row[]
  developments: Development[]
  qrImage: string
  disclaimer: string
}

export type Sources = Record<string, string | string[] | null | undefined>

export type ListingStatus = 'queued' | 'running' | 'ready' | 'failed'

export const STEPS = [
  { key: 'scrape', label: 'Reading the listing' },
  { key: 'extract', label: 'Pulling out the property facts' },
  { key: 'site', label: 'Zoning, parcel and transport' },
  { key: 'aerial', label: 'Aerial overview' },
  { key: 'demographics', label: 'Demographics' },
  { key: 'developments', label: 'Nearby developments' },
  { key: 'write', label: 'Writing the summary' },
  { key: 'compose', label: 'Building the document' },
] as const

export type StepKey = (typeof STEPS)[number]['key']
