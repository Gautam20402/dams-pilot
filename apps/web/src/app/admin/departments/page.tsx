'use client'
import { useState, useEffect } from 'react'
import { useDepartments, useCreateDepartment } from '@/hooks'
import { getAdminPayload } from '@/lib/auth'
import { useRouter } from 'next/navigation'

interface CreateDeptForm {
  universityName: string
  departmentName: string
  email: string
  password: string
  confirmPassword: string
}

const EMPTY_FORM: CreateDeptForm = {
  universityName: '',
  departmentName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function DepartmentsContent() {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateDeptForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const { data, isLoading, refetch } = useDepartments()
  const { mutate: createDepartment, isPending } = useCreateDepartment()
  const departments: any[] = data?.data ?? []

  function setField(k: keyof CreateDeptForm, v: string) {
    setForm(p => ({ ...p, [k]: v }))
    setFormError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.universityName.trim() || !form.departmentName.trim() || !form.email.trim() || !form.password) {
      setFormError('All fields are required.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }
    createDepartment(
      {
        universityName: form.universityName.trim(),
        departmentName: form.departmentName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      },
      {
        onSuccess: () => {
          setShowModal(false)
          setForm(EMPTY_FORM)
          setFormError(null)
          void refetch()
        },
        onError: (err: any) => {
          setFormError(err?.message ?? 'Failed to create department.')
        },
      },
    )
  }

  return (
    <div className="p-5 max-w-screen-xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage university departments and admin credentials
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary gap-2"
          onClick={() => { setShowModal(true); setFormError(null) }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M8 1v14M1 8h14"/>
          </svg>
          Add Department
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="kpi-card">
          <div className="kpi-value">{departments.length}</div>
          <div className="kpi-label">Total Departments</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value text-blue-700">{departments.filter((d: any) => d.admins?.length > 0).length}</div>
          <div className="kpi-label">With Admin Accounts</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value text-violet-700">{departments.reduce((n: number, d: any) => n + (d._count?.leads ?? 0), 0)}</div>
          <div className="kpi-label">Total Leads</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_220px_110px_80px] px-5 py-3 bg-slate-50 border-b border-slate-100">
          {['University / Campus', 'Department', 'Admin Email', 'Slug', 'Leads'].map(h => (
            <div key={h} className="table-head">{h}</div>
          ))}
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <span className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin inline-block mb-3" />
            <div className="text-sm text-slate-400">Loading departments…</div>
          </div>
        ) : departments.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="text-4xl mb-3">🏛️</div>
            <div className="text-sm font-medium text-slate-600">No departments yet</div>
            <div className="text-xs mt-1">Click "Add Department" to get started</div>
          </div>
        ) : (
          departments.map((dept: any) => (
            <div
              key={dept.id}
              className="grid grid-cols-[1fr_1fr_220px_110px_80px] px-5 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors"
            >
              {/* University */}
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {dept.universityName || '—'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">{dept.id}</div>
              </div>

              {/* Department */}
              <div className="min-w-0">
                <div className="text-sm text-slate-800 truncate">{dept.name}</div>
                {dept.description && (
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{dept.description}</div>
                )}
              </div>

              {/* Admin email */}
              <div className="min-w-0">
                {dept.admins && dept.admins.length > 0 ? (
                  dept.admins.map((a: any) => (
                    <div key={a.id} className="text-xs font-mono text-slate-600 truncate">{a.email}</div>
                  ))
                ) : (
                  <span className="text-xs text-slate-300 italic">No admin</span>
                )}
              </div>

              {/* Slug */}
              <div>
                <span className="text-[11px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                  {dept.slug}
                </span>
              </div>

              {/* Leads count */}
              <div className="text-sm font-semibold text-slate-700">
                {dept._count?.leads ?? 0}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Department Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-xl">🏛️</div>
                <div>
                  <div className="modal-title">Add Department</div>
                  <div className="modal-sub">Create department + admin account</div>
                </div>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="btn-icon text-slate-400">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* University */}
              <div>
                <label className="label">University / Campus name</label>
                <input
                  className="input"
                  placeholder="e.g. State University of Technology"
                  value={form.universityName}
                  onChange={e => setField('universityName', e.target.value)}
                  autoFocus
                />
              </div>

              {/* Department */}
              <div>
                <label className="label">Department name</label>
                <input
                  className="input"
                  placeholder="e.g. Computer Science"
                  value={form.departmentName}
                  onChange={e => setField('departmentName', e.target.value)}
                />
                {form.departmentName.trim() && (
                  <div className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                    <span>Slug:</span>
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600">
                      {slugify(form.departmentName)}
                    </code>
                  </div>
                )}
              </div>

              {/* Admin credentials section */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="8" cy="6" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
                  </svg>
                  Admin credentials
                </div>
                <div>
                  <label className="label">Admin email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="dept-admin@university.edu"
                    value={form.email}
                    onChange={e => setField('email', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Password</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Min 8 chars"
                      value={form.password}
                      onChange={e => setField('password', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Confirm password</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Repeat"
                      value={form.confirmPassword}
                      onChange={e => setField('confirmPassword', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Error */}
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700 flex items-center gap-2">
                  <span>⚠</span> {formError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button type="button" className="btn btn-outline flex-1" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={isPending}>
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Creating…
                    </span>
                  ) : 'Create department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DepartmentsPage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const admin = getAdminPayload()
    const adminRole = admin?.role === 'admin'
    setIsAdmin(adminRole)
    setChecked(true)
    if (!adminRole) router.replace('/admin/dashboard')
  }, [router])

  if (!checked) return null
  if (!isAdmin) return null

  return <DepartmentsContent />
}
