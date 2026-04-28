'use client'

export function getGA4ClientId(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.split('; ').find(r => r.startsWith('_ga='))
  if (!m) return null
  const p = m.split('=')[1].split('.')
  return p.length >= 4 ? `${p[2]}.${p[3]}` : null
}

export function captureUTMs() {
  if (typeof window === 'undefined') return
  const p = new URLSearchParams(window.location.search)
  ;['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k => {
    const v = p.get(k); if (v) sessionStorage.setItem(k, v)
  })
}

export function getUTMs() {
  if (typeof sessionStorage === 'undefined') return {}
  return {
    utm_source:   sessionStorage.getItem('utm_source')   ?? undefined,
    utm_medium:   sessionStorage.getItem('utm_medium')   ?? undefined,
    utm_campaign: sessionStorage.getItem('utm_campaign') ?? undefined,
    utm_content:  sessionStorage.getItem('utm_content')  ?? undefined,
    utm_term:     sessionStorage.getItem('utm_term')     ?? undefined,
  }
}

export function getOrCreateSessionId(): string {
  if (typeof sessionStorage === 'undefined') return crypto.randomUUID()
  let sid = sessionStorage.getItem('_dams_sid')
  if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('_dams_sid', sid) }
  return sid
}

export function trackEvent(name: string, params: Record<string,unknown> = {}) {
  if (typeof window === 'undefined') return
  // @ts-ignore
  if (typeof window.gtag === 'function') window.gtag('event', name, params)
}
