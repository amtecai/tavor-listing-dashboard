import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_COOKIE, internalKey, passwordEnabled, sessionToken } from './lib/auth'

const PUBLIC = [/^\/login/, /^\/api\/login/, /^\/p\//, /^\/api\/assets\/[^/]+$/, /^\/fonts\//, /^\/brand\//, /^\/favicon/]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!passwordEnabled() || PUBLIC.some((r) => r.test(pathname))) return NextResponse.next()
  if (req.headers.get('x-internal-key') === (await internalKey())) return NextResponse.next()
  if (req.cookies.get(AUTH_COOKIE)?.value === (await sessionToken())) return NextResponse.next()
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] }
