import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/auth/',
  '/public/',
  '/health',
]

const API_PUBLIC = [
  '/api/leads/partial',
  '/api/leads/drop-off',
  '/api/leads/submit',
  '/api/forms/public/',
  '/api/auth/login',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths through without auth
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (API_PUBLIC.some(p => pathname.startsWith(p)))   return NextResponse.next()

  // Check for auth token cookie
  const token = req.cookies.get('dams_token')?.value

  if (!token) {
    const signIn = new URL('/auth/sign-in', req.url)
    signIn.searchParams.set('redirect', pathname)
    return NextResponse.redirect(signIn)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
