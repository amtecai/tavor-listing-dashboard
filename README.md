# Tavor listing dashboard

Paste a realcommercial.com.au link and get a Tavor **Property Opportunity Summary**: a 6-page A4 document
(PDF or hosted link) laid out like Tavor's example summary, with zoning, transport, an aerial, ABS
demographics and nearby developments filled in. A designer view lets you ask Claude to change the
document; every change is saved as a version in Postgres.

```
paste link ─► POST /api/listings ─► pipeline steps, one function call each (state in Neon)
               scrape (Expand AI) → extract (Claude) → site (Vicmap zone/parcel + OSM transport)
               → aerial (Google satellite via Anchor, parcel in red) → demographics (ABS)
               → developments (Claude + web search) → write (Claude, Tavor voice) → compose (v1 HTML)
                                                    │
               studio: preview of any version ◄─────┘
                 ├ Designer: chat with Claude → find/replace edits → new version
                 ├ Details: form edits patch the HTML through data-field attributes → new version
                 └ Download PDF (headless Chromium) · Create hosted link (/p/<slug>)
```

## Stack

- Next.js 16 on Vercel (Node functions, `after()` to chain pipeline steps, each under 300 s)
- Neon Postgres: `listings`, `drafts`, `versions`, `chat_messages`, `assets` (images as bytea), see `db/schema.sql`
- `@sparticuz/chromium` + `puppeteer-core` for PDFs
- Claude `claude-opus-5-5` (effort high) through `@anthropic-ai/sdk`

## The document

`src/lib/document/render.ts` draws the summary. Positions, sizes and colours were measured from Tavor's
example PDF (Slack file F0CCDRRNLTC), not taken from the older web template. Units are points, so the
CSS maps 1:1 onto the PDF. `scripts/compare.ts` renders the Balwyn example content and `pdftotext -bbox`
can diff it against the example (79 of 90 text lines land within 1 pt).

## Environment

| Variable | Use |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `ANTHROPIC_API_KEY` | Claude (extraction, research, copy, designer) |
| `EXPAND_API_KEY` | Expand AI listing scrape |
| `ANCHOR_API_KEY` | Google Maps satellite capture for the aerial (falls back to Esri imagery) |
| `APP_PASSWORD` | Team password for the dashboard; hosted `/p/...` links stay public |
| `CHROMIUM_PATH` | Local only: a Chromium binary for PDFs |

## Run locally

```sh
npm install
npm run migrate            # applies db/schema.sql to DATABASE_URL
CHROMIUM_PATH=/path/to/chromium npm run dev
```
