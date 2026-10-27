import { writeFileSync } from 'node:fs'
import { siteFor } from '../src/lib/pipeline/site'
import { aerialImage } from '../src/lib/pipeline/aerial'
const s = await siteFor(process.argv[2])
const a = await aerialImage(s.lat, s.lng, s.parcels)
writeFileSync(process.argv[3], a.bytes)
console.log(a.source)
