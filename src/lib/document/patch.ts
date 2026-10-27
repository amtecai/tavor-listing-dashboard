// Applies edits from the details form to an existing version's HTML through its data-field
// attributes, so layout and design changes made in the designer survive a text or photo change.
import * as cheerio from 'cheerio'
import type { SummaryFields } from '../types'
import { renderDocument, rows } from './render'

const get = (obj: any, path: string) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)

/** Every leaf path the document can show, e.g. "details.2.value", "developments.0.image". */
function leafPaths(f: SummaryFields): string[] {
  const paths = ['address', 'date', 'heroImage', 'photo', 'description', 'floorPlan', 'aerialImage', 'qrImage', 'disclaimer']
  f.details.forEach((_, i) => paths.push(`details.${i}.label`, `details.${i}.value`))
  f.demographics.forEach((_, i) => paths.push(`demographics.${i}.label`, `demographics.${i}.value`))
  f.developments.forEach((_, i) => ['name', 'address', 'type', 'description', 'image'].forEach((k) => paths.push(`developments.${i}.${k}`)))
  return paths
}

const shape = (f: SummaryFields) => [f.developments.length, Boolean(f.floorPlan)].join('/')

// Tables whose rows can be added or removed in place.
const TABLES = [
  { key: 'details', selector: '.table.details' },
  { key: 'demographics', selector: '.table.demo' },
] as const

/**
 * Returns the patched HTML, or null when the change adds or removes developments or the
 * floor-plan page; those need a fresh render (the caller decides). Added or removed table rows
 * are redrawn inside their table, so the rest of the design stays.
 */
export function patchHtml(html: string, before: SummaryFields, after: SummaryFields): string | null {
  if (shape(before) !== shape(after)) return null
  const $ = cheerio.load(html)
  const redrawn = new Set<string>()
  for (const { key, selector } of TABLES) {
    if (before[key].length === after[key].length) continue
    const table = $(selector)
    if (table.length !== 1) return null
    table.html(rows(key, after[key]))
    redrawn.add(key)
  }
  for (const path of leafPaths(after)) {
    if (redrawn.has(path.split('.')[0])) continue
    const value = get(after, path)
    if (value === get(before, path)) continue
    $(`[data-field="${path}"]`).each((_, el) => {
      const node = $(el)
      if (el.tagName === 'img') {
        node.attr('src', value ?? '')
        node.parent('.frame').toggleClass('empty', !value)
      } else if (path === 'description') {
        const paras = String(value ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
        node.empty()
        for (const p of paras) node.append($('<p>').text(p))
      } else {
        node.text(String(value ?? ''))
      }
    })
  }
  return $.html()
}

export function htmlForFields(currentHtml: string | null, before: SummaryFields | null, after: SummaryFields) {
  if (currentHtml && before) {
    const patched = patchHtml(currentHtml, before, after)
    if (patched) return { html: patched, regenerated: false }
  }
  return { html: renderDocument(after), regenerated: true }
}
