'use client'
import { useState } from 'react'
import { useLeads, useLeadStats, useUpdateLeadStatus, useSendEmail } from '@/hooks'
import { SignOutButton, useUser } from '@clerk/nextjs'
import { ROLE_PERMISSIONS } from '@dams/types'
import type { Lead, UserRole, LeadStatus } from '@dams/types'

const ALL_STATUSES: LeadStatus[] = ['new','partial','contacted','in_progress','submitted','dropped','converted']

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge s-${status}`}>{status.replace('_',' ')}</span>
}
function SourceBadge({ source }: { source: string }) {
  return <span className={`src-${source}`}>{source.replace('_',' ')}</span>
}
function PctBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-10 h-1 bg-gray-100 rounded overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width:`${pct}%`, background:color }}/>
      </div>
      <span className="text-xs font-mono text-gray-400">{pct}%</span>
    </div>
  )
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function DashboardPage() {
  const { user } = useUser()
  const role   = (user?.publicMetadata?.role as UserRole) ?? 'CALLER'
  const perms  = ROLE_PERMISSIONS[role]

  const [statusView, setStatusView] = useState('all')
  const [filters, setFilters]       = useState<Record<string,string>>({})
  const [selectedId, setSelectedId] = useState<string|null>(null)

  const queryParams = { ...filters, ...(statusView !== 'all' && { status: statusView }) }
  const { data, isLoading, refetch } = useLeads(queryParams)
  const { data: statsData }          = useLeadStats()
  const { mutate: updateStatus }     = useUpdateLeadStatus()
  const { mutate: sendEmail, isPending: emailPending } = useSendEmail()
  const leads: Lead[]    = data?.data ?? []
  const pagination       = data?.pagination
  const stats            = statsData?.data

  function setF(k: string, v: string) {
    setFilters(p => v ? { ...p, [k]:v } : Object.fromEntries(Object.entries(p).filter(([key]) => key !== k)))
  }

  function exportCSV() {
    const h = ['ID','First','Last','Email','Status','Source','Completion','Campaign','Created']
    const rows = leads.map(l => [l.id,l.firstName,l.lastName,l.email,l.status,l.source,l.completionPct,l.utmCampaign??'',String(l.createdAt)])
    const csv = [h,...rows].map(r=>r.map(v=>`"${v??''}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-gray-900 rounded flex items-center justify-center text-white text-xs font-bold">D</div>
          <span className="font-semibold text-gray-900">DAMS</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">Leads Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-gray-100 border border-gray-200 rounded px-2 py-1 font-mono">{role}</span>
          <a href="/admin/dashboard/forms" className="btn btn-outline btn-sm">Form Builder</a>
          <button className="btn btn-dark btn-sm" onClick={() => refetch()}>↺ Refresh</button>
          <SignOutButton redirectUrl="/auth/sign-in">
            <button className="btn btn-outline btn-sm">Logout</button>
          </SignOutButton>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-56px)]">
        {/* Sidebar */}
        <aside className="w-48 bg-white border-r border-gray-200 p-0 shrink-0 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
          <div className="p-3">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-2">Status</div>
            {['all',...ALL_STATUSES].map(s => (
              <button key={s} onClick={()=>setStatusView(s)}
                className={`w-full text-left px-3 py-2 rounded text-xs mb-0.5 transition flex items-center justify-between font-medium
                  ${statusView===s ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                <span className="capitalize">{s==='in_progress'?'In progress':s}</span>
                {stats?.byStatus?.[s] !== undefined && (
                  <span className={`font-mono text-xs ${statusView===s?'text-white/50':'text-gray-400'}`}>{stats.byStatus[s]}</span>
                )}
                {s==='all' && stats && (
                  <span className={`font-mono text-xs ${statusView==='all'?'text-white/50':'text-gray-400'}`}>{stats.total}</span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 p-5 overflow-auto">
          {/* KPIs */}
          <div className="grid grid-cols-5 gap-3 mb-5">
            {[
              {label:'Total leads',    val: stats?.total??0,                    color:'text-gray-900'},
              {label:'Capture rate',   val: (stats?.captureRate??0)+'%',        color:'text-green-600'},
              {label:'Outreach sent',  val: stats?.outreachSent??0,             color:'text-blue-600'},
              {label:'Avg completion', val: (stats?.avgCompletion??0)+'%',      color:'text-purple-600'},
              {label:'Submitted',      val: stats?.byStatus?.submitted??0,      color:'text-green-600'},
            ].map(k => (
              <div key={k.label} className="card py-3 px-4">
                <div className={`text-2xl font-semibold tracking-tight mb-0.5 ${k.color}`}>{k.val}</div>
                <div className="text-xs text-gray-500">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3 flex-wrap shadow-sm">
            <input className="input w-48 text-xs" placeholder="Search name, email, ID…" onChange={e=>setF('search',e.target.value)}/>
            <select className="input w-36 text-xs" onChange={e=>setF('departmentId',e.target.value)}>
              <option value="">All departments</option>
              <option value="computer-science">Computer Science</option>
              <option value="business">Business</option>
              <option value="mechanical">Mechanical</option>
              <option value="psychology">Psychology</option>
              <option value="design">Design</option>
            </select>
            <select className="input w-36 text-xs" onChange={e=>setF('source',e.target.value)}>
              <option value="">All sources</option>
              <option value="ga_poll">GA4 poll</option>
              <option value="partial_save">Partial save</option>
              <option value="direct">Direct</option>
            </select>
            <select className="input w-36 text-xs" onChange={e=>setF('sortBy',e.target.value)}>
              <option value="createdAt">Newest first</option>
              <option value="completionPct">Completion</option>
              <option value="firstName">Name A–Z</option>
            </select>
            <span className="ml-auto text-xs font-mono text-gray-400">{pagination?.total??0} leads</span>
            <button className="btn btn-outline btn-sm" onClick={exportCSV}>Export CSV</button>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="grid grid-cols-[1fr_140px_120px_80px_90px_100px_120px] px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              {['Applicant','Program','Status','Completion','Source','Created','Actions'].map(h=>(
                <div key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{h}</div>
              ))}
            </div>
            {isLoading ? (
              <div className="text-center py-16 text-sm text-gray-400">Loading…</div>
            ) : leads.length===0 ? (
              <div className="text-center py-16 text-gray-400">
                <div className="text-3xl mb-2">📭</div>
                <div className="text-sm">No leads match your filters</div>
              </div>
            ) : leads.map(lead => (
              <div key={lead.id}
                onClick={()=>setSelectedId(lead.id===selectedId?null:lead.id)}
                className={`grid grid-cols-[1fr_140px_120px_80px_90px_100px_120px] px-4 py-3 border-b border-gray-100 items-center cursor-pointer last:border-0 transition
                  ${selectedId===lead.id?'bg-blue-50':'hover:bg-gray-50'}`}>
                <div>
                  <div className="text-sm font-medium">{lead.firstName} {lead.lastName}</div>
                  <div className="text-xs text-gray-400 font-mono">{lead.email}</div>
                </div>
                <div className="text-xs text-gray-600 leading-tight">{(lead as any).form?.name??'—'}</div>
                <div><StatusBadge status={lead.status}/></div>
                <div><PctBar pct={lead.completionPct}/></div>
                <div><SourceBadge source={lead.source}/></div>
                <div className="text-xs font-mono text-gray-400">{fmtDate(lead.createdAt)}</div>
                <div className="flex gap-1.5" onClick={e=>e.stopPropagation()}>
                  {perms.canSendOutreach && (
                    <button className="btn-success btn-xs" disabled={emailPending||!lead.email}
                      onClick={()=>sendEmail({ to:lead.email!, subject:'Your application — next steps',
                        body:`Hi ${lead.firstName},\n\nYour application is waiting.\n\n— Admissions`, leadId:lead.id })}>
                      Email
                    </button>
                  )}
                  {perms.canUpdateStatus && (
                    <select className="text-xs border border-gray-200 rounded px-1.5 py-0.5 cursor-pointer outline-none"
                      value={lead.status} onChange={e=>updateStatus({id:lead.id,status:e.target.value})}
                      onClick={e=>e.stopPropagation()}>
                      {ALL_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
              <span>Page {pagination.page} of {pagination.pages}</span>
              <div className="flex gap-2">
                <button className="btn btn-outline btn-sm" disabled={pagination.page<=1} onClick={()=>setF('page',String(pagination.page-1))}>← Prev</button>
                <button className="btn btn-outline btn-sm" disabled={pagination.page>=pagination.pages} onClick={()=>setF('page',String(pagination.page+1))}>Next →</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
