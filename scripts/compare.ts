// Renders the Balwyn fixture to PDF and rasterises it beside Tavor's example for diffing.
// Usage: CHROMIUM_PATH=/opt/pw-browsers/chromium npx tsx scripts/compare.ts <static base url> <out.pdf>
import { writeFileSync } from 'node:fs'
import { renderDocument } from '../src/lib/document/render'
import { htmlToPdf } from '../src/lib/pdf'
import { balwyn } from './fixture-balwyn'

const [base = 'http://localhost:8765', out = 'out.pdf'] = process.argv.slice(2)
const html = renderDocument(balwyn((n) => `/img/${n}`))
writeFileSync(out.replace(/\.pdf$/, '.html'), html)
writeFileSync(out, await htmlToPdf(html, base))
console.log(out)
