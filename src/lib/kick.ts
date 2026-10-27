import { internalKey } from './auth'

/** Starts the next pipeline step in a fresh function invocation. */
export async function kick(origin: string, listingId: string) {
  try {
    await fetch(`${origin}/api/listings/${listingId}/run`, { method: 'POST', headers: { 'x-internal-key': await internalKey() }, signal: AbortSignal.timeout(20_000) })
  } catch (err) {
    console.error('[kick] could not start the next step', err)
  }
}

export const originOf = (req: Request) => {
  const url = new URL(req.url)
  const host = req.headers.get('x-forwarded-host') ?? url.host
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}`
}
