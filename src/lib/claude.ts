// Every Claude call in the app: listing extraction, development research, copywriting, and the
// designer's HTML edits. Model claude-opus-5-5 at high effort, with server-side refusal fallback.
import Anthropic from '@anthropic-ai/sdk'

export const MODEL = process.env.TAVOR_MODEL || 'claude-opus-5-5'
let client: Anthropic | undefined
const anthropic = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY_1, baseURL: 'https://api.anthropic.com' }))

// Tavor's own copy from the example summary: the style reference for everything we write.
export const STYLE = {
  description:
    'This shop-and-residence holding sits on a prominent spot in busy Whitehorse Road, on approx. 343 sqm* of Commercial 1 zoned land. At street level, the impressive 260 sqm* retail space has high ceilings, rear access, male and female amenities and plenty of storage. Upstairs is a spacious 130 sqm* home with its own entry from both front and rear.\n\nThe upstairs apartment has two main bedrooms with ensuites, a separate office/bedroom, an enclosed sunroom/study, a large laundry and a north-facing balcony. Car parking is on site, and the elevated courtyard has sweeping northerly views.',
  development: 'Luxury apartment development comprising 45 residences delivered in collaboration with Coles - will have a ground floor Coles supermarket',
}

const VOICE = `You write for Tavor Partners, a commercial leasing advisory firm, in Tavor's own voice, so the text reads as if Amit at Tavor wrote it.
Voice: calm, factual and specific, like a senior agent briefing a prospective tenant. Plain Australian English. Short declarative sentences. Areas from the agent's listing take "approx." and an asterisk (e.g. "approx. 343 sqm*"). No hype words (stunning, rare, unparalleled, boasting), no exclamation marks, no second person, no agent names, no sale-campaign details, no prices.`

type AskOptions = {
  system: string
  content: Anthropic.Beta.Messages.BetaContentBlockParam[] | string
  schema?: Record<string, unknown>
  tools?: Anthropic.Beta.Messages.BetaToolUnion[]
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  maxTokens?: number
  history?: Anthropic.Beta.Messages.BetaMessageParam[]
}

async function ask({ system, content, schema, tools, effort = 'high', maxTokens = 32_000, history = [] }: AskOptions): Promise<string> {
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [...history, { role: 'user', content }]
  // Server tools (web search/fetch) can pause a long turn; resume it until Claude finishes.
  for (let turn = 0; turn < 6; turn++) {
    const stream = anthropic().beta.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort, ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
      ...(tools ? { tools } : {}),
      system,
      messages,
    } as any)
    const message = await stream.finalMessage()
    if (message.stop_reason === 'refusal') throw new Error(`Claude declined this request: ${(message as any).stop_details?.explanation ?? 'no reason given'}`)
    if (message.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: message.content as any })
      continue
    }
    return message.content.filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text').map((b) => b.text).join('')
  }
  throw new Error('Claude did not finish after several continuations')
}

const lastJson = (text: string) => {
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1])
  return JSON.parse(fenced.length ? fenced.at(-1)! : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
}

const str = { type: 'string' } as const
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })

// ---------- 1. listing facts ----------

export type Facts = {
  address: string
  suburb: string
  propertyType: string
  landArea: string
  buildingArea: string
  nla: string
  frontage: string
  zoning: string
  carParking: string
  transportNotes: string
  features: string[]
  description: string
}

const FACTS_SCHEMA = obj({
  address: { ...str, description: 'Street address formatted like "309 Whitehorse Road, Balwyn VIC 3103" (title case, state upper case)' },
  suburb: str,
  propertyType: { ...str, description: 'One or two words for the template row, e.g. Retail, Office, Medical, Industrial, Showroom, Hospitality, Shop & Residence' },
  landArea: { ...str, description: 'e.g. "343sqm", or "" if not stated' },
  buildingArea: { ...str, description: 'e.g. "482sqm", or ""' },
  nla: { ...str, description: 'Net lettable / floor area like "482sqm"; use the building or floor area if NLA is not stated; "" if none' },
  frontage: { ...str, description: 'e.g. "8.2m", only if the page states it, else ""' },
  zoning: { ...str, description: 'Planning zone code like "C1Z" if the page states it, else ""' },
  carParking: { ...str, description: 'Short phrase like "2 bays at rear" or "", from the page only' },
  transportNotes: { ...str, description: 'Nearby train/tram/bus facts from the page, verbatim, or ""' },
  features: { type: 'array', items: str, description: 'Every concrete physical fact from the description: spaces, areas, amenities, access, current use, tenancy, outlook' },
  description: { ...str, description: "The agent's description, verbatim" },
})

export async function extractFacts(page: { meta: any; markdown: string; json: any[] }): Promise<Facts> {
  const text = await ask({
    system: 'You extract commercial real-estate listing facts from a scraped realcommercial.com.au page. Copy facts exactly; never invent a value. Use "" for anything the page does not state.',
    content: `Scraped listing page:\n${JSON.stringify({ title: page.meta?.title, description: page.meta?.description, markdown: page.markdown, structuredData: page.json?.map((j: any) => j.body) }).slice(0, 400_000)}`,
    schema: FACTS_SCHEMA,
    effort: 'medium',
  })
  return JSON.parse(text)
}

// ---------- 2. nearby developments ----------

export type FoundDevelopment = { name: string; address: string; type: string; description: string; imageUrl: string; sourceUrl: string; distance: string }

