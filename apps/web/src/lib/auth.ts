const TOKEN_KEY = 'dams_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface AdminPayload {
  adminId: string
  email: string
  name: string
  role: 'admin' | 'department'
  departmentId: string | null
  iat?: number
  exp?: number
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  // Also set a plain cookie so the Next.js middleware can see it
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`
}

export function getAdminPayload(): AdminPayload | null {
  const token = getToken()
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearToken()
      return null
    }
    return payload as AdminPayload
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return getAdminPayload() !== null
}
