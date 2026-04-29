'use client'
import { useMemo, useState } from 'react'
import { useLead, useLeads, useLeadStats, useUpdateLeadStatus, useSendEmail, useForms } from '@/hooks'
import { useClerk, useUser } from '@clerk/nextjs'
import { ROLE_PERMISSIONS } from '@dams/types'
import type { Lead, UserRole, LeadStatus } from '@dams/types'
import { useRouter } from 'next/navigation'

const ALL_STATUSES: LeadStatus[] = ['new', 'partial', 'contacted', 'in_progress', 'submitted', 'dropped', 'converted']

function StatusBadge({ status }: Readonly<{ status: string }>) {
  return <span className={`badge s-${status}`}>{status.replace('_', ' ')}</span>
}
function SourceBadge({ source }: Readonly<{ source: string }>) {
  let label: string
  switch (source) {
    case 'ga_poll':
      label = 'GA4 Poll'
      break
    case 'partial_save':
      label = 'Partial Save'
      break
    case 'direct':
      label = 'Direct'
      break
    default:
      label = source.replaceAll('_', ' ')
  }

  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        'border border-gray-200 bg-gray-50 text-gray-700 whitespace-nowrap',
        `src-${source}`,
      ].join(' ')}
      title={label}
    >
      {label}
    </span>
  )
}
function PctBar({ pct }: Readonly<{ pct: number }>) {
  let color = '#dc2626'
  if (pct >= 80) color = '#16a34a'
  else if (pct >= 40) color = '#d97706'

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-10 h-1 bg-gray-100 rounded overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-gray-400">{pct}%</span>
    </div>
  )
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function EmptyValue({ v }: Readonly<{ v: unknown }>) {
  if (v === null || v === undefined || v === '') return <span className="text-gray-400">—</span>
  if (typeof v === 'string') return <>{v}</>
  if (typeof v === 'number') return <>{v}</>
  if (typeof v === 'boolean') return <>{v ? 'true' : 'false'}</>
  if (typeof v === 'bigint') return <>{v.toString()}</>
  if (typeof v === 'symbol') return <>{v.description ?? v.toString()}</>
  if (typeof v === 'function') return <span className="text-gray-400">[function]</span>
  return <span className="font-mono text-gray-700">{JSON.stringify(v)}</span>
}

