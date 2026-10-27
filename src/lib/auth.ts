// Shared-password gate for the dashboard (APP_PASSWORD). Hosted summary links (/p/...) stay public.
// Pipeline steps call back into the app with an internal key derived from server secrets.
const enc = new TextEncoder()

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const AUTH_COOKIE = 'tavor_session'
export const passwordEnabled = () => Boolean(process.env.APP_PASSWORD)
export const sessionToken = () => sha256(`session:${process.env.APP_PASSWORD}:${process.env.DATABASE_URL}`)
export const internalKey = () => sha256(`internal:${process.env.INTERNAL_KEY ?? ''}:${process.env.DATABASE_URL}`)
