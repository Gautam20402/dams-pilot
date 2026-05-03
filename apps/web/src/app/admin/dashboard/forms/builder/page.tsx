'use client'
import { useEffect, useState, Suspense } from 'react'
import { useForms, useCreateForm, usePublishForm, useUpdateForm, useDepartments } from '@/hooks'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAdminPayload } from '@/lib/auth'

interface Field {
  id: string; type: string; label: string; key: string
  required: boolean; placeholder?: string; hint?: string
  options?: string[]; validations?: Record<string, unknown>
}

const MANDATORY_KEYS = new Set(['first_name', 'last_name', 'email', 'phone'])

const MANDATORY_BASE_FIELDS: Omit<Field, 'id'>[] = [
  { type: 'text',  label: 'First Name',    key: 'first_name', required: true,  validations: {} },
  { type: 'text',  label: 'Last Name',     key: 'last_name',  required: true,  validations: {} },
  { type: 'email', label: 'Email Address', key: 'email',      required: true,  validations: {} },
  { type: 'tel',   label: 'Phone Number',  key: 'phone',      required: true,  validations: {} },
]

const FIELD_TYPES = [
  { type: 'text',     icon: 'T',  label: 'Short text',    hint: 'Single line',        group: 'basic'   },
  { type: 'textarea', icon: '≡',  label: 'Long text',     hint: 'Essay / multi-line', group: 'basic'   },
  { type: 'email',    icon: '@',  label: 'Email',         hint: 'Validated email',    group: 'basic'   },
  { type: 'tel',      icon: '#',  label: 'Phone',         hint: 'Tel format',         group: 'basic'   },
  { type: 'number',   icon: '0',  label: 'Number',        hint: 'Min / max / step',   group: 'basic'   },
  { type: 'date',     icon: '□',  label: 'Date',          hint: 'Date picker',        group: 'basic'   },
  { type: 'select',   icon: '▾',  label: 'Dropdown',      hint: 'Single select',      group: 'choice'  },
  { type: 'radio',    icon: '◎',  label: 'Radio group',   hint: 'Pick one',           group: 'choice'  },
  { type: 'checkbox', icon: '☑',  label: 'Multi-select',  hint: 'Pick many',          group: 'choice'  },
  { type: 'file',     icon: '↑',  label: 'File upload',   hint: 'PDF, DOC, images',   group: 'special' },
  { type: 'url',      icon: '⊕',  label: 'URL',           hint: 'Web address',        group: 'special' },
  { type: 'heading',  icon: 'H',  label: 'Section header', hint: 'Divider / title',   group: 'special' },
]

const PALETTE_GROUPS = [
  { label: 'Basic fields',  key: 'basic'   },
  { label: 'Choice fields', key: 'choice'  },
  { label: 'Special',       key: 'special' },
]