function LeadDetails({
  lead,
  isLoading,
  onBack,
  perms,
  emailPending,
  onSendEmail,
  onUpdateStatus,
}: Readonly<{
  lead: Lead | null
  isLoading: boolean
  onBack: () => void
  perms: { canUpdateStatus: boolean; canSendOutreach: boolean }
  emailPending: boolean
  onSendEmail: (args: { to: string; subject: string; body: string; leadId: string }) => void
  onUpdateStatus: (args: { id: string; status: string }) => void
}>) {
  const dataEntries = useMemo(() => {
    const obj = (lead?.dataJson ?? {}) as Record<string, unknown>
    return Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .slice(0, 200)
  }, [lead])

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm min-h-[240px]">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <button type="button" className="btn btn-outline btn-sm md:hidden" onClick={onBack}>← Back</button>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {isLoading ? 'Loading…' : `${lead?.firstName ?? ''} ${lead?.lastName ?? ''}`.trim() || 'Lead details'}
          </div>
          {!isLoading && (
            <div className="text-xs text-gray-400 font-mono truncate">id: <EmptyValue v={lead?.id} /></div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!isLoading && lead && (
            <>
              <StatusBadge status={lead.status} />
              <PctBar pct={lead.completionPct} />
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 text-sm text-gray-400">Loading lead…</div>
      ) : !lead ? (
        <div className="p-6 text-sm text-gray-400">Select a lead to see details.</div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1 min-w-[220px]">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Contact</div>
              <div className="text-sm text-gray-900 font-medium">
                {`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || '—'}
              </div>
              <div className="text-xs text-gray-600 truncate">
                Email: <span className="font-mono"><EmptyValue v={lead.email} /></span>
              </div>
              <div className="text-xs text-gray-600 truncate">
                Phone: <span className="font-mono"><EmptyValue v={lead.phone} /></span>
              </div>
            </div>

            <div className="space-y-2 min-w-[220px]">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Meta</div>
              <div className="text-xs text-gray-600">Source: <SourceBadge source={lead.source} /></div>
              <div className="text-xs text-gray-600">Created: <span className="font-mono text-gray-500">{fmtDate(lead.createdAt)}</span></div>
              <div className="text-xs text-gray-600">Updated: <span className="font-mono text-gray-500">{fmtDate(lead.updatedAt)}</span></div>
            </div>

            <div className="flex items-center justify-end gap-2 bg-gray-50 border border-gray-200 rounded-lg p-1.5">
              {perms.canSendOutreach && (
                <button
                  className="btn-success btn-sm h-8"
                  disabled={emailPending || !lead.email}
                  onClick={() =>
                    onSendEmail({
                      to: lead.email!,
                      subject: 'Your application — next steps',
                      body: `Hi ${lead.firstName ?? ''},\n\nYour application is waiting.\n\n— Admissions`,
                      leadId: lead.id,
                    })
                  }
                >
                  Email
                </button>
              )}
              {perms.canUpdateStatus && (
                <select
                  className="h-8 text-xs border border-gray-200 rounded px-2 cursor-pointer outline-none bg-white hover:bg-gray-50"
                  value={lead.status}
                  onChange={e => onUpdateStatus({ id: lead.id, status: e.target.value })}
                >
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">At a glance</div>
              <div className="text-xs text-gray-700">Completion: <span className="font-mono">{lead.completionPct}%</span></div>
              <div className="text-xs text-gray-700">Fields filled: <span className="font-mono">{lead.fieldsFilled}</span></div>
              <div className="text-xs text-gray-700">Last active page: <span className="font-mono">{lead.lastActivePage}</span></div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Campaign</div>
              <div className="text-xs text-gray-700">utm_source: <span className="font-mono text-gray-600"><EmptyValue v={lead.utmSource} /></span></div>
              <div className="text-xs text-gray-700">utm_medium: <span className="font-mono text-gray-600"><EmptyValue v={lead.utmMedium} /></span></div>
              <div className="text-xs text-gray-700">utm_campaign: <span className="font-mono text-gray-600"><EmptyValue v={lead.utmCampaign} /></span></div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Form data</div>
            {dataEntries.length === 0 ? (
              <div className="text-xs text-gray-400">No captured fields yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dataEntries.map(([k, v]) => (
                  <div key={k} className="border border-gray-200 rounded-lg p-2.5 bg-white">
                    <div className="text-[11px] text-gray-400 font-mono truncate">{k}</div>
                    <div className="text-xs text-gray-800 break-words">
                      {typeof v === 'object' ? (
                        <span className="font-mono text-gray-700">{JSON.stringify(v)}</span>
                      ) : (
                        <span className="text-gray-800"><EmptyValue v={v} /></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FormsList({
  forms,
}: Readonly<{
  forms: any[]
}>) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function publicUrlForSlug(slug?: string | null) {
    if (!slug) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/public/apply/${encodeURIComponent(String(slug))}`
  }

  async function copyUrl(formId: string, url: string) {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(formId)
      setTimeout(() => setCopiedId(prev => (prev === formId ? null : prev)), 1500)
    } catch {
      // ignore clipboard failures (browser permissions)
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold">Forms</div>
          <div className="text-xs text-gray-400 mt-0.5">All created forms</div>
        </div>
        <div className="flex gap-2">
          <a className="btn btn-dark btn-sm" href="/admin/dashboard/forms?new=1">+ New form</a>
        </div>
      </div>

      {forms.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center text-gray-400">
          <div className="text-3xl mb-2 opacity-60">◎</div>
          <div className="text-sm">No forms created yet</div>
          <div className="text-xs mt-1">Click “New form” to create your first one</div>
        </div>
      ) : (
        <div className="space-y-2">
          {forms.map((f: any) => (
            <div key={f.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-800 truncate">{f.name}</div>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${f.status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {f.status ?? 'draft'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 font-mono truncate">id: {f.id}</div>
                  <div className="mt-2">
                    {f.slug ? (
                      <a
                        href={publicUrlForSlug(f.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 max-w-full bg-blue-50 border border-blue-100 text-blue-700 rounded-md px-2 py-1 text-xs font-mono truncate hover:bg-blue-100"
                        title={publicUrlForSlug(f.slug)}
                      >
                        <span className="text-blue-600">link</span>
                        <span className="truncate">{publicUrlForSlug(f.slug)}</span>
                      </a>
                    ) : (
                      <div className="inline-flex items-center gap-2 bg-gray-100 border border-gray-200 text-gray-500 rounded-md px-2 py-1 text-xs font-mono">
                        <span>link</span>
                        <span>—</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <a
                    className={`btn btn-outline btn-xs text-xs ${!f.slug ? 'pointer-events-none opacity-50' : ''}`}
                    href={f.slug ? publicUrlForSlug(f.slug) : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={f.slug ? 'Open public application link' : 'Publish form to get URL'}
                  >
                    Launch ↗
                  </a>
                  <button
                    type="button"
                    className={[
                      'btn btn-xs text-xs',
                      copiedId === String(f.id) ? 'bg-green-600 text-white hover:bg-green-700' : 'btn-dark',
                      !f.slug ? 'opacity-50 cursor-not-allowed' : '',
                    ].join(' ')}
                    disabled={!f.slug}
                    onClick={() => copyUrl(String(f.id), publicUrlForSlug(f.slug))}
                    title={f.slug ? 'Copy public application link' : 'Publish form to get URL'}
                  >
                    {copiedId === String(f.id) ? 'Copied' : 'Copy'}
                  </button>
                  <a className="btn btn-outline btn-xs text-xs" href={`/admin/dashboard/forms?edit=${encodeURIComponent(f.id)}`}>
                    Edit
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { signOut } = useClerk()
  const { user } = useUser()
  const role = (user?.publicMetadata?.role as UserRole) ?? 'CALLER'
  const perms = ROLE_PERMISSIONS[role]

  const [section, setSection] = useState<'leads' | 'forms'>('leads')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const queryParams = { ...filters }
  const { data, isLoading, refetch } = useLeads(queryParams)
  const { data: statsData } = useLeadStats()
  const { mutate: updateStatus } = useUpdateLeadStatus()
  const { mutate: sendEmail, isPending: emailPending } = useSendEmail()
  const { data: formsData } = useForms()
  const leads: Lead[] = data?.data ?? []
  const { data: selectedLeadResp, isLoading: selectedLeadLoading } = useLead(selectedId ?? '')
  const selectedLead: Lead | null = (selectedLeadResp as any)?.data ?? null
  const pagination = data?.pagination
  const stats = statsData?.data
  const forms = formsData?.data ?? []

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

  function logout() {
    signOut(() => router.push('/auth/sign-in'))
  }

  const showDetails = Boolean(selectedId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-gray-900 rounded flex items-center justify-center text-white text-xs font-bold">D</div>
          <span className="font-semibold text-gray-900">DAMS</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">{section === 'forms' ? 'Forms' : 'Leads Dashboard'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-gray-100 border border-gray-200 rounded px-2 py-1 font-mono">{role}</span>
          <button className="btn btn-dark btn-sm" onClick={() => refetch()}>↺ Refresh</button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-56px)]">
        {/* Sidebar */}
        <aside className="w-48 bg-white border-r border-gray-200 p-0 shrink-0 sticky top-14 h-[calc(100vh-56px)] flex flex-col">
          <div className="p-3 flex-1 overflow-y-auto">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-2">Menu</div>
            <button
              type="button"
              onClick={() => setSection('leads')}
              className={`w-full text-left px-3 py-2 rounded text-xs mb-0.5 transition flex items-center justify-between font-medium ${section === 'leads' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <span>All data</span>
              {stats && <span className={`font-mono text-xs ${section === 'leads' ? 'text-white/50' : 'text-gray-400'}`}>{stats.total}</span>}
            </button>
            <button
              type="button"
              onClick={() => setSection('forms')}
              className={`w-full text-left px-3 py-2 rounded text-xs mb-0.5 transition flex items-center justify-between font-medium ${section === 'forms' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <span>Forms list</span>
              <span className={`font-mono text-xs ${section === 'forms' ? 'text-white/50' : 'text-gray-400'}`}>{forms.length}</span>
            </button>
          </div>
          <div className="p-3 border-t border-gray-200">
            <button
              type="button"
              onClick={logout}
              className="w-full text-left px-3 py-2 rounded text-xs transition flex items-center justify-between font-medium text-gray-600 hover:bg-gray-50"
            >
              <span>Logout</span>
              <span className="font-mono text-xs text-gray-400">↩</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 min-h-0 p-5 overflow-y-auto">
          {section === 'forms' ? (
            <div className="w-full max-w-none">
              <FormsList forms={(forms ?? []) as any[]} />
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-5 gap-3 mb-5">
                {[
                  { label: 'Total leads', val: stats?.total ?? 0, color: 'text-gray-900' },
                  { label: 'Capture rate', val: (stats?.captureRate ?? 0) + '%', color: 'text-green-600' },
                  { label: 'Outreach sent', val: stats?.outreachSent ?? 0, color: 'text-blue-600' },
                  { label: 'Avg completion', val: (stats?.avgCompletion ?? 0) + '%', color: 'text-purple-600' },
                  { label: 'Submitted', val: stats?.byStatus?.submitted ?? 0, color: 'text-green-600' },
                ].map(k => (
                  <div key={k.label} className="card py-3 px-4">
                    <div className={`text-2xl font-semibold tracking-tight mb-0.5 ${k.color}`}>{k.val}</div>
                    <div className="text-xs text-gray-500">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3 flex-wrap shadow-sm">
                <input className="input w-48 text-xs" placeholder="Search name, email, ID…" onChange={e => setF('search', e.target.value)} />
                <select className="input w-36 text-xs" onChange={e => setF('departmentId', e.target.value)}>
                  <option value="">All departments</option>
                  <option value="computer-science">Computer Science</option>
                  <option value="business">Business</option>
                  <option value="mechanical">Mechanical</option>
                  <option value="psychology">Psychology</option>
                  <option value="design">Design</option>
                </select>
                <select className="input w-36 text-xs" onChange={e => setF('source', e.target.value)}>
                  <option value="">All sources</option>
                  <option value="ga_poll">GA4 poll</option>
                  <option value="partial_save">Partial save</option>
                  <option value="direct">Direct</option>
                </select>
                <select className="input w-36 text-xs" onChange={e => setF('sortBy', e.target.value)}>
                  <option value="createdAt">Newest first</option>
                  <option value="completionPct">Completion</option>
                  <option value="firstName">Name A–Z</option>
                </select>
                <span className="ml-auto text-xs font-mono text-gray-400">{pagination?.total ?? 0} leads</span>
                <button className="btn btn-outline btn-sm" onClick={exportCSV}>Export CSV</button>
              </div>

              <div className="flex gap-4 items-start">
                {/* List */}
                <div className={[showDetails ? 'hidden md:block md:w-[58%] lg:w-[62%]' : 'w-full'].join(' ')}>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {isLoading ? (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center text-sm text-gray-400">Loading…</div>
                    ) : leads.length === 0 ? (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-10 text-center text-gray-400">
                        <div className="text-3xl mb-2">📭</div>
                        <div className="text-sm">No leads match your filters</div>
                      </div>
                    ) : (
                      leads.map(lead => (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => setSelectedId(lead.id)}
                          className="w-full text-left bg-white border border-gray-200 rounded-lg shadow-sm p-3 hover:border-gray-300 transition"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'Unnamed applicant'}
                                </div>
                                <StatusBadge status={lead.status} />
                              </div>
                              <div className="text-xs text-gray-400 font-mono truncate">{lead.email ?? '—'}</div>
                              <div className="flex items-center gap-2 mt-2">
                                <SourceBadge source={lead.source} />
                                <span className="text-xs font-mono text-gray-400">{fmtDate(lead.createdAt)}</span>
                              </div>
                            </div>
                            <div className="shrink-0">
                              <PctBar pct={lead.completionPct} />
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
                    <div className="min-w-[920px]">
                      <div className="grid grid-cols-[minmax(260px,1fr)_180px_120px_110px_110px_160px] px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        {['Applicant', 'Program', 'Status', 'Completion', 'Source', 'Created'].map((h, idx) => (
                          <div
                            // eslint-disable-next-line react/no-array-index-key
                            key={h || String(idx)}
                            className="text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap"
                          >
                            {h}
                          </div>
                        ))}
                      </div>
                      {isLoading ? (
                        <div className="text-center py-16 text-sm text-gray-400">Loading…</div>
                      ) : leads.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                          <div className="text-3xl mb-2">📭</div>
                          <div className="text-sm">No leads match your filters</div>
                        </div>
                      ) : leads.map(lead => (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => setSelectedId(lead.id)}
                          className={`w-full text-left grid grid-cols-[minmax(260px,1fr)_180px_120px_110px_110px_160px] px-4 py-3 border-b border-gray-100 items-center cursor-pointer last:border-0 transition
                        ${selectedId === lead.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{lead.firstName} {lead.lastName}</div>
                            <div className="text-xs text-gray-400 font-mono truncate">{lead.email}</div>
                          </div>
                          <div className="text-xs text-gray-600 leading-tight truncate">{(lead as any).form?.name ?? '—'}</div>
                          <div><StatusBadge status={lead.status} /></div>
                          <div><PctBar pct={lead.completionPct} /></div>
                          <div><SourceBadge source={lead.source} /></div>
                          <div className="text-xs font-mono text-gray-400">{fmtDate(lead.createdAt)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Details */}
                {showDetails && (
                  <div className="w-full md:w-[42%] lg:w-[38%]">
                    <div className="hidden md:flex mb-3">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedId(null)}>← Back to list</button>
                    </div>
                    <LeadDetails
                      lead={selectedLead}
                      isLoading={selectedLeadLoading}
                      onBack={() => setSelectedId(null)}
                      perms={perms}
                      emailPending={emailPending}
                      onSendEmail={args => sendEmail(args)}
                      onUpdateStatus={({ id, status }) => updateStatus({ id, status })}
                    />
                  </div>
                )}
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                  <span>Page {pagination.page} of {pagination.pages}</span>
                  <div className="flex gap-2">
                    <button className="btn btn-outline btn-sm" disabled={pagination.page <= 1} onClick={() => setF('page', String(pagination.page - 1))}>← Prev</button>
                    <button className="btn btn-outline btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => setF('page', String(pagination.page + 1))}>Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
