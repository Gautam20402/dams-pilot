'use client'
import { Fragment, useEffect, useRef, useState, useCallback } from 'react'
import { usePublicForm } from '@/hooks'
import { api } from '@/lib/api'
import { getGA4ClientId, getUTMs, captureUTMs, trackEvent, getOrCreateSessionId } from '@/lib/ga4'

type Field = {
  id?: string; key: string; type: string; label?: string
  required?: boolean; placeholder?: string; hint?: string; options?: string[]
  validations?: { min?: number; max?: number; step?: number; minLength?: number; maxLength?: number; pattern?: string; accept?: string; maxSizeMB?: number }
}

function isEmptyValue(v: unknown) {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim().length === 0
  if (Array.isArray(v)) return v.length === 0
  return false
}

function validateField(field: Field, value: unknown) {
  if (field.type === 'heading') return null
  const label = field.label || field.key
  const v = field.validations || {}
  if (field.required && isEmptyValue(value)) return `${label} is required.`
  if (isEmptyValue(value)) return null
  if (field.type === 'email' && typeof value === 'string') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Please enter a valid email address.'
  }
  if (['text','textarea','tel','url','email'].includes(field.type) && typeof value === 'string') {
    if (typeof v.minLength === 'number' && value.length < v.minLength) return `${label} must be at least ${v.minLength} characters.`
    if (typeof v.maxLength === 'number' && value.length > v.maxLength) return `${label} must be at most ${v.maxLength} characters.`
    if (typeof v.pattern === 'string' && v.pattern.trim()) {
      try { if (!new RegExp(v.pattern).test(value)) return `${label} format is invalid.` } catch { /* ignore */ }
    }
  }
  if (field.type === 'number') {
    const n = typeof value === 'number' ? value : Number(value)
    if (Number.isNaN(n)) return `${label} must be a number.`
    if (typeof v.min === 'number' && n < v.min) return `${label} must be at least ${v.min}.`
    if (typeof v.max === 'number' && n > v.max) return `${label} must be at most ${v.max}.`
  }
  if (field.type === 'file' && typeof value === 'string') {
    if (typeof v.accept === 'string' && v.accept.trim()) {
      const allowed = v.accept.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      if (allowed.length && !allowed.some(ext => value.toLowerCase().endsWith(ext))) {
        return `Please upload a file of type: ${allowed.join(', ')}.`
      }
    }
  }
  return null
}