// Department-specific starter presets (mandatory fields stripped — added automatically)
const DEPT_PRESETS: Record<string, Omit<Field, 'id'>[]> = {
  'computer-science': [
    { type: 'number',   label: 'GPA (4.0 scale)',  key: 'gpa',            required: true,  validations: { min: 0, max: 4 } },
    { type: 'select',   label: 'Degree Earned',    key: 'degree',         required: true,  options: ['BS', 'BA', 'BEng', 'Currently Enrolled'], validations: {} },
    { type: 'number',   label: 'GRE Score',        key: 'gre_score',      required: false, validations: { min: 260, max: 340 } },
    { type: 'checkbox', label: 'Specialization',   key: 'specialization', required: true,  options: ['AI', 'Data Science', 'Systems', 'Cybersecurity', 'HCI'], validations: {} },
    { type: 'textarea', label: 'Statement of Purpose', key: 'sop',        required: true,  validations: { minLength: 200, maxLength: 2000 } },
    { type: 'file',     label: 'Resume / CV',      key: 'resume',         required: true,  validations: { accept: '.pdf,.doc,.docx', maxSizeMB: 10 } },
    { type: 'file',     label: 'Transcript Upload', key: 'transcript',    required: true,  validations: { accept: '.pdf', maxSizeMB: 10 } },
  ],
  'business': [
    { type: 'number',   label: 'Work Experience (yrs)', key: 'work_exp',  required: true,  validations: { min: 0, max: 50 } },
    { type: 'text',     label: 'Current Employer',      key: 'employer',  required: true,  validations: {} },
    { type: 'text',     label: 'Job Title',             key: 'job_title', required: true,  validations: {} },
    { type: 'number',   label: 'GMAT Score',            key: 'gmat',      required: false, validations: { min: 200, max: 800 } },
    { type: 'textarea', label: 'Leadership Essay',      key: 'leadership', required: true, validations: { minLength: 300 } },
    { type: 'file',     label: 'Resume / CV',           key: 'resume',    required: true,  validations: { accept: '.pdf,.doc,.docx', maxSizeMB: 10 } },
  ],
  'mechanical': [
    { type: 'number',   label: 'GPA',           key: 'gpa',          required: true,  validations: { min: 0, max: 4 } },
    { type: 'checkbox', label: 'Core Subjects', key: 'core_subjects', required: false, options: ['Thermodynamics', 'Fluid Mechanics', 'Heat Transfer', 'Solid Mechanics'], validations: {} },
    { type: 'textarea', label: 'Statement of Purpose', key: 'sop',   required: true,  validations: { minLength: 200 } },
    { type: 'file',     label: 'Resume / CV',   key: 'resume',        required: true,  validations: { accept: '.pdf,.doc,.docx', maxSizeMB: 10 } },
  ],
  'psychology': [
    { type: 'radio',    label: 'Area of Interest',  key: 'psych_area',  required: true, options: ['Clinical', 'Cognitive', 'Behavioral', 'Developmental'], validations: {} },
    { type: 'textarea', label: 'Research Experience', key: 'research_exp', required: true, validations: { minLength: 150 } },
    { type: 'textarea', label: 'Statement of Purpose', key: 'sop',      required: true, validations: { minLength: 300 } },
    { type: 'file',     label: 'Writing Sample',    key: 'writing_sample', required: true, validations: { accept: '.pdf,.doc,.docx', maxSizeMB: 20 } },
  ],
  'design': [
    { type: 'radio',    label: 'Preferred Domain', key: 'design_domain',   required: true, options: ['UI/UX', 'Architecture', 'Product Design', 'Graphic Design'], validations: {} },
    { type: 'checkbox', label: 'Software Skills',  key: 'software_skills', required: true, options: ['Figma', 'AutoCAD', 'Photoshop', 'Illustrator', 'Blender'], validations: {} },
    { type: 'textarea', label: 'Design Statement', key: 'design_statement', required: true, validations: { minLength: 200 } },
    { type: 'file',     label: 'Portfolio Upload', key: 'portfolio',        required: true, validations: { accept: '.pdf,.zip', maxSizeMB: 50 } },
  ],
}

let _counter = 200
function uid() { return String(++_counter) }

function makeBaseFields(): Field[] {
  return MANDATORY_BASE_FIELDS.map(f => ({ ...f, id: uid() }))
}
function makePresetFields(deptSlug: string): Field[] {
  const extras = (DEPT_PRESETS[deptSlug] ?? []).filter(f => !MANDATORY_KEYS.has(f.key))
  return [...MANDATORY_BASE_FIELDS, ...extras].map(f => ({ ...f, id: uid() }))
}

function FormBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const admin  = getAdminPayload()
  const isAdmin = admin?.role === 'admin'

  // URL params
  const editId  = searchParams.get('edit')
  const isNew   = searchParams.get('new') === '1'
  const deptParam = searchParams.get('dept') // pre-selected dept id when creating new

  // State
  const [fields,         setFields]         = useState<Field[]>(makeBaseFields)
  const [selected,       setSelected]       = useState<string | null>(null)
  const [formName,       setFormName]       = useState('')
  const [formTitle,      setFormTitle]      = useState('')
  const [dept,           setDept]           = useState<string>('')   // slug
  const [deptId,         setDeptId]         = useState<string>('')   // id
  const [editingFormId,  setEditingFormId]  = useState<string | null>(editId)
  const [didInit,        setDidInit]        = useState(false)
  const [dragSrc,        setDragSrc]        = useState<string | null>(null)
  const [saved,          setSaved]          = useState(true)
  const [publishedUrl,   setPublishedUrl]   = useState<string | null>(null)
  const [copiedModal,    setCopiedModal]    = useState(false)

  const { data: formsData } = useForms()
  const { data: deptData }  = useDepartments()
  const { mutate: createForm, isPending: creating } = useCreateForm()
  const { mutate: publishForm }                     = usePublishForm()
  const { mutate: updateForm,  isPending: updating } = useUpdateForm()

  const forms:       any[] = formsData?.data ?? []
  const departments: any[] = deptData?.data  ?? []

  const currentForm = editingFormId ? forms.find(f => String(f.id) === editingFormId) : null
  const isPublished = Boolean(currentForm?.slug)

  // Dept user: lock to their dept
  const lockedDeptId   = !isAdmin ? admin?.departmentId : undefined
  const lockedDept     = lockedDeptId ? departments.find(d => d.id === lockedDeptId) : undefined
  const currentDeptName = !isAdmin
    ? (lockedDept?.name ?? 'Your Department')
    : (departments.find(d => d.slug === dept)?.name ?? dept)

  // ── Initialise ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (didInit || departments.length === 0) return

    // Dept admin: always locked to own dept
    if (!isAdmin && lockedDept) {
      setDept(lockedDept.slug)
      setDeptId(lockedDept.id)
    }

    if (editId) {
      // Wait for forms to load before editing
      if (forms.length === 0) return
      const target = forms.find(f => String(f.id) === editId)
      if (target) loadFormForEdit(target)
      else router.replace('/admin/dashboard/forms')
      setDidInit(true)
      return
    }

    if (isNew) {
      // Pre-select dept if provided
      const initialDeptId = lockedDeptId ?? deptParam ?? departments[0]?.id ?? ''
      const initialDept   = departments.find(d => d.id === initialDeptId)
      if (initialDept) {
        setDeptId(initialDept.id)
        setDept(initialDept.slug)
        setFields(makePresetFields(initialDept.slug))
      } else {
        setFields(makeBaseFields())
      }
      setEditingFormId(null)
      setDidInit(true)
      return
    }

    setDidInit(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments, forms, didInit])

  function loadFormForEdit(form: any) {
    const full = String(form?.name ?? '')
    const [n, t] = full.split('—').map((s: string) => s.trim())
    setFormName(n || full || 'Untitled form')
    setFormTitle(t || '')
    setEditingFormId(String(form.id))
    setSelected(null)

    const d = departments.find(x => x.id === form.departmentId)
    if (d) { setDept(d.slug); setDeptId(d.id) }

    const schemaFields = (form?.schemaJson as any)?.fields ?? []
    const mapped: Field[] = schemaFields.map((sf: any) => ({
      id: uid(), type: String(sf.type ?? 'text'), label: String(sf.label ?? ''),
      key: String(sf.key ?? ''), required: Boolean(sf.required),
      placeholder: sf.placeholder ? String(sf.placeholder) : undefined,
      hint: sf.hint ? String(sf.hint) : undefined,
      options: Array.isArray(sf.options) ? sf.options.map(String) : [],
      validations: (sf.validations ?? {}) as Record<string, unknown>,
    }))
    const existingKeys = new Set(mapped.map(f => f.key))
    const missing = MANDATORY_BASE_FIELDS.filter(f => !existingKeys.has(f.key)).map(f => ({ ...f, id: uid() }))
    setFields([...missing, ...mapped.filter(f => !MANDATORY_KEYS.has(f.key)), ...mapped.filter(f => MANDATORY_KEYS.has(f.key))])
    triggerSave()
  }

  function switchDept(newDeptId: string) {
    if (!isAdmin) return
    const d = departments.find(x => x.id === newDeptId)
    if (!d) return
    setDeptId(d.id)
    setDept(d.slug)
    setFields(makePresetFields(d.slug))
    setSelected(null)
    triggerSave()
  }

  const displayFormTitle = formTitle.trim() ? `${formName} — ${formTitle}` : formName

  function currentSchemaJson() {
    return { fields: fields.map(({ id: _, ...f }) => f) }
  }

  function getActiveDeptId() {
    if (!isAdmin && lockedDeptId) return lockedDeptId
    return deptId || departments[0]?.id || ''
  }

  function saveDraft(opts?: { onSuccess?: (id: string, slug?: string) => void }) {
    const schemaJson = currentSchemaJson()
    const name = displayFormTitle || 'Untitled form'

    if (editingFormId) {
      updateForm({ id: editingFormId, data: { name, schemaJson } }, {
        onSuccess: (res: any) => opts?.onSuccess?.(editingFormId, res?.data?.slug),
      })
      return
    }
    createForm({ name, departmentId: getActiveDeptId(), schemaJson }, {
      onSuccess: (res: any) => {
        const id = String(res.data.id)
        setEditingFormId(id)
        opts?.onSuccess?.(id, res?.data?.slug)
      },
    })
  }

  function handlePublish() {
    saveDraft({
      onSuccess: (formId, slug) => {
        publishForm(formId, {
          onSuccess: (pubRes: any) => {
            const finalSlug = pubRes.data?.slug ?? slug
            if (finalSlug) setPublishedUrl(`${window.location.origin}/public/apply/${finalSlug}`)
          },
        })
      },
    })
  }

  // ── Field palette actions ────────────────────────────────────────────────────
  function addFieldType(type: string) {
    const id = uid()
    const defaults: Record<string, Partial<Field>> = {
      text:     { label: 'Text field',    key: 'text_' + id,    placeholder: 'Enter text…' },
      textarea: { label: 'Long text',     key: 'text_' + id,    placeholder: 'Write here…' },
      email:    { label: 'Email',         key: 'email_' + id,   placeholder: 'you@email.com' },
      tel:      { label: 'Phone',         key: 'phone_' + id,   placeholder: '+1 (555) 000-0000' },
      number:   { label: 'Number',        key: 'number_' + id,  validations: { min: 0 } },
      date:     { label: 'Date',          key: 'date_' + id },
      select:   { label: 'Dropdown',      key: 'select_' + id,  options: ['Option 1', 'Option 2', 'Option 3'] },
      radio:    { label: 'Radio group',   key: 'radio_' + id,   options: ['Option A', 'Option B'] },
      checkbox: { label: 'Multi-select',  key: 'multi_' + id,   options: ['Option A', 'Option B'] },
      file:     { label: 'File upload',   key: 'file_' + id,    validations: { accept: '.pdf,.doc,.docx', maxSizeMB: 10 } },
      url:      { label: 'URL',           key: 'url_' + id,     placeholder: 'https://' },
      heading:  { label: 'Section Heading', key: 'heading_' + id },
    }
    const f: Field = { id, type, required: false, validations: {}, options: [], ...defaults[type] } as Field
    setFields(prev => [...prev, f])
    setSelected(id)
    triggerSave()
  }

  function updateField(id: string, key: string, val: unknown) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f))
    triggerSave()
  }
  function updateValidation(id: string, key: string, val: unknown) {
    setFields(prev => prev.map(f => f.id === id
      ? { ...f, validations: { ...f.validations, [key]: val === '' ? undefined : val } }
      : f))
    triggerSave()
  }
  function updateOption(id: string, idx: number, val: string) {
    setFields(prev => prev.map(f => {
      if (f.id !== id) return f
      const opts = [...(f.options ?? [])]; opts[idx] = val; return { ...f, options: opts }
    }))
  }
  function addOption(id: string) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, options: [...(f.options ?? []), 'New option'] } : f))
  }
  function removeOption(id: string, idx: number) {
    setFields(prev => prev.map(f => f.id === id
      ? { ...f, options: (f.options ?? []).filter((_, i) => i !== idx) }
      : f))
  }
  function deleteField(id: string) {
    const field = fields.find(f => f.id === id)
    if (field && MANDATORY_KEYS.has(field.key)) return
    setFields(prev => prev.filter(f => f.id !== id))
    if (selected === id) setSelected(null)
    triggerSave()
  }
  function duplicateField(id: string) {
    const f = fields.find(x => x.id === id); if (!f) return
    const copy = { ...JSON.parse(JSON.stringify(f)), id: uid(), label: f.label + ' (copy)', key: f.key + '_copy' }
    const idx = fields.findIndex(x => x.id === id)
    setFields(prev => { const n = [...prev]; n.splice(idx + 1, 0, copy); return n })
    triggerSave()
  }

  // Drag-and-drop
  function onDragStart(e: React.DragEvent, id: string) { setDragSrc(id); e.dataTransfer.effectAllowed = 'move' }
  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (!dragSrc || dragSrc === id) return
    const from = fields.findIndex(f => f.id === dragSrc)
    const to   = fields.findIndex(f => f.id === id)
    if (from === -1 || to === -1) return
    setFields(prev => { const n = [...prev]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n })
    setDragSrc(id)
  }
  function onDragEnd() { setDragSrc(null); triggerSave() }

  function triggerSave() { setSaved(false); setTimeout(() => setSaved(true), 800) }

  function vTags(f: Field) {
    const v = f.validations ?? {}; const t: string[] = []
    if ((v as any).minLength)              t.push(`min ${(v as any).minLength} chars`)
    if ((v as any).maxLength)              t.push(`max ${(v as any).maxLength} chars`)
    if ((v as any).min !== undefined)      t.push(`≥${(v as any).min}`)
    if ((v as any).max !== undefined)      t.push(`≤${(v as any).max}`)
    if ((v as any).accept)                 t.push((v as any).accept)
    if ((v as any).maxSizeMB)             t.push(`≤${(v as any).maxSizeMB}MB`)
    return t
  }

  const selectedField = fields.find(f => f.id === selected)
  const primaryBusy   = creating || updating

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col overflow-hidden bg-slate-50">

      {/* Published URL modal */}
      {publishedUrl && (
        <div className="modal-overlay" onClick={() => setPublishedUrl(null)}>
          <div className="modal-panel max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white text-xl shadow-sm">✓</div>
              <div>
                <div className="modal-title">Form published!</div>
                <div className="modal-sub">Share this link with applicants</div>
              </div>
              <button type="button" onClick={() => setPublishedUrl(null)} className="btn-icon ml-auto text-slate-400">✕</button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-xs font-mono text-slate-700 break-all">{publishedUrl}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { void navigator.clipboard.writeText(publishedUrl); setCopiedModal(true); setTimeout(() => setCopiedModal(false), 2000) }}
                className={`btn flex-1 text-sm py-2 rounded-lg ${copiedModal ? 'bg-emerald-500 text-white' : 'btn-dark'}`}
              >
                {copiedModal ? '✓ Copied!' : 'Copy link'}
              </button>
              <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline text-sm py-2 px-4">Open ↗</a>
            </div>
          </div>
        </div>
      )}

      {/* Builder topbar */}
      <div className="bg-white border-b border-slate-200 px-4 h-12 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/dashboard/forms')}
            className="btn btn-ghost btn-sm gap-1.5 text-slate-500"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 2L4 8l6 6"/>
            </svg>
            All forms
          </button>
          <span className="text-slate-200">|</span>
          <div className={`w-2 h-2 rounded-full transition-colors ${saved ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <span className="text-xs text-slate-400">{saved ? 'Saved' : 'Saving…'}</span>
          {editingFormId && (
            <>
              <span className="text-slate-200">|</span>
              <span className="text-xs text-slate-500 font-mono truncate max-w-[200px]">{displayFormTitle || 'Untitled'}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-outline btn-sm" disabled={primaryBusy} onClick={() => saveDraft()}>
            Save draft
          </button>
          <button className="btn btn-primary btn-sm" disabled={primaryBusy} onClick={handlePublish}>
            {primaryBusy ? 'Publishing…' : isPublished ? 'Update & publish' : 'Publish form'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left palette ──────────────────────────────────────────────── */}
        <aside className="w-52 bg-white border-r border-slate-200 overflow-y-auto shrink-0">
          <div className="p-3 space-y-4">
            {PALETTE_GROUPS.map(group => (
              <div key={group.key}>
                <div className="section-label mb-2 px-1">{group.label}</div>
                {FIELD_TYPES.filter(ft => ft.group === group.key).map(ft => (
                  <button
                    key={ft.type}
                    type="button"
                    onClick={() => addFieldType(ft.type)}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50 cursor-pointer mb-1 transition text-left"
                  >
                    <span className="w-6 h-6 bg-slate-100 rounded-md flex items-center justify-center text-xs font-semibold shrink-0 text-slate-600">
                      {ft.icon}
                    </span>
                    <div>
                      <div className="text-xs font-medium text-slate-800">{ft.label}</div>
                      <div className="text-[11px] text-slate-400">{ft.hint}</div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Canvas ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-2xl mx-auto space-y-3">

            {/* Form metadata */}
            <div className="card">
              <div className="text-sm font-semibold text-slate-900 mb-0.5">Form settings</div>
              <div className="text-xs text-slate-400 mb-4">Name, intake term, and department</div>

              {/* Department */}
              <div className="mb-4">
                <label className="label">Department</label>
                {!isAdmin ? (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-sm font-medium text-blue-800">{currentDeptName}</span>
                    <span className="ml-auto text-xs text-blue-400 bg-blue-100 px-2 py-0.5 rounded-full">Locked</span>
                  </div>
                ) : (
                  <select
                    className="sel text-sm w-full"
                    value={deptId}
                    onChange={e => switchDept(e.target.value)}
                  >
                    <option value="">Select department…</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="form_name">Form name</label>
                  <input id="form_name" className="input text-sm" placeholder="e.g. MS Computer Science"
                    value={formName} onChange={e => { setFormName(e.target.value); triggerSave() }} />
                </div>
                <div>
                  <label className="label" htmlFor="form_title">Intake / Term</label>
                  <input id="form_title" className="input text-sm" placeholder="e.g. Fall 2025"
                    value={formTitle} onChange={e => { setFormTitle(e.target.value); triggerSave() }} />
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                <span>Preview:</span>
                <span className="font-semibold text-slate-700">{displayFormTitle || 'Untitled form'}</span>
                <span className="text-slate-200">·</span>
                <span>{fields.length} fields</span>
                {isPublished && (
                  <>
                    <span className="text-slate-200">·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Published
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Fields */}
            {fields.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-16 text-center text-slate-400">
                <div className="text-3xl mb-2 opacity-40">⊕</div>
                <div className="text-sm">Click a field type on the left to add it</div>
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map(f => (
                  <div
                    key={f.id}
                    draggable
                    onDragStart={e => onDragStart(e, f.id)}
                    onDragOver={e => onDragOver(e, f.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => setSelected(f.id === selected ? null : f.id)}
                    className={[
                      'bg-white border rounded-xl p-3.5 cursor-pointer transition-all select-none',
                      selected === f.id
                        ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
                      dragSrc === f.id ? 'opacity-40 scale-95' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-slate-300 cursor-grab text-base">⠿</span>
                      <span className="text-[11px] font-mono bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-500">{f.type}</span>
                      <span className="text-sm font-medium text-slate-800 flex-1 truncate">{f.label || 'Untitled'}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${f.required ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-slate-100 text-slate-400'}`}>
                        {f.required ? 'required' : 'optional'}
                      </span>
                      {!MANDATORY_KEYS.has(f.key) && (
                        <button type="button" onClick={e => { e.stopPropagation(); duplicateField(f.id) }}
                          className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 text-xs" title="Duplicate">⧉</button>
                      )}
                      {MANDATORY_KEYS.has(f.key)
                        ? <span className="text-[11px] text-blue-400 font-medium">locked</span>
                        : <button type="button" onClick={e => { e.stopPropagation(); deleteField(f.id) }}
                            className="w-6 h-6 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-400 text-xs" title="Delete">✕</button>
                      }
                    </div>

                    {/* Preview */}
                    {f.type === 'heading' ? (
                      <div className="text-sm font-semibold text-slate-800 border-b-2 border-slate-200 pb-1.5">{f.label}</div>
                    ) : ['radio', 'checkbox'].includes(f.type) ? (
                      <div className="flex flex-wrap gap-1.5 pointer-events-none">
                        {(f.options ?? []).slice(0, 5).map(o => (
                          <span key={o} className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs text-slate-400 bg-slate-50">{o}</span>
                        ))}
                        {(f.options?.length ?? 0) > 5 && <span className="text-xs text-slate-400 self-center">+{(f.options?.length ?? 0) - 5} more</span>}
                      </div>
                    ) : f.type === 'select' ? (
                      <div className="h-8 border border-slate-200 rounded-lg bg-slate-50 flex items-center px-2 text-xs text-slate-300 pointer-events-none justify-between">
                        <span>{f.placeholder || 'Select an option…'}</span><span>▾</span>
                      </div>
                    ) : f.type === 'file' ? (
                      <div className="border-2 border-dashed border-slate-200 rounded-lg p-2.5 text-xs text-slate-400 text-center pointer-events-none">
                        📎 {(f.validations as any)?.accept || 'Any file'} · max {(f.validations as any)?.maxSizeMB || 10}MB
                      </div>
                    ) : (
                      <div className="h-8 border border-slate-200 rounded-lg bg-slate-50 flex items-center px-3 text-xs text-slate-300 pointer-events-none">
                        {f.placeholder || f.label}
                      </div>
                    )}

                    {vTags(f).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {vTags(f).map(t => (
                          <span key={t} className="text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-md px-1.5 py-0.5 font-mono">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Inspector ─────────────────────────────────────────────────── */}
        <aside className="w-72 bg-white border-l border-slate-200 overflow-y-auto shrink-0">
          {!selectedField ? (
            <div className="flex flex-col h-full text-slate-400">
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center border-b border-slate-100">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl mb-3 opacity-60">◎</div>
                <div className="text-sm text-slate-500 font-medium">Field properties</div>
                <div className="text-xs mt-1">Click any field to edit its settings</div>
              </div>
              <div className="p-4">
                <div className="section-label mb-2">Tips</div>
                <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
                  <li>• Drag fields to reorder them</li>
                  <li>• Locked fields are required on all forms</li>
                  <li>• Use "Save draft" to save without publishing</li>
                  <li>• "Publish" makes the form publicly accessible</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="section-label">Field properties</div>
                <span className="font-mono text-[10px] bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-500">{selectedField.type}</span>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="label">Label</label>
                  <input className="input text-xs" value={selectedField.label}
                    onChange={e => updateField(selectedField.id, 'label', e.target.value)} />
                </div>
                <div>
                  <label className="label">Field key <span className="text-slate-400 font-normal">(API)</span></label>
                  <input className="input text-xs font-mono" value={selectedField.key}
                    onChange={e => updateField(selectedField.id, 'key', e.target.value)} />
                </div>
                {!['heading', 'file', 'radio', 'checkbox', 'select'].includes(selectedField.type) && (
                  <div>
                    <label className="label">Placeholder</label>
                    <input className="input text-xs" value={selectedField.placeholder ?? ''}
                      onChange={e => updateField(selectedField.id, 'placeholder', e.target.value)} />
                  </div>
                )}
                <div>
                  <label className="label">Helper text</label>
                  <input className="input text-xs" value={selectedField.hint ?? ''}
                    onChange={e => updateField(selectedField.id, 'hint', e.target.value)}
                    placeholder="Shown below the field" />
                </div>
                <div
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => updateField(selectedField.id, 'required', !selectedField.required)}
                >
                  <div>
                    <div className="text-xs font-medium text-slate-800">Required field</div>
                    <div className="text-[11px] text-slate-400">Must be filled to submit</div>
                  </div>
                  <div className={`w-9 h-5 rounded-full relative transition-colors ${selectedField.required ? 'bg-blue-600' : 'bg-slate-200'}`}>
                    <div className="absolute w-3.5 h-3.5 bg-white rounded-full top-0.5 transition-all shadow-sm"
                      style={{ left: selectedField.required ? '18px' : '2px' }} />
                  </div>
                </div>
              </div>

              {['select', 'radio', 'checkbox'].includes(selectedField.type) && (
                <div className="mb-5">
                  <div className="section-label mb-3 border-t border-slate-100 pt-4">Options</div>
                  {(selectedField.options ?? []).map((opt, i) => (
                    <div key={i} className="flex gap-1.5 mb-1.5">
                      <input className="input text-xs flex-1" value={opt}
                        onChange={e => updateOption(selectedField.id, i, e.target.value)} />
                      <button type="button" onClick={() => removeOption(selectedField.id, i)}
                        className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addOption(selectedField.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1">+ Add option</button>
                </div>
              )}

              {selectedField.type !== 'heading' && (
                <div>
                  <div className="section-label mb-3 border-t border-slate-100 pt-4">Validation rules</div>
                  {['text', 'textarea', 'email', 'url'].includes(selectedField.type) && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="label">Min length</label>
                        <input type="number" className="input text-xs"
                          value={(selectedField.validations as any)?.minLength ?? ''}
                          onChange={e => updateValidation(selectedField.id, 'minLength', e.target.value ? parseInt(e.target.value) : '')} placeholder="e.g. 10" />
                      </div>
                      <div>
                        <label className="label">Max length</label>
                        <input type="number" className="input text-xs"
                          value={(selectedField.validations as any)?.maxLength ?? ''}
                          onChange={e => updateValidation(selectedField.id, 'maxLength', e.target.value ? parseInt(e.target.value) : '')} placeholder="e.g. 500" />
                      </div>
                    </div>
                  )}
                  {selectedField.type === 'number' && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="label">Min</label>
                        <input type="number" className="input text-xs"
                          value={(selectedField.validations as any)?.min ?? ''}
                          onChange={e => updateValidation(selectedField.id, 'min', e.target.value !== '' ? parseFloat(e.target.value) : '')} />
                      </div>
                      <div>
                        <label className="label">Max</label>
                        <input type="number" className="input text-xs"
                          value={(selectedField.validations as any)?.max ?? ''}
                          onChange={e => updateValidation(selectedField.id, 'max', e.target.value !== '' ? parseFloat(e.target.value) : '')} />
                      </div>
                      <div className="col-span-2">
                        <label className="label">Step</label>
                        <input type="number" className="input text-xs"
                          value={(selectedField.validations as any)?.step ?? ''}
                          onChange={e => updateValidation(selectedField.id, 'step', e.target.value ? parseFloat(e.target.value) : '')} placeholder="e.g. 0.01" />
                      </div>
                    </div>
                  )}
                  {selectedField.type === 'file' && (
                    <div className="space-y-2">
                      <div>
                        <label className="label">Accepted types</label>
                        <input className="input text-xs font-mono"
                          value={(selectedField.validations as any)?.accept ?? ''}
                          onChange={e => updateValidation(selectedField.id, 'accept', e.target.value)} placeholder=".pdf,.doc,.docx" />
                      </div>
                      <div>
                        <label className="label">Max size (MB)</label>
                        <input type="number" className="input text-xs"
                          value={(selectedField.validations as any)?.maxSizeMB ?? ''}
                          onChange={e => updateValidation(selectedField.id, 'maxSizeMB', e.target.value ? parseInt(e.target.value) : '')} placeholder="10" />
                      </div>
                    </div>
                  )}
                  {['text', 'email'].includes(selectedField.type) && (
                    <div className="mt-2">
                      <label className="label">Regex pattern <span className="text-slate-400 font-normal">(optional)</span></label>
                      <input className="input text-xs font-mono"
                        value={(selectedField.validations as any)?.pattern ?? ''}
                        onChange={e => updateValidation(selectedField.id, 'pattern', e.target.value || undefined)} placeholder="e.g. ^[A-Z].*" />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-6 border-t border-slate-100 pt-4">
                {!MANDATORY_KEYS.has(selectedField.key) && (
                  <button type="button" className="btn btn-outline btn-sm flex-1 text-xs"
                    onClick={() => duplicateField(selectedField.id)}>Duplicate</button>
                )}
                {MANDATORY_KEYS.has(selectedField.key) ? (
                  <p className="text-xs text-blue-500 text-center w-full py-1 font-medium">
                    Required on all forms — cannot be removed.
                  </p>
                ) : (
                  <button type="button" className="btn-danger flex-1 text-xs rounded-lg"
                    onClick={() => deleteField(selectedField.id)}>Delete field</button>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export default function FormBuilderPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <span className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      </div>
    }>
      <FormBuilderPage />
    </Suspense>
  )
}
