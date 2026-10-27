import { NextResponse } from 'next/server'
import { AUTH_COOKIE, sessionToken } from '@/lib/auth'

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}))
  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) return NextResponse.json({ error: 'That password is not right' }, { status: 401 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, await sessionToken(), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 90 })
  return res
}
