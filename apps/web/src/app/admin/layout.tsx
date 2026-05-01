import { AdminNav } from '@/components/admin-nav'

export default function AdminLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      {children}
    </div>
  )
}
