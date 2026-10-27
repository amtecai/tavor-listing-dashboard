import { siteFor } from '../src/lib/pipeline/site'
import { transportNear } from '../src/lib/pipeline/transport'
for (const a of process.argv.slice(2)) {
  const s = await siteFor(a)
  console.log(a, JSON.stringify({ ...s, parcels: s.parcels.length }))
  console.log(JSON.stringify(await transportNear(s.lat, s.lng)))
}
