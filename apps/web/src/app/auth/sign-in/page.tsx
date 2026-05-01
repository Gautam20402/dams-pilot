'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { setToken, getAdminPayload } from '@/lib/auth'

// ── Eye icons ────────────────────────────────────────────────────────────────
function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}
function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

// ── Sign-in form (uses useSearchParams — wrapped in Suspense below) ───────────
function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') ?? '/admin/dashboard'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  // Redirect already-authenticated users
  useEffect(() => {
    if (getAdminPayload()) router.replace(redirect)
  }, [redirect, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res  = await fetch(`${apiUrl}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Login failed. Check your credentials.')
        return
      }
      setToken(json.data.token)
      router.replace(redirect)
    } catch {
      setError('Unable to reach the server. Is the API running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left decorative panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Dot-grid background */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        {/* Brand */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center border border-white/10">
            <span className="text-white text-base font-bold">D</span>
          </div>
          <div>
            <div className="text-white font-bold text-base leading-none">DAMS</div>
            <div className="text-white/40 text-xs leading-none mt-1">Admissions Platform</div>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Admissions<br />Platform
          </h1>
          <p className="text-white/50 text-base leading-relaxed max-w-xs">
            Manage applications, track leads, and streamline your admissions workflow across all departments.
          </p>

          {/* Feature list */}
          <div className="mt-8 space-y-3">
            {[
              { icon: '◎', text: 'Multi-department lead tracking' },
              { icon: '⬜', text: 'Custom application form builder' },
              { icon: '✉', text: 'Automated applicant outreach' },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-white/50 text-xs shrink-0">
                  {f.icon}
                </div>
                <span className="text-white/60 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="relative text-white/30 text-xs">
          Secure · Role-based access · Department-scoped
        </div>
      </div>

      {/* ── Right sign-in panel ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-slate-50">
        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-xl font-bold text-slate-900">DAMS</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-slate-400 text-sm mt-1">Sign in to your admin account</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-7">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>

              {/* Email */}
              <div>
                <label htmlFor="sign-in-email" className="label">Email address</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <rect x="1" y="3" width="14" height="10" rx="2"/>
                    <path d="M1 6l7 4 7-4"/>
                  </svg>
                  <input
                    id="sign-in-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@university.edu"
                    className="input pl-10"
                    data-testid="email-input"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="sign-in-password" className="label">Password</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <rect x="2" y="7" width="12" height="8" rx="2"/>
                    <path d="M5 7V5a3 3 0 0 1 6 0v2"/>
                  </svg>
                  <input
                    id="sign-in-password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pl-10 pr-11"
                    data-testid="password-input"
                  />
                  <button
                    type="button"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    data-testid="toggle-password"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors rounded-r-xl"
                  >
                    {showPw ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                >
                  <span className="text-red-500 text-base mt-px shrink-0" aria-hidden="true">⚠</span>
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-primary py-3 text-base mt-1"
                data-testid="submit-btn"
              >
                {loading && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                )}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="text-xs text-center text-slate-400 mt-6 leading-relaxed">
            DAMS · Decentralized Admissions Management<br />
            <span className="text-slate-300">Contact your system administrator for access</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Default export: Suspense boundary (required for useSearchParams) ─────────
export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <span className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" aria-label="Loading" />
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
}
