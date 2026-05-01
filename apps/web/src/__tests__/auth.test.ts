/**
 * Unit tests — lib/auth.ts
 * Tests token storage, JWT parsing, expiry detection, and payload extraction.
 */
import '@testing-library/jest-dom'

// ── localStorage mock ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })
// jsdom provides `document` with full cookie support — no need to redefine.

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeJwt(payload: object): string {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '')
  const body    = btoa(JSON.stringify(payload)).replace(/=/g, '')
  return `${header}.${body}.fakesignature`
}

const TOKEN_KEY = 'dams_token'

// ── Import under test ────────────────────────────────────────────────────────
let auth: typeof import('@/lib/auth')
beforeAll(async () => {
  auth = await import('@/lib/auth')
})

beforeEach(() => {
  localStorageMock.clear()
})

// ── getToken ─────────────────────────────────────────────────────────────────
describe('getToken', () => {
  it('returns null when no token stored', () => {
    expect(auth.getToken()).toBeNull()
  })

  it('returns the stored token', () => {
    localStorageMock.setItem(TOKEN_KEY, 'abc.def.ghi')
    expect(auth.getToken()).toBe('abc.def.ghi')
  })
})

// ── setToken / clearToken ────────────────────────────────────────────────────
describe('setToken + clearToken', () => {
  it('stores a token', () => {
    auth.setToken('x.y.z')
    expect(localStorageMock.getItem(TOKEN_KEY)).toBe('x.y.z')
  })

  it('clearToken removes the token', () => {
    localStorageMock.setItem(TOKEN_KEY, 'x.y.z')
    auth.clearToken()
    expect(localStorageMock.getItem(TOKEN_KEY)).toBeNull()
  })
})

// ── getAdminPayload ───────────────────────────────────────────────────────────
describe('getAdminPayload', () => {
  it('returns null when no token', () => {
    expect(auth.getAdminPayload()).toBeNull()
  })

  it('returns null for a malformed token', () => {
    localStorageMock.setItem(TOKEN_KEY, 'not.a.valid.jwt.string')
    expect(auth.getAdminPayload()).toBeNull()
  })

  it('parses a valid admin JWT', () => {
    const future = Math.floor(Date.now() / 1000) + 3600
    const token = makeJwt({
      adminId:      'abc123',
      email:        'admin@dams.edu',
      name:         'Super Admin',
      role:         'admin',
      departmentId: null,
      exp:          future,
    })
    localStorageMock.setItem(TOKEN_KEY, token)
    const payload = auth.getAdminPayload()
    expect(payload).not.toBeNull()
    expect(payload?.role).toBe('admin')
    expect(payload?.email).toBe('admin@dams.edu')
    expect(payload?.departmentId).toBeNull()
  })

  it('parses a department-scoped JWT', () => {
    const future = Math.floor(Date.now() / 1000) + 3600
    const token = makeJwt({
      adminId:      'dept999',
      email:        'cs@dams.edu',
      name:         'CS Admin',
      role:         'department',
      departmentId: 'dept-123',
      exp:          future,
    })
    localStorageMock.setItem(TOKEN_KEY, token)
    const payload = auth.getAdminPayload()
    expect(payload?.role).toBe('department')
    expect(payload?.departmentId).toBe('dept-123')
  })

  it('returns null and clears storage for an expired token', () => {
    const past = Math.floor(Date.now() / 1000) - 1
    const token = makeJwt({ adminId: 'x', email: 'a@b.com', name: 'A', role: 'admin', departmentId: null, exp: past })
    localStorageMock.setItem(TOKEN_KEY, token)
    expect(auth.getAdminPayload()).toBeNull()
    expect(localStorageMock.getItem(TOKEN_KEY)).toBeNull()
  })
})

// ── isAuthenticated ───────────────────────────────────────────────────────────
describe('isAuthenticated', () => {
  it('returns false with no token', () => {
    expect(auth.isAuthenticated()).toBe(false)
  })

  it('returns true with a valid unexpired token', () => {
    const future = Math.floor(Date.now() / 1000) + 3600
    const token = makeJwt({ adminId: 'x', email: 'a@b.com', name: 'A', role: 'admin', departmentId: null, exp: future })
    localStorageMock.setItem(TOKEN_KEY, token)
    expect(auth.isAuthenticated()).toBe(true)
  })
})
