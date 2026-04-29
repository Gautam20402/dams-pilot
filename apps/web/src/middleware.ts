import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublic = createRouteMatcher([
  '/auth/(.*)',
  '/public/(.*)',
  '/api/leads/partial',
  '/api/leads/drop-off',
  '/api/forms/public/(.*)',
  '/api/webhooks/(.*)',
  '/health',
])

export default clerkMiddleware((auth, req) => {
  if (!isPublic(req)) auth().protect()
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)','/(api|trpc)(.*)'],
}