// ── Submitting overlay ──────────────────────────────────────────────────────
function SubmittingOverlay({ orgName }: { orgName: string }) {
  const [activeStep, setActiveStep] = useState(0)
  const steps = [
    'Validating your answers…',
    'Saving your data securely…',
    'Submitting your application…',
    'Finalising — almost done…',
  ]

  useEffect(() => {
    const t = setInterval(() => setActiveStep(s => Math.min(s + 1, steps.length - 1)), 1100)
    return () => clearInterval(t)
  }, [steps.length])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 max-w-sm w-full mx-4 text-center">

        {/* Animated ring */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          {/* Outer pulse ring */}
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100 animate-ping opacity-30" />
          {/* Spinning arc */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin" />
          {/* Inner icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[60px] h-[60px] bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-md">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"/>
              </svg>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-1">Submitting your application</h2>
        <p className="text-sm text-slate-400 mb-7 truncate px-2">{orgName}</p>

        {/* Animated steps */}
        <div className="space-y-3 text-left mb-7">
          {steps.map((label, i) => {
            const done    = i < activeStep
            const current = i === activeStep
            const pending = i > activeStep
            return (
              <div
                key={label}
                className={`flex items-center gap-3 transition-all duration-500 ${pending ? 'opacity-30' : 'opacity-100'}`}
              >
                {/* Step icon */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                  done    ? 'bg-emerald-500'
                  : current ? 'bg-blue-600'
                  : 'bg-slate-100'
                }`}>
                  {done ? (
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M2 8l4 4 8-8"/></svg>
                  ) : current ? (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  ) : null}
                </div>
                {/* Label */}
                <span className={`text-sm font-medium ${
                  done    ? 'text-emerald-700'
                  : current ? 'text-blue-700'
                  : 'text-slate-400'
                }`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Please don't close this page.<br />You'll be redirected automatically.
        </p>
      </div>
    </div>
  )
}

// ── Loading skeleton ────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="h-16 bg-white border-b border-slate-200" />
      <div className="max-w-xl mx-auto px-4 py-10 space-y-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-32 mb-3" />
            <div className="h-12 bg-slate-100 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Confirmation screen ─────────────────────────────────────────────────────
function Confirmation({ leadId, formName, orgName }: { leadId: string; formName: string; orgName: string }) {
  const [copied, setCopied] = useState(false)
  function copyRef() {
    void navigator.clipboard.writeText(leadId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm text-center">
          {/* Success icon */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-30" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-sm">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">Application Submitted!</h1>
          <p className="text-slate-500 text-base leading-relaxed mb-6">
            Thank you for applying to <span className="font-semibold text-slate-700">{orgName}</span>.<br />
            Your application is under review.
          </p>

          {/* Reference number */}
          <div className="bg-slate-900 rounded-2xl px-6 py-5 mb-6 text-left">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-2">Reference Number</div>
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-blue-300 text-sm break-all flex-1">{leadId}</div>
              <button
                type="button"
                onClick={copyRef}
                title="Copy reference number"
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all
                           bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white"
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 8l4 4 8-8"/>
                    </svg>
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="5" width="9" height="9" rx="1.5"/>
                      <path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1"/>
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
              <div className="text-slate-400 text-xs font-semibold mb-1">Form</div>
              <div className="text-slate-700 font-medium text-xs leading-tight">{formName}</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-left">
              <div className="text-emerald-600 text-xs font-semibold mb-1">Status</div>
              <div className="text-emerald-700 font-semibold text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Under review
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            A confirmation email has been sent to you.<br />
            Decisions are communicated within <strong>6–8 weeks</strong>.
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          Powered by <span className="font-semibold text-slate-500">DAMS</span> · Admissions Platform
        </p>
      </div>
    </div>
  )
}

// ── Field renderer ──────────────────────────────────────────────────────────
function FieldRenderer({ field: f, value, onChange, onBlur, saved, error }: {
  field: Field; value: unknown; onChange: (v: unknown) => void
  onBlur: () => void; saved: boolean; error?: string
}) {
  if (f.type === 'heading') {
    return (
      <div className="flex items-center gap-3 mt-8 mb-2">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">{f.label}</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
    )
  }

  const cardClass = [
    'field-card',
    error ? 'has-error' : '',
    saved && !error ? 'is-saved' : '',
  ].filter(Boolean).join(' ')

  const inputClass = [
    'field-input',
    error ? 'field-input-error' : '',
    saved && !error ? 'field-input-saved' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cardClass} data-field-key={f.key}>
      {/* Label row */}
      <div className="flex items-start justify-between mb-2">
        <label className="text-sm font-semibold text-slate-800 leading-snug">
          {f.label}
          {f.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {saved && !error && (
          <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold shrink-0 ml-2">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 8l4 4 8-8"/></svg>
            Saved
          </span>
        )}
      </div>

      {f.hint && <p className="text-sm text-slate-400 mb-3 leading-relaxed">{f.hint}</p>}

      {/* Input by type */}
      {(f.type === 'text' || f.type === 'email' || f.type === 'tel' || f.type === 'url') && (
        <input type={f.type} className={inputClass} placeholder={f.placeholder}
          value={String(value ?? '')} onChange={e => onChange(e.target.value)} onBlur={onBlur} />
      )}

      {f.type === 'textarea' && (
        <>
          <textarea className={inputClass + ' resize-none'} rows={5} placeholder={f.placeholder}
            value={String(value ?? '')} onChange={e => onChange(e.target.value)} onBlur={onBlur} />
          <div className="flex items-center justify-between mt-1.5">
            <span />
            <span className="text-xs text-slate-400 font-mono">
              {String(value ?? '').split(/\s+/).filter(Boolean).length} words
              {f.validations?.maxLength && ` · ${String(value ?? '').length}/${f.validations.maxLength} chars`}
            </span>
          </div>
        </>
      )}

      {f.type === 'number' && (
        <input type="number" className={inputClass} placeholder={f.placeholder ?? '0'}
          min={f.validations?.min} max={f.validations?.max} step={f.validations?.step}
          value={String(value ?? '')} onChange={e => onChange(e.target.value)} onBlur={onBlur} />
      )}

      {f.type === 'date' && (
        <input type="date" className={inputClass}
          value={String(value ?? '')} onChange={e => onChange(e.target.value)} onBlur={onBlur} />
      )}

      {f.type === 'select' && (
        <select className={inputClass + ' cursor-pointer'}
          value={String(value ?? '')} onChange={e => { onChange(e.target.value); onBlur() }}>
          <option value="">Select an option…</option>
          {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {f.type === 'radio' && (
        <div className="flex flex-wrap gap-2 mt-1">
          {(f.options ?? []).map(o => (
            <button
              key={o} type="button"
              onClick={() => { onChange(o); onBlur() }}
              className={[
                'px-4 py-2 rounded-xl border text-sm font-medium transition-all duration-150',
                value === o
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50',
              ].join(' ')}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      {f.type === 'checkbox' && (
        <div className="flex flex-wrap gap-2 mt-1">
          {(f.options ?? []).map(o => {
            const sel = Array.isArray(value) && value.includes(o)
            return (
              <button
                key={o} type="button"
                onClick={() => {
                  const a = Array.isArray(value) ? [...value] : []
                  onChange(sel ? a.filter(x => x !== o) : [...a, o])
                  onBlur()
                }}
                className={[
                  'px-4 py-2 rounded-xl border text-sm font-medium transition-all duration-150 flex items-center gap-2',
                  sel
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50',
                ].join(' ')}
              >
                {sel && (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 8l4 4 8-8"/></svg>
                )}
                {o}
              </button>
            )
          })}
        </div>
      )}

      {f.type === 'file' && (
        <label className={[
          'relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all duration-200',
          value
            ? 'border-emerald-300 bg-emerald-50/50'
            : error
            ? 'border-red-300 bg-red-50/30'
            : 'border-slate-200 bg-slate-50/50 hover:border-blue-300 hover:bg-blue-50/30',
        ].join(' ')}>
          <input type="file" accept={f.validations?.accept} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            onChange={e => { if (e.target.files?.[0]) { onChange(e.target.files[0].name); onBlur() } }} />
          {value ? (
            <>
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 text-xl">✓</div>
              <div className="text-sm font-medium text-emerald-700 text-center break-all">{String(value)}</div>
              <div className="text-xs text-slate-400">Click to replace</div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-slate-400">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-700">Click or drag to upload</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {f.validations?.accept || 'Any file'} · max {f.validations?.maxSizeMB || 10}MB
                </div>
              </div>
            </>
          )}
        </label>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 mt-2.5 text-red-600">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="8" r="7"/><path d="M8 5v3M8 11h.01"/></svg>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ApplyPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const { data: formData, isLoading } = usePublicForm(slug)
  const form = formData?.data
  const orgName = (form as any)?.department?.name || 'Graduate Admissions'
  const orgInitial = String(orgName).trim().charAt(0).toUpperCase()

  const [step,        setStep]       = useState(0)
  const [values,      setValues]     = useState<Record<string, unknown>>({})
  const [errors,      setErrors]     = useState<Record<string, string>>({})
  const [leadId,      setLeadId]     = useState<string | null>(null)
  const leadIdRef = useRef<string | null>(null)
  const [saving,      setSaving]     = useState(false)
  const [savedAt,     setSavedAt]    = useState<Date | null>(null)
  const [submitted,   setSubmitted]  = useState(false)
  const [submitting,  setSubmitting] = useState(false)
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set())
  const sessionId   = useRef(getOrCreateSessionId())
  const saveTimer   = useRef<ReturnType<typeof setTimeout>>()
  const filledRef   = useRef<Set<string>>(new Set())

  useEffect(() => { captureUTMs() }, [])

  useEffect(() => {
    const onLeave = () => {
      if (!submitted && filledRef.current.size > 0 && leadId) {
        api.dropOff({ sessionId: sessionId.current, step, fieldsFilled: filledRef.current.size })
        trackEvent('form_drop_off', { step, slug })
      }
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [submitted, leadId, step, slug])

  const doSave = useCallback(async (vals: Record<string, unknown>) => {
    if (!form) return
    setSaving(true)
    try {
      const fields = (form.schemaJson as any).fields ?? []
      const total  = fields.length || 1
      const filled = Object.values(vals).filter(v => v !== '' && v !== null && v !== undefined).length
      const pct    = Math.min(100, Math.round(filled / total * 100))
      const res    = await api.partialSave({
        sessionId: sessionId.current, formId: form.id, departmentId: form.departmentId,
        dataJson: vals, gaClientId: getGA4ClientId(), ...getUTMs(),
        lastActivePage: step, fieldsFilled: filled, completionPct: pct, source: 'partial_save',
      })
      if (!leadIdRef.current) { leadIdRef.current = res.data.id; setLeadId(res.data.id) }
      setSavedAt(new Date())
      trackEvent('auto_save', { filled, pct, step, slug })
    } catch (e) { console.error('Save failed', e) }
    finally { setSaving(false) }
  }, [form, step, slug])

  function handleChange(key: string, value: unknown) {
    const next = { ...values, [key]: value }
    setValues(next)
    setErrors(prev => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n })
    if (value !== '' && value !== null && value !== undefined) filledRef.current.add(key)
    trackEvent('field_change', { field: key, step, slug })
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(next), 700)
  }

  function handleBlur(key: string) {
    if (values[key]) {
      setSavedFields(prev => { const s = new Set(prev); s.add(key); return s })
      setTimeout(() => setSavedFields(prev => { const s = new Set(prev); s.delete(key); return s }), 2500)
    }
    doSave({ ...values })
    trackEvent('field_blur', { field: key, step, slug })
  }

  function validateFields(fields: Field[], scope: 'page' | 'all') {
    const nextErrors: Record<string, string> = {}
    for (const f of fields) {
      const msg = validateField(f, values[f.key])
      if (msg) nextErrors[f.key] = msg
    }
    if (Object.keys(nextErrors).length) {
      setErrors(prev => scope === 'all' ? nextErrors : { ...prev, ...nextErrors })
      const firstKey = Object.keys(nextErrors)[0]
      const el = document.querySelector(`[data-field-key="${CSS.escape(firstKey)}"]`)
      if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' })
      trackEvent('validation_failed', { scope, step, slug, count: Object.keys(nextErrors).length })
      return false
    }
    return true
  }

  async function nextStep() {
    const fields   = (form?.schemaJson as any)?.fields ?? []
    const STEP_SIZE = 6
    const pages: Field[][] = []
    for (let i = 0; i < fields.length; i += STEP_SIZE) pages.push(fields.slice(i, i + STEP_SIZE))
    if (!validateFields(pages[step] ?? [], 'page')) return
    await doSave(values)
    setStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function prevStep() { setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  async function handleSubmit() {
    const fields = (form?.schemaJson as any)?.fields ?? []
    if (!validateFields(fields, 'all')) return
    setSubmitting(true)
    try {
      await doSave(values)
      const id = leadIdRef.current
      if (id) await api.submitLead(id, sessionId.current)
      trackEvent('form_submit', { slug, leadId: leadIdRef.current })
      setSubmitted(true)
    } catch (e) {
      console.error('Submit failed', e)
      setSubmitting(false)
    }
  }

  if (isLoading) return <LoadingSkeleton />
  if (!form)    return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">🔍</div>
        <div className="text-lg font-semibold text-slate-700 mb-1">Form not found</div>
        <div className="text-slate-400 text-sm">This application form may be inactive or the link is incorrect.</div>
      </div>
    </div>
  )
  if (submitted) return <Confirmation leadId={leadId!} formName={form.name} orgName={orgName} />

  // Build field list
  const MANDATORY_FIELDS: Field[] = [
    { id: '__fn', key: 'first_name', type: 'text',  label: 'First Name',    required: true, placeholder: 'Enter your first name' },
    { id: '__ln', key: 'last_name',  type: 'text',  label: 'Last Name',     required: true, placeholder: 'Enter your last name' },
    { id: '__em', key: 'email',      type: 'email', label: 'Email Address', required: true, placeholder: 'Enter your email address' },
    { id: '__ph', key: 'phone',      type: 'tel',   label: 'Phone Number',  required: true, placeholder: '+1 (555) 000-0000' },
  ]
  const schemaFields: Field[] = (form.schemaJson as any).fields ?? []
  const mandatoryKeys = new Set(['first_name','last_name','email','phone'])
  const allFields: Field[] = [...MANDATORY_FIELDS, ...schemaFields.filter((f: Field) => !mandatoryKeys.has(f.key))]

  const STEP_SIZE = 6
  const pages: Field[][] = []
  for (let i = 0; i < allFields.length; i += STEP_SIZE) pages.push(allFields.slice(i, i + STEP_SIZE))
  const currentFields = pages[step] ?? []

  const totalFields = allFields.filter(f => f.type !== 'heading').length
  const filled = Object.values(values).filter(v => v !== '' && v !== null && v !== undefined).length
  const pct    = Math.min(100, Math.round(filled / Math.max(totalFields, 1) * 100))
  const isLastStep = step === pages.length - 1

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* ── Top header ─────────────────────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-5 min-h-[56px] flex items-center justify-between sticky top-0 z-20 shadow-sm py-2.5 gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
            {orgInitial}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 leading-snug">{orgName}</div>
            <div className="text-xs text-slate-400 leading-none mt-0.5 truncate">{form.name}</div>
          </div>
        </div>

        {/* Auto-save indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {saving ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 whitespace-nowrap">
              <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              Saving…
            </div>
          ) : savedAt ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 whitespace-nowrap">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 8l4 4 8-8"/></svg>
              Saved {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          ) : null}
        </div>
      </header>

      {/* ── Step progress bar ───────────────────────────────────────────── */}
      {pages.length > 1 && (
        <div className="bg-white border-b border-slate-100 px-5 py-4">
          <div className="max-w-xl mx-auto">
            {/* Step dots */}
            <div className="flex items-center">
              {pages.map((_, i) => (
                <Fragment key={i}>
                  <div className="flex flex-col items-center">
                    <div className={[
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 shadow-sm',
                      i < step  ? 'bg-emerald-500 text-white'
                      : i === step ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-white border-2 border-slate-200 text-slate-400',
                    ].join(' ')}>
                      {i < step ? (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 8l4 4 8-8"/></svg>
                      ) : i + 1}
                    </div>
                    <div className={`text-[11px] mt-1 font-semibold ${i === step ? 'text-blue-600' : i < step ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {i === step ? 'Current' : i < step ? 'Done' : `Step ${i+1}`}
                    </div>
                  </div>
                  {i < pages.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all duration-500 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* ── Form body ──────────────────────────────────────────────────── */}
      <main className="max-w-xl mx-auto px-4 py-6 pb-32">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">
            {pages.length > 1 ? `Step ${step + 1} of ${pages.length}` : 'Application Form'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {pages.length > 1
              ? `Complete all required fields below to continue`
              : `Fill in all required fields and submit your application`
            }
          </p>
        </div>

        {currentFields.map((f: Field) => (
          <FieldRenderer
            key={f.id ?? f.key} field={f}
            value={values[f.key]}
            error={errors[f.key]}
            saved={savedFields.has(f.key)}
            onChange={v => handleChange(f.key, v)}
            onBlur={() => handleBlur(f.key)}
          />
        ))}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
          <button
            className="btn btn-outline gap-2"
            disabled={step === 0}
            onClick={prevStep}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 2L4 8l6 6"/></svg>
            Back
          </button>

          {!isLastStep ? (
            <button className="btn btn-primary gap-2" onClick={nextStep}>
              Continue
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2l6 6-6 6"/></svg>
            </button>
          ) : (
            <button
              className="btn btn-primary gap-2 bg-emerald-600 hover:bg-emerald-700 px-6 py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 8l4 4 8-8"/></svg>
                  Submit application
                </>
              )}
            </button>
          )}
        </div>
      </main>

      {/* ── Submit overlay ─────────────────────────────────────────────── */}
      {submitting && <SubmittingOverlay orgName={orgName} />}

      {/* ── Sticky bottom progress bar ──────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 px-5 py-3 shadow-lg">
        <div className="max-w-xl mx-auto flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-500">Progress</span>
              <span className="text-xs font-bold text-slate-700 font-mono">{pct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: pct >= 80
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : pct >= 40
                    ? 'linear-gradient(90deg, #3b82f6, #2563eb)'
                    : 'linear-gradient(90deg, #94a3b8, #64748b)',
                }}
              />
            </div>
          </div>
          <div className={[
            'text-xs font-bold px-3 py-1.5 rounded-full border shrink-0',
            pct >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : pct > 50  ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-slate-100 text-slate-500 border-slate-200',
          ].join(' ')}>
            {pct >= 100 ? '✓ Ready' : pct > 50 ? 'Almost done' : 'Keep going'}
          </div>
        </div>
      </div>
    </div>
  )
}
