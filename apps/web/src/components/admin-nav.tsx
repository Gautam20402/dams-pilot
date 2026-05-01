'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getAdminPayload, clearToken } from '@/lib/auth'

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1.5"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5"/>
    </svg>
  ), adminOnly: false },
  { href: '/admin/departments', label: 'Departments', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13V6l6-4 6 4v7"/>
      <rect x="6" y="9" width="4" height="4"/>
      <path d="M2 13h12"/>
    </svg>
  ), adminOnly: true },
  { href: '/admin/dashboard/forms', label: 'Form Builder', icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2"/>
      <path d="M5 6h6M5 9h4"/>
    </svg>
  ), adminOnly: false },
]

export function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()
  const admin = getAdminPayload()
  const isAdmin = admin?.role === 'admin'

  function logout() {
    clearToken()
    router.push('/auth/sign-in')
  }

  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin)

  function isActive(href: string) {
    if (href === '/admin/dashboard') return pathname === '/admin/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="px-5 h-14 flex items-center justify-between gap-4 max-w-screen-2xl mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold tracking-tight">D</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-bold text-slate-900 leading-none">DAMS</div>
            <div className="text-[10px] text-slate-400 leading-none mt-0.5">Admissions Platform</div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex items-center gap-0.5">
          {visibleItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'nav-item text-sm gap-2 px-3.5',
                isActive(item.href) ? 'nav-item-active' : '',
              ].join(' ')}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="hidden sm:block">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Right side: user info + actions */}
        <div className="flex items-center gap-2 shrink-0">
          {admin && (
            <div className="hidden md:flex items-center gap-2 pr-2 border-r border-slate-200">
              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                {admin.name?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="text-right hidden lg:block">
                <div className="text-xs font-semibold text-slate-800 leading-none">{admin.name}</div>
                <div className="text-[10px] text-slate-400 leading-none mt-0.5 capitalize">
                  {isAdmin ? 'Super Admin' : 'Dept. Admin'}
                </div>
              </div>
              {isAdmin && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold tracking-wide">
                  ADMIN
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            className="btn btn-outline btn-sm gap-1.5 text-slate-600"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M10 11l4-3-4-3M14 8H6"/>
            </svg>
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
