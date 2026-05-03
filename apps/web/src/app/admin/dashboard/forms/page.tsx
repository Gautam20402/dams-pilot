'use client'
import { useState } from 'react'
import { useForms, useDepartments, usePublishForm, useDeleteForm } from '@/hooks'
import { getAdminPayload } from '@/lib/auth'
import { useRouter } from 'next/navigation'

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:   'bg-emerald-50 text-emerald-700 border-emerald-100',
    draft:    'bg-slate-100  text-slate-500   border-slate-200',
    archived: 'bg-red-50     text-red-500     border-red-100',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${map[status] ?? map.draft}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500' : status === 'archived' ? 'bg-red-400' : 'bg-slate-400'}`} />
      {status}
    </span>
  )
}

export default function FormsListPage() {
  const router = useRouter()
  const admin  = getAdminPayload()
  const isAdmin = admin?.role === 'admin'

  const [deptFilter,    setDeptFilter]    = useState<string>('all')
  const [search,        setSearch]        = useState('')
  const [copiedId,      setCopiedId]      = useState<string | null>(null)
  const [deleteTarget,  setDeleteTarget]  = useState<{ id: string; name: string } | null>(null)

  const { data: formsData, isLoading, refetch } = useForms()
  const { data: deptData }  = useDepartments()
  const { mutate: publish } = usePublishForm()
  const { mutate: deleteForm, isPending: deleting } = useDeleteForm()

  const departments: any[] = deptData?.data ?? []
  const allForms: any[]    = formsData?.data ?? []

  // Filter by dept + search
  const forms = allForms.filter(f => {
    const matchDept = !isAdmin
      ? f.departmentId === admin?.departmentId
      : deptFilter === 'all' || f.departmentId === deptFilter
    const q = search.toLowerCase()
    const matchSearch = !q || f.name?.toLowerCase().includes(q)
    return matchDept && matchSearch
  })

  function publicUrl(slug: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/public/apply/${encodeURIComponent(slug)}`
  }

  function copyUrl(id: string, slug: string) {
    void navigator.clipboard.writeText(publicUrl(slug))
    setCopiedId(id)
    setTimeout(() => setCopiedId(p => p === id ? null : p), 1800)
  }

  function openBuilder(mode: 'new', deptId?: string): void
  function openBuilder(mode: 'edit', formId: string): void
  function openBuilder(mode: 'new' | 'edit', param?: string) {
    if (mode === 'new') {
      router.push(`/admin/dashboard/forms/builder?new=1${param ? `&dept=${param}` : ''}`)
    } else {
      router.push(`/admin/dashboard/forms/builder?edit=${param}`)
    }
  }

  const deptName = (deptId: string) => departments.find(d => d.id === deptId)?.name ?? '—'

  return (
    <div className="p-5 max-w-screen-xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Form Builder</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isAdmin ? 'All department application forms' : 'Your department forms'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary gap-2"
          onClick={() => openBuilder('new', isAdmin ? undefined : admin?.departmentId ?? undefined)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M8 1v14M1 8h14"/>
          </svg>
          New Form
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total forms',    val: allForms.length,                                   color: 'text-slate-900'   },
          { label: 'Published',      val: allForms.filter(f => f.status === 'active').length, color: 'text-emerald-700' },
          { label: 'Drafts',         val: allForms.filter(f => f.status === 'draft').length,  color: 'text-amber-600'   },
          { label: 'Archived',       val: allForms.filter(f => f.status === 'archived').length, color: 'text-red-500'  },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className={`kpi-value ${k.color}`}>{k.val}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap shadow-sm">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="4.5"/><path d="M11 11l3 3"/>
          </svg>
          <input
            className="input w-52 text-xs pl-8"
            placeholder="Search forms…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {isAdmin && (
          <select
            className="sel w-52 text-xs"
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
          >
            <option value="all">All departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <span className="ml-auto text-xs text-slate-400 font-mono">{forms.length} form{forms.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-outline btn-sm" onClick={() => void refetch()}>↺ Refresh</button>
      </div>

      {/* Forms table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className={`grid ${isAdmin ? 'grid-cols-[1fr_180px_130px_100px_180px]' : 'grid-cols-[1fr_130px_100px_180px]'} px-5 py-3 bg-slate-50 border-b border-slate-100`}>
          {['Form name', ...(isAdmin ? ['Department'] : []), 'Status', 'Fields', 'Actions'].map(h => (
            <div key={h} className="table-head">{h}</div>
          ))}
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <span className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin inline-block mb-3" />
            <div className="text-sm text-slate-400">Loading forms…</div>
          </div>
        ) : forms.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm font-medium text-slate-600">
              {allForms.length === 0 ? 'No forms yet' : 'No forms match your filter'}
            </div>
            <div className="text-xs mt-1 mb-4">
              {allForms.length === 0
                ? 'Click "New Form" to create your first application form'
                : 'Try a different search or department filter'}
            </div>
            {allForms.length === 0 && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => openBuilder('new', isAdmin ? undefined : admin?.departmentId ?? undefined)}
              >
                Create first form
              </button>
            )}
          </div>
        ) : (
          forms.map((f: any) => (
            <div
              key={f.id}
              className={`grid ${isAdmin ? 'grid-cols-[1fr_180px_130px_100px_180px]' : 'grid-cols-[1fr_130px_100px_180px]'} px-5 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors items-center`}
            >
              {/* Name + URL */}
              <div className="min-w-0 pr-3">
                <div className="text-sm font-semibold text-slate-900 truncate">{f.name}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">id: {f.id}</div>
                {f.slug && (
                  <a
                    href={publicUrl(f.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] font-mono text-blue-600 hover:text-blue-800 hover:underline max-w-full truncate"
                    title={publicUrl(f.slug)}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0"><path d="M7 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9M9 1h6v6M10 6l5-5"/></svg>
                    <span className="truncate">{publicUrl(f.slug)}</span>
                  </a>
                )}
                {f.publishedAt && (
                  <div className="text-[11px] text-slate-400 mt-0.5">Published {fmtDate(f.publishedAt)}</div>
                )}
              </div>

              {/* Department (admin only) */}
              {isAdmin && (
                <div className="min-w-0">
                  <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md truncate block max-w-[160px]">
                    {deptName(f.departmentId)}
                  </span>
                </div>
              )}

              {/* Status */}
              <div><StatusChip status={f.status ?? 'draft'} /></div>

              {/* Field count */}
              <div className="text-sm font-mono text-slate-500">
                {(f.schemaJson as any)?.fields?.length ?? 0} fields
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline btn-xs gap-1"
                  onClick={() => openBuilder('edit', f.id)}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 2l3 3-9 9H2v-3L11 2z"/></svg>
                  Edit
                </button>
                {f.slug ? (
                  <button
                    type="button"
                    className={`btn btn-xs gap-1 ${copiedId === f.id ? 'bg-emerald-500 text-white border-emerald-500' : 'btn-outline'}`}
                    onClick={() => copyUrl(f.id, f.slug)}
                  >
                    {copiedId === f.id ? '✓ Copied' : 'Copy link'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-xs btn-dark gap-1"
                    onClick={() => openBuilder('edit', f.id)}
                    title="Open in builder to publish"
                  >
                    Publish
                  </button>
                )}
                {/* Delete */}
                <button
                  type="button"
                  className="btn btn-xs gap-1 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300"
                  onClick={() => setDeleteTarget({ id: f.id, name: f.name })}
                  title="Delete form"
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4"/>
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4"/>
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900 text-center mb-1">Delete form?</h2>
            <p className="text-sm text-slate-500 text-center mb-1">
              This will permanently delete
            </p>
            <p className="text-sm font-semibold text-slate-800 text-center mb-4 truncate px-2">
              "{deleteTarget.name}"
            </p>
            <p className="text-xs text-slate-400 text-center mb-6">
              All associated form data will be unlinked. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-outline flex-1"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition flex items-center justify-center gap-2"
                disabled={deleting}
                onClick={() => {
                  deleteForm(deleteTarget.id, {
                    onSuccess: () => setDeleteTarget(null),
                  })
                }}
              >
                {deleting ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Deleting…</>
                ) : (
                  'Yes, delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-dept quick create (admin only) */}
      {isAdmin && departments.length > 0 && (
        <div className="mt-6">
          <div className="section-label mb-3">Quick create — by department</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {departments.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => openBuilder('new', d.id)}
                className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3.5 text-left hover:border-blue-300 hover:bg-blue-50 transition group"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-500 group-hover:bg-blue-100 group-hover:border-blue-200 group-hover:text-blue-700 transition shrink-0">
                  {d.name[0]}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-800">{d.name}</div>
                  <div className="text-[11px] text-slate-400 group-hover:text-blue-500">
                    {allForms.filter(f => f.departmentId === d.id).length} form{allForms.filter(f => f.departmentId === d.id).length !== 1 ? 's' : ''}
                  </div>
                </div>
                <svg className="ml-auto shrink-0 text-slate-300 group-hover:text-blue-400" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 1v14M1 8h14"/></svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