const DEV_SCHEMA = obj({
  developments: {
    type: 'array',
    items: obj({
      name: { ...str, description: 'Project name; use the street address if it has no published name' },
      address: { ...str, description: 'Street address and suburb, e.g. "259 Whitehorse Road, Balwyn"' },
      type: { ...str, description: 'Two or three words, e.g. "Apartment Building", "Mixed-use", "Supermarket & Apartments"' },
      description: { ...str, description: `At most 28 words in Tavor's voice, like: "${STYLE.development}"` },
      imageUrl: { ...str, description: 'Direct URL of a render or photo of the project (an image file or og:image), or ""' },
      sourceUrl: str,
      distance: { ...str, description: 'Approximate distance from the property, e.g. "350 m"' },
    }),
  },
})

export async function researchDevelopments(address: string, lat: number, lng: number): Promise<FoundDevelopment[]> {
  const text = await ask({
    system: `${VOICE}\nYou are also a careful researcher. Use only projects you found on real pages in this search, and never invent a project, address or URL.`,
    content: `Find four real development projects (recent, under construction, approved or proposed) closest to ${address} (lat ${lat}, lng ${lng}), ideally within 2 km and on the same retail strip or activity centre. Prefer projects that signal local growth: apartments, mixed-use, supermarkets, offices. Good sources: urban.com.au, apartments.com.au, theurbandeveloper.com, council and planning.vic.gov.au pages, developer sites.
For each project give a direct image URL (a render or photo file, or the page's og:image) so the summary can show it. Return the four closest first.`,
    schema: DEV_SCHEMA,
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 8 } as any,
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8 } as any,
    ],
    effort: 'high',
    maxTokens: 48_000,
  })
  return lastJson(text).developments.slice(0, 4)
}

// ---------- 3. the Opportunity Details copy ----------

export async function writeDescription(facts: object): Promise<string> {
  return ask({
    system: `${VOICE}\nMatch the length and rhythm of this reference from Tavor's own summary:\n"""${STYLE.description}"""`,
    content: `Write the "Opportunity Details" copy for this property: two paragraphs separated by a blank line, 105 to 125 words in total, the first slightly longer. First paragraph: the site, zoning, location and the main space. Second paragraph: the rest of the accommodation, parking, outlook and transport. Use only these facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn only the two paragraphs.`,
    effort: 'high',
  })
}

// ---------- 4. designer edits ----------

export type DesignerResult = { reply: string; edits: { find: string; replace: string }[]; html: string }

const EDIT_SCHEMA = obj({
  reply: { ...str, description: 'One or two plain sentences to the user saying what you changed, or asking a question if the request is unclear' },
  edits: {
    type: 'array',
    description: 'Exact find/replace edits applied in order to the current HTML. Each find must appear exactly once in the HTML at that point. Leave empty when replacing the whole document or when only answering.',
    items: obj({ find: str, replace: str }),
  },
  html: { ...str, description: 'The complete new HTML document, only for sweeping redesigns; otherwise ""' },
})

export const DESIGNER_SYSTEM = `You are the designer inside Tavor Partners' property summary tool. The user is looking at a Tavor "Property Opportunity Summary": one HTML document of fixed-size A4 pages (points, matching Tavor's printed template) that is printed to PDF with headless Chrome.
You change the HTML to do what the user asks, and nothing else.

Rules:
- Keep Tavor's look unless asked otherwise: background #EDEDE8, green #08403B, Newsreader headings, Poppins body, the logos in /brand/.
- Keep every page's fixed size and the @page rules, so the PDF still prints as 6 A4 pages (pages 3 and 4 landscape). Content must stay inside its page.
- Keep data-field attributes on elements you keep; copy them onto replacements. The details form uses them.
- Image URLs must be ones already in the document or listed as available images. Never invent URLs.
- Facts (areas, numbers, names) come only from the document or from the user. Do not make up data.
- Text you write follows Tavor's voice: calm, factual, plain Australian English, no hype.
- Prefer small find/replace edits. Each find string must match the current HTML exactly once; include enough surrounding text to be unique. Use the html field only for a sweeping redesign.`

export async function designerEdit(opts: { html: string; request: string; history: { role: 'user' | 'assistant'; content: string }[]; images: { url: string; kind: string; width: number; height: number }[] }): Promise<DesignerResult> {
  const history: Anthropic.Beta.Messages.BetaMessageParam[] = opts.history.slice(-12).map((m) => ({ role: m.role, content: m.content }))
  // Messages must alternate and start with the user.
  while (history.length && history[0].role !== 'user') history.shift()
  const merged: Anthropic.Beta.Messages.BetaMessageParam[] = []
  for (const m of history) {
    const prev = merged.at(-1)
    if (prev && prev.role === m.role) prev.content = `${prev.content}\n\n${m.content}`
    else merged.push({ ...m })
  }
  if (merged.at(-1)?.role === 'user') merged.pop()
  const imageList = opts.images.map((i) => `${i.url} (${i.kind}, ${i.width}x${i.height})`).join('\n') || 'none'
  const text = await ask({
    system: DESIGNER_SYSTEM,
    history: merged,
    content: `Available images for this listing:\n${imageList}\n\nCurrent HTML:\n\`\`\`html\n${opts.html}\n\`\`\`\n\nRequest: ${opts.request}`,
    schema: EDIT_SCHEMA,
    effort: 'high',
    maxTokens: 64_000,
  })
  return JSON.parse(text)
}

export function applyEdits(html: string, edits: { find: string; replace: string }[]) {
  let out = html
  const failed: string[] = []
  for (const e of edits) {
    const at = out.indexOf(e.find)
    if (!e.find || at < 0 || out.indexOf(e.find, at + 1) >= 0) {
      failed.push(e.find.slice(0, 80))
      continue
    }
    out = out.slice(0, at) + e.replace + out.slice(at + e.find.length)
  }
  return { html: out, failed }
}
