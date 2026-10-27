import { neon } from '@neondatabase/serverless'
import type { SummaryFields } from './types'

export const sql = neon(process.env.DATABASE_URL!)

export type ListingRow = {
  id: string
  url: string
  status: 'queued' | 'running' | 'ready' | 'failed'
  step: string
  step_started_at: string | null
  error: string | null
  data: Record<string, any>
  created_at: string
  updated_at: string
}

export type DraftRow = {
  id: string
  listing_id: string
  title: string
  fields: SummaryFields | null
  current_version_id: string | null
  share_slug: string | null
  shared_version_id: string | null
  created_at: string
  updated_at: string
}

export type VersionRow = {
  id: string
  draft_id: string
  number: number
  html: string
  source: string
  note: string
  created_at: string
}

export async function getListing(id: string) {
  const [row] = (await sql`select * from listings where id = ${id}`) as ListingRow[]
  return row ?? null
}

/** Merges `patch` into listings.data (top-level keys) and optionally moves status/step. */
export async function updateListing(id: string, patch: Record<string, unknown>, state?: Partial<Pick<ListingRow, 'status' | 'step' | 'error'>>) {
  await sql`update listings set
      data = data || ${JSON.stringify(patch)}::jsonb,
      status = coalesce(${state?.status ?? null}, status),
      step = coalesce(${state?.step ?? null}, step),
      error = ${state?.error ?? null},
      step_started_at = case when ${state?.step ?? null}::text is not null then now() else step_started_at end,
      updated_at = now()
    where id = ${id}`
}

export async function getDraft(id: string) {
  const [row] = (await sql`select * from drafts where id = ${id}`) as DraftRow[]
  return row ?? null
}

export async function getVersion(id: string) {
  const [row] = (await sql`select * from versions where id = ${id}`) as VersionRow[]
  return row ?? null
}

/** Saves a new version and makes it the draft's current one. */
export async function addVersion(draftId: string, html: string, source: string, note: string, fields?: SummaryFields) {
  const [v] = (await sql`
    insert into versions (draft_id, number, html, source, note)
    values (${draftId}, (select coalesce(max(number), 0) + 1 from versions where draft_id = ${draftId}), ${html}, ${source}, ${note})
    returning id, number, source, note, created_at`) as VersionRow[]
  if (fields) {
    await sql`update drafts set current_version_id = ${v.id}, fields = ${JSON.stringify(fields)}::jsonb, updated_at = now() where id = ${draftId}`
  } else {
    await sql`update drafts set current_version_id = ${v.id}, updated_at = now() where id = ${draftId}`
  }
  return v
}
