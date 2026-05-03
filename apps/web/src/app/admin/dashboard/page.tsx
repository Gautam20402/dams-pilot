'use client'
import { useEffect, useMemo, useState } from 'react'
import { useLead, useLeads, useLeadStats, useUpdateLeadStatus, useSendEmail } from '@/hooks'
import { ROLE_PERMISSIONS } from '@dams/types'
import type { Lead, UserRole, LeadStatus } from '@dams/types'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getAdminPayload } from '@/lib/auth'

const ALL_STATUSES: LeadStatus[] = ['new', 'partial', 'contacted', 'in_progress', 'submitted', 'dropped', 'converted']

/** Capitalise first letter for display; value stays lowercase for mapping */
function fmtStatus(s: string) {
  const label = s.replace('_', ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
  return <span className={`badge s-${status}`}>{fmtStatus(status)}</span>
}

function PctBar({ pct }: Readonly<{ pct: number }>) {
  const color = pct >= 80 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-slate-400 tabular-nums">{pct}%</span>
    </div>
  )
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function EmptyValue({ v }: Readonly<{ v: unknown }>) {
  if (v === null || v === undefined || v === '') return <span className="text-slate-300">—</span>
  if (typeof v === 'object') return <span className="font-mono text-slate-600">{JSON.stringify(v)}</span>
  return <>{String(v)}</>
}

const TRUNCATE_AT = 120

function LongValue({ v }: Readonly<{ v: unknown }>) {
  const [open, setOpen] = useState(false)
  if (v === null || v === undefined || v === '') return <span className="text-slate-300">—</span>
  const str = typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (str.length <= TRUNCATE_AT) return <>{str}</>
  return (
    <>
      <span>{str.slice(0, TRUNCATE_AT)}…</span>
      <button
        type="button"
        className="ml-1 text-blue-500 hover:text-blue-700 text-[11px] font-medium underline underline-offset-2"
        onClick={() => setOpen(true)}
      >
        show more
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-5 max-w-lg w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-900">Full value</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-slate-700 break-words font-mono bg-slate-50 rounded-lg p-3 max-h-72 overflow-y-auto whitespace-pre-wrap">
              {str}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SourceBadge({ source }: Readonly<{ source: string }>) {
  const label = source === 'ga_poll' ? 'GA4 Poll' : source === 'partial_save' ? 'Partial Save' : source === 'direct' ? 'Direct' : source.replaceAll('_', ' ')
  return <span className={`src-${source}`}>{label}</span>
}

// ── Lead Details Modal ──────────────────────────────────────────────────────
function LeadDetailsModal({
  lead, isLoading, onClose, perms, emailPending, statusPending, onSendEmail, onUpdateStatus,
}: Readonly<{
  lead: Lead | null; isLoading: boolean; onClose: () => void
  perms: { canUpdateStatus: boolean; canSendOutreach: boolean }
  emailPending: boolean
  statusPending: boolean
  onSendEmail: (args: { to: string; subject: string; body: string; leadId: string }) => void
  onUpdateStatus: (args: { id: string; status: string }) => void
}>) {
  const dataEntries = useMemo(() => {
    const obj = (lead?.dataJson ?? {}) as Record<string, unknown>
    return Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '').slice(0, 200)
  }, [lead])

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-start justify-center overflow-y-auto p-4 py-10"
      onClick={onClose}
    >
      {/* Panel — stop clicks from closing */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                Loading…
              </div>
            ) : (
              <>
                <div className="text-base font-semibold text-slate-900 truncate">
                  {`${lead?.firstName ?? ''} ${lead?.lastName ?? ''}`.trim() || 'Lead details'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">id: {lead?.id ?? '—'}</div>
              </>
            )}
          </div>
          {!isLoading && lead && (
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={lead.status} />
              <PctBar pct={lead.completionPct} />
            </div>
          )}
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ml-2"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14"/>
            </svg>
          </button>
        </div>

        {/* Modal body */}
        {isLoading ? (
          <div className="p-8 flex items-center gap-2 text-sm text-slate-400">
            <span className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin shrink-0" />
            Loading lead…
          </div>
        ) : !lead ? (
          <div className="p-8 text-center text-sm text-slate-400">
            <div className="text-3xl mb-2 opacity-30">◎</div>
            No lead data
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Top row: contact + source + actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card-inset space-y-1">
                <div className="section-label mb-2">Contact</div>
                <div className="text-sm font-semibold text-slate-900">
                  {`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || '—'}
                </div>
                <div className="text-xs text-slate-500 font-mono truncate">{lead.email ?? '—'}</div>
                <div className="text-xs text-slate-500 font-mono">{lead.phone ?? '—'}</div>
              </div>
              <div className="card-inset space-y-1">
                <div className="section-label mb-2">Source</div>
                <div><SourceBadge source={lead.source} /></div>
                <div className="text-xs text-slate-500 mt-1">Created: <span className="font-mono">{fmtDate(lead.createdAt)}</span></div>
                <div className="text-xs text-slate-500">Updated: <span className="font-mono">{fmtDate(lead.updatedAt)}</span></div>
              </div>
              <div className="card-inset flex flex-col gap-2">
                <div className="section-label mb-1">Actions</div>
                {perms.canSendOutreach && (
                  <button
                    className="btn-success w-full justify-center"
                    disabled={emailPending || !lead.email}
                    onClick={() => onSendEmail({
                      to: lead.email!,
                      subject: 'Your application — next steps',
                      body: `Hi ${lead.firstName ?? ''},\n\nYour application is waiting.\n\n— Admissions`,
                      leadId: lead.id,
                    })}
                  >
                    {emailPending ? 'Sending…' : '✉ Send email'}
                  </button>
                )}
                {perms.canUpdateStatus && (
                  <div className="relative">
                    <select
                      className="sel text-xs w-full"
                      value={lead.status}
                      disabled={statusPending}
                      onChange={e => onUpdateStatus({ id: lead.id, status: e.target.value })}
                    >
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s}>{fmtStatus(s)}</option>
                      ))}
                    </select>
                    {statusPending && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl pointer-events-none">
                        <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Progress + Campaign */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card-inset">
                <div className="section-label mb-2">Progress</div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Completion</span>
                    <span className="font-mono font-medium text-slate-800">{lead.completionPct}%</span>
                  </div>
                  <PctBar pct={lead.completionPct} />
                  <div className="text-xs text-slate-500">Fields filled: <span className="font-mono">{lead.fieldsFilled}</span></div>
                  {lead.lastActivePage !== null && lead.lastActivePage !== undefined && (
                    <div className="text-xs text-slate-500">Last page: <span className="font-mono">{lead.lastActivePage}</span></div>
                  )}
                </div>
              </div>
              <div className="card-inset">
                <div className="section-label mb-2">Campaign</div>
                <div className="space-y-1">
                  {[['Source', lead.utmSource], ['Medium', lead.utmMedium], ['Campaign', lead.utmCampaign]].map(([k, v]) => (
                    <div key={k} className="text-xs text-slate-500 flex gap-1.5">
                      <span className="w-14 text-slate-400 shrink-0">{k}</span>
                      <span className="font-mono text-slate-700 truncate"><EmptyValue v={v} /></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Form data */}
            <div>
              <div className="section-label mb-3">Form data</div>
              {dataEntries.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4">No captured fields yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {dataEntries.map(([k, v]) => (
                    <div key={k} className="border border-slate-200 rounded-lg p-2.5 bg-white">
                      <div className="text-[11px] text-slate-400 font-mono truncate">{k}</div>
                      <div className="text-xs text-slate-800 break-words mt-0.5">
                        <LongValue v={v} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const admin = getAdminPayload()
  const role: UserRole = admin?.role === 'admin' ? 'SUPER_ADMIN' : 'DEPT_ADMIN'
  const perms = ROLE_PERMISSIONS[role]
  const qc = useQueryClient()

  const [filters, setFilters] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading, isFetching, refetch } = useLeads(filters)
  const { data: statsData } = useLeadStats()
  const { mutate: updateStatus, isPending: statusPending } = useUpdateLeadStatus()
  const { mutate: sendEmail, isPending: emailPending } = useSendEmail()

  const leads: Lead[] = data?.data ?? []
  const { data: selectedLeadResp, isLoading: selectedLeadLoading } = useLead(selectedId ?? '')
  const selectedLead: Lead | null = (selectedLeadResp as any)?.data ?? null
  const pagination = data?.pagination
  const stats = statsData?.data

  // Prefetch lead stats in background
  useEffect(() => {
    qc.prefetchQuery({ queryKey: ['lead-stats'], queryFn: () => api.getLeadStats(), staleTime: 5 * 60_000 })
  }, [qc])

  function setF(k: string, v: string) {
    setFilters(p => v ? { ...p, [k]: v } : Object.fromEntries(Object.entries(p).filter(([key]) => key !== k)))
  }

  function exportCSV() {
    const h = ['ID', 'First', 'Last', 'Email', 'Status', 'Source', 'Completion', 'Campaign', 'Created']
    const rows = leads.map(l => [l.id, l.firstName, l.lastName, l.email, l.status, l.source, l.completionPct, l.utmCampaign ?? '', String(l.createdAt)])
    const csv = [h, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const kpis = [
    { label: 'Total Leads',    val: stats?.total ?? 0,                        color: 'text-slate-900'   },
    { label: 'Capture Rate',   val: `${stats?.captureRate ?? 0}%`,             color: 'text-emerald-700' },
    { label: 'Outreach Sent',  val: stats?.outreachSent ?? 0,                  color: 'text-blue-700'    },
    { label: 'Avg Completion', val: `${stats?.avgCompletion ?? 0}%`,           color: 'text-violet-700'  },
    { label: 'Submitted',      val: stats?.byStatus?.submitted ?? 0,           color: 'text-emerald-700' },
  ]

  return (
    <div className="p-5 max-w-screen-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Lead Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {admin?.role === 'admin' ? 'All departments' : `${admin?.name ?? ''} — your department`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-outline btn-sm gap-1.5"
            onClick={() => { void refetch() }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v5h5M15 12v-5h-5"/>
              <path d="M13.5 6A6 6 0 0 0 3 3.5L1 9M2.5 10a6 6 0 0 0 10.5 2.5L15 7"/>
            </svg>
            Refresh
          </button>
          <button className="btn btn-dark btn-sm" onClick={exportCSV}>
            Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} className="kpi-card">
            <div className={`text-2xl font-bold tracking-tight mb-0.5 ${k.color}`}>{k.val}</div>
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
            placeholder="Search name, email, ID…"
            onChange={e => setF('search', e.target.value)}
          />
        </div>
        <select className="sel w-36 text-xs" onChange={e => setF('status', e.target.value)}>
          <option value="">All statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{fmtStatus(s)}</option>)}
        </select>
        <select className="sel w-36 text-xs" onChange={e => setF('source', e.target.value)}>
          <option value="">All sources</option>
          <option value="ga_poll">GA4 poll</option>
          <option value="partial_save">Partial save</option>
          <option value="direct">Direct</option>
        </select>
        <select
          className="sel w-36 text-xs"
          onChange={e => {
            const v = e.target.value
            if (v === 'firstName_asc') {
              setF('sortBy', 'firstName')
              setFilters(p => ({ ...p, sortDir: 'asc' }))
            } else if (v === 'completionPct') {
              setF('sortBy', 'completionPct')
              setFilters(p => ({ ...p, sortDir: 'desc' }))
            } else {
              // createdAt desc (default)
              setFilters(p => {
                const n = { ...p }
                delete n.sortBy
                delete n.sortDir
                return n
              })
            }
          }}
        >
          <option value="createdAt">Newest first</option>
          <option value="completionPct">Completion ↓</option>
          <option value="firstName_asc">Name A–Z</option>
        </select>
        {isFetching && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-3 h-3 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
            Refreshing…
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400 font-mono">{pagination?.total ?? 0} leads</span>
      </div>

      {/* Leads table — always full width */}
      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          <div className="card p-10 text-center text-sm text-slate-400">
            <span className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin inline-block mb-2" />
            <div>Loading leads…</div>
          </div>
        ) : leads.length === 0 ? (
          <div className="card p-10 text-center text-slate-400">
            <div className="text-3xl mb-2">📭</div>
            <div className="text-sm">No leads match your filters</div>
          </div>
        ) : leads.map(lead => (
          <button
            key={lead.id} type="button"
            onClick={() => setSelectedId(lead.id)}
            className="w-full text-left bg-white border border-slate-200 rounded-xl shadow-sm p-3.5 transition hover:border-slate-300"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'Unnamed'}
                  </div>
                  <StatusBadge status={lead.status} />
                </div>
                <div className="text-xs text-slate-400 font-mono truncate">{lead.email ?? '—'}</div>
                <div className="text-xs text-slate-400 mt-1">{fmtDate(lead.createdAt)}</div>
              </div>
              <PctBar pct={lead.completionPct} />
            </div>
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-[30%_40%_10%_10%_10%] px-5 py-3 bg-slate-50 border-b border-slate-100">
          {['Applicant', 'Program', 'Status', 'Completion', 'Created'].map(h => (
            <div key={h} className="table-head text-left">{h}</div>
          ))}
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <span className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin inline-block mb-3" />
            <div className="text-sm text-slate-400">Loading leads…</div>
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="text-3xl mb-2">📭</div>
            <div className="text-sm">No leads match your filters</div>
          </div>
        ) : leads.map(lead => (
          <button
            key={lead.id} type="button"
            onClick={() => setSelectedId(lead.id)}
            className="w-full text-left grid grid-cols-[30%_40%_10%_10%_10%] px-5 py-3.5 border-b border-slate-100 items-center last:border-0 transition table-row hover:bg-slate-50"
          >
            <div className="min-w-0 pr-3">
              <div className="text-sm font-medium text-slate-900 truncate">{lead.firstName} {lead.lastName}</div>
              <div className="text-xs text-slate-400 font-mono truncate">{lead.email}</div>
            </div>
            <div className="text-xs text-slate-600 truncate leading-tight pr-3">{(lead as any).form?.name ?? '—'}</div>
            {/* Status — left-aligned, matches header */}
            <div className="flex items-center justify-start">
              <StatusBadge status={lead.status} />
            </div>
            <div><PctBar pct={lead.completionPct} /></div>
            <div className="text-xs text-slate-400 font-mono">{fmtDate(lead.createdAt)}</div>
          </button>
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
          <span>Page {pagination.page} of {pagination.pages} · {pagination.total} total</span>
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" disabled={pagination.page <= 1}
              onClick={() => setF('page', String(pagination.page - 1))}>← Prev</button>
            <button className="btn btn-outline btn-sm" disabled={pagination.page >= pagination.pages}
              onClick={() => setF('page', String(pagination.page + 1))}>Next →</button>
          </div>
        </div>
      )}

      {/* Lead details — full-screen modal */}
      {selectedId && (
        <LeadDetailsModal
          lead={selectedLead}
          isLoading={selectedLeadLoading}
          onClose={() => setSelectedId(null)}
          perms={perms}
          emailPending={emailPending}
          statusPending={statusPending}
          onSendEmail={args => sendEmail(args)}
          onUpdateStatus={({ id, status }) => updateStatus({ id, status })}
        />
      )}
    </div>
  )
}
