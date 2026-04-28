'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { usePublicForm } from '@/hooks'
import { api } from '@/lib/api'
import { getGA4ClientId, getUTMs, captureUTMs, trackEvent, getOrCreateSessionId } from '@/lib/ga4'

export default function ApplyPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const { data: formData, isLoading } = usePublicForm(slug)
  const form = formData?.data

  const [step, setStep]           = useState(0)
  const [values, setValues]       = useState<Record<string,unknown>>({})
  const [leadId, setLeadId]       = useState<string|null>(null)
  const [saving, setSaving]       = useState(false)
  const [savedAt, setSavedAt]     = useState<Date|null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set())
  const sessionId = useRef(getOrCreateSessionId())
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const filledRef = useRef<Set<string>>(new Set())

  useEffect(() => { captureUTMs() }, [])

  useEffect(() => {
    const onLeave = () => {
      if (!submitted && filledRef.current.size > 0 && leadId) {
        api.dropOff({ sessionId:sessionId.current, step, fieldsFilled:filledRef.current.size })
        trackEvent('form_drop_off', { step, slug })
      }
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [submitted, leadId, step, slug])

  const doSave = useCallback(async (vals: Record<string,unknown>) => {
    if (!form) return
    setSaving(true)
    try {
      const fields = (form.schemaJson as any).fields ?? []
      const total  = fields.length || 1
      const filled = Object.values(vals).filter(v=>v!==''&&v!==null&&v!==undefined).length
      const pct    = Math.min(100, Math.round(filled/total*100))
      const res = await api.partialSave({
        sessionId: sessionId.current, formId:form.id, departmentId:form.departmentId,
        dataJson:vals, gaClientId:getGA4ClientId(), ...getUTMs(),
        lastActivePage:step, fieldsFilled:filled, completionPct:pct, source:'partial_save',
      })
      if (!leadId) setLeadId(res.data.id)
      setSavedAt(new Date())
      trackEvent('auto_save', { filled, pct, step, slug })
    } catch(e) { console.error('Save failed', e) }
    finally { setSaving(false) }
  }, [form, step, leadId, slug])

  function scheduleSave(vals: Record<string,unknown>) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(vals), 700)
  }

  function handleChange(key: string, value: unknown) {
    const next = { ...values, [key]:value }
    setValues(next)
    if (value !== '' && value !== null && value !== undefined) filledRef.current.add(key)
    scheduleSave(next)
    trackEvent('field_change', { field:key, step, slug })
  }

  function handleBlur(key: string) {
    if (values[key]) {
      setSavedFields(prev => { const s=new Set(prev); s.add(key); return s })
      setTimeout(()=>setSavedFields(prev=>{const s=new Set(prev);s.delete(key);return s}), 2200)
    }
    trackEvent('field_blur', { field:key, step, slug })
  }

  async function nextStep() { await doSave(values); setStep(s=>s+1); window.scrollTo({top:0,behavior:'smooth'}) }
  async function prevStep() { setStep(s=>s-1); window.scrollTo({top:0,behavior:'smooth'}) }

  async function handleSubmit() {
    await doSave(values)
    const id = leadId
    if (id) {
      try {
        await api.submitLead(id, sessionId.current)
      } catch(e) { console.error('Submit failed', e) }
    }
    trackEvent('form_submit', { slug, leadId: id })
    setSubmitted(true)
  }

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400 animate-pulse">Loading form…</div></div>
  if (!form) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400">Form not found or inactive.</div></div>
  if (submitted) return <Confirmation leadId={leadId!} formName={form.name} />

  const allFields = (form.schemaJson as any).fields ?? []
  const STEP_SIZE = 6
  const pages = []
  for (let i=0; i<allFields.length; i+=STEP_SIZE) pages.push(allFields.slice(i,i+STEP_SIZE))
  const currentFields = pages[step] ?? []
  const totalFields   = allFields.length
  const filled  = Object.values(values).filter(v=>v!==''&&v!==null&&v!==undefined).length
  const pct     = Math.min(100, Math.round(filled/Math.max(totalFields,1)*100))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-gray-900 rounded flex items-center justify-center text-white text-xs font-bold">G</div>
          <div>
            <div className="text-sm font-semibold">Graduate Admissions</div>
            <div className="text-xs text-gray-400">{form.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
          {saving && <><span className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin inline-block"/><span>Saving…</span></>}
          {!saving && savedAt && <span className="text-green-600">✓ Saved {savedAt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>}
          {leadId && <span className="text-gray-300 ml-1">| {leadId.slice(0,16)}…</span>}
        </div>
      </div>

      {/* Step progress */}
      {pages.length > 1 && (
        <div className="bg-white border-b border-gray-200 px-6">
          <div className="max-w-xl mx-auto flex items-center gap-0 py-3">
            {pages.map((_,i)=>(
              <div key={i} className="flex items-center flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition
                  ${i===step?'bg-gray-900 text-white':i<step?'bg-green-500 text-white':'border border-gray-300 text-gray-400'}`}>
                  {i<step?'✓':i+1}
                </div>
                {i<pages.length-1&&<div className={`flex-1 h-px mx-2 max-w-12 ${i<step?'bg-green-500':'bg-gray-200'}`}/>}
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-xl mx-auto px-4 py-8 pb-24">
        {leadId && (
          <div className="bg-gray-900 text-white rounded-lg px-4 py-2.5 mb-5 flex items-center justify-between">
            <div><div className="text-xs opacity-50 mb-0.5">Application ID</div><div className="font-mono text-xs text-blue-300">{leadId}</div></div>
            <span className="text-xs bg-white/10 rounded px-2 py-0.5 font-mono">Partial</span>
          </div>
        )}
        <h1 className="text-xl font-semibold mb-6">{pages.length>1?`Step ${step+1} of ${pages.length}`:'Application Form'}</h1>

        {currentFields.map((f: any) => (
          <FieldRenderer key={f.id||f.key} field={f} value={values[f.key]} saved={savedFields.has(f.key)}
            onChange={(v: unknown)=>handleChange(f.key,v)} onBlur={()=>handleBlur(f.key)} />
        ))}

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button className="btn btn-outline" disabled={step===0} onClick={prevStep}>← Back</button>
          {step < pages.length-1
            ? <button className="btn btn-dark" onClick={nextStep}>Continue →</button>
            : <button className="btn btn-dark" onClick={handleSubmit}>Submit application →</button>
          }
        </div>
      </main>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center gap-3">
        <span className="text-xs text-gray-500">{pct}%</span>
        <div className="flex-1 max-w-40 h-1 bg-gray-100 rounded overflow-hidden">
          <div className="h-full bg-gray-900 rounded transition-all duration-500" style={{width:`${pct}%`}}/>
        </div>
        <span className="text-xs font-medium text-gray-700">{pct>=100?'Ready to submit':pct>50?'Almost there':'Keep going'}</span>
      </div>
    </div>
  )
}

function FieldRenderer({field:f,value,onChange,onBlur,saved}:any) {
  const cls = `w-full border rounded px-3 py-2 text-sm outline-none transition ${saved?'border-green-400':'border-gray-300 focus:border-gray-700'}`
  const lbl = (<label className="block text-sm font-medium text-gray-700 mb-1">{f.label}{f.required&&<span className="text-red-500 ml-0.5">*</span>}{saved&&<span className="text-green-500 text-xs ml-2 font-normal font-mono">✓ saved</span>}</label>)
  const hint = f.hint?<p className="text-xs text-gray-400 mb-1">{f.hint}</p>:null

  if (f.type==='heading') return <div className="font-semibold text-base border-b-2 border-gray-200 pb-2 mb-4 mt-6">{f.label}</div>

  return (
    <div className="card mb-3">
      {lbl}{hint}
      {f.type==='textarea'&&<><textarea className={cls+' resize-none'} rows={4} placeholder={f.placeholder} value={String(value??'')} onChange={e=>onChange(e.target.value)} onBlur={onBlur}/><div className="text-right text-xs text-gray-400 font-mono mt-1">{String(value??'').split(/\s+/).filter(Boolean).length} words</div></>}
      {(f.type==='text'||f.type==='email'||f.type==='tel'||f.type==='url')&&<input type={f.type} className={cls} placeholder={f.placeholder} value={String(value??'')} onChange={e=>onChange(e.target.value)} onBlur={onBlur} required={f.required}/>}
      {f.type==='number'&&<input type="number" className={cls} placeholder={f.placeholder??'0'} min={f.validations?.min} max={f.validations?.max} step={f.validations?.step} value={String(value??'')} onChange={e=>onChange(e.target.value)} onBlur={onBlur}/>}
      {f.type==='date'&&<input type="date" className={cls} value={String(value??'')} onChange={e=>onChange(e.target.value)} onBlur={onBlur}/>}
      {f.type==='select'&&<select className={cls+' cursor-pointer'} value={String(value??'')} onChange={e=>{onChange(e.target.value);onBlur()}}><option value="">Select…</option>{(f.options??[]).map((o:string)=><option key={o}>{o}</option>)}</select>}
      {f.type==='radio'&&<div className="flex flex-wrap gap-2">{(f.options??[]).map((o:string)=><button key={o} type="button" onClick={()=>{onChange(o);onBlur()}} className={`px-3 py-1.5 rounded-full border text-sm transition ${value===o?'bg-gray-900 text-white border-gray-900':'border-gray-200 hover:border-gray-400'}`}>{o}</button>)}</div>}
      {f.type==='checkbox'&&<div className="flex flex-wrap gap-2">{(f.options??[]).map((o:string)=>{const sel=Array.isArray(value)&&value.includes(o);return<button key={o} type="button" onClick={()=>{const a=Array.isArray(value)?[...value]:[];onChange(sel?a.filter(x=>x!==o):[...a,o]);onBlur()}} className={`px-3 py-1.5 rounded border text-sm transition ${sel?'bg-gray-900 text-white border-gray-900':'border-gray-200 hover:border-gray-400'}`}>{o}</button>})}</div>}
      {f.type==='file'&&<div className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center hover:border-gray-400 transition cursor-pointer relative"><input type="file" accept={f.validations?.accept} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={e=>{if(e.target.files?.[0]){onChange(e.target.files[0].name);onBlur()}}}/><div className="text-xl mb-1">📎</div><div className="text-sm text-gray-600">{value?`✓ ${value}`:'Click or drag to upload'}</div><div className="text-xs text-gray-400 mt-1">{f.validations?.accept||''} · max {f.validations?.maxSizeMB||10}MB</div></div>}
    </div>
  )
}

function Confirmation({ leadId, formName }: { leadId:string; formName:string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white border border-gray-200 rounded-xl p-10 max-w-md text-center shadow-sm">
        <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5 text-white text-2xl">✓</div>
        <h1 className="text-xl font-semibold mb-2">Application submitted</h1>
        <p className="text-sm text-gray-500 mb-5 leading-relaxed">{formName}<br/>Your application has been received and is under review.</p>
        <div className="bg-gray-900 text-white rounded-lg px-6 py-4 inline-block mb-5">
          <div className="text-xs opacity-40 mb-1">Reference number</div>
          <div className="font-mono text-sm">{leadId}</div>
        </div>
        <p className="text-xs text-gray-400">A confirmation email has been sent. Decisions are communicated within 6–8 weeks.</p>
      </div>
    </div>
  )
}
