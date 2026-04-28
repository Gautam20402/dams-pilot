'use client'
import { useState } from 'react'
import { useForms, useCreateForm, usePublishForm, useUpdateForm } from '@/hooks'

interface Field {
  id: string; type: string; label: string; key: string
  required: boolean; placeholder?: string; hint?: string
  options?: string[]; validations?: Record<string,unknown>
}

const FIELD_TYPES = [
  { type:'text',     icon:'T',  label:'Short text',    hint:'Single line' },
  { type:'textarea', icon:'≡',  label:'Long text',     hint:'Essay / multi-line' },
  { type:'email',    icon:'@',  label:'Email',         hint:'Validated email' },
  { type:'tel',      icon:'#',  label:'Phone',         hint:'Tel format' },
  { type:'number',   icon:'0',  label:'Number',        hint:'Min / max / step' },
  { type:'date',     icon:'□',  label:'Date',          hint:'Date picker' },
  { type:'select',   icon:'▾',  label:'Dropdown',      hint:'Single select' },
  { type:'radio',    icon:'◎',  label:'Radio group',   hint:'Pick one' },
  { type:'checkbox', icon:'☑',  label:'Multi-select',  hint:'Pick many' },
  { type:'file',     icon:'↑',  label:'File upload',   hint:'PDF, DOC, images' },
  { type:'url',      icon:'⊕',  label:'URL',           hint:'Web address' },
  { type:'heading',  icon:'H',  label:'Section header',hint:'Divider' },
]

const DEPT_PRESETS: Record<string,Field[]> = {
  cs:[
    {id:'1',type:'text',   label:'First Name',         key:'first_name',  required:true,  validations:{minLength:2}},
    {id:'2',type:'text',   label:'Last Name',          key:'last_name',   required:true,  validations:{minLength:2}},
    {id:'3',type:'email',  label:'Email Address',      key:'email',       required:true,  validations:{}},
    {id:'4',type:'tel',    label:'Phone Number',       key:'phone',       required:true,  validations:{}},
    {id:'5',type:'number', label:'GPA (4.0 scale)',    key:'gpa',         required:true,  validations:{min:0,max:4}},
    {id:'6',type:'select', label:'Degree Earned',      key:'degree',      required:true,  options:['BS','BA','BEng','Currently Enrolled'],validations:{}},
    {id:'7',type:'number', label:'GRE Score',          key:'gre_score',   required:false, validations:{min:260,max:340}},
    {id:'8',type:'checkbox',label:'Specialization',    key:'specialization',required:true,options:['AI','Data Science','Systems','Cybersecurity','HCI'],validations:{}},
    {id:'9',type:'textarea',label:'Statement of Purpose',key:'sop',       required:true,  validations:{minLength:200,maxLength:2000}},
    {id:'10',type:'file',  label:'Resume / CV',        key:'resume',      required:true,  validations:{accept:'.pdf,.doc,.docx',maxSizeMB:10}},
    {id:'11',type:'file',  label:'Transcript Upload',  key:'transcript',  required:true,  validations:{accept:'.pdf',maxSizeMB:10}},
  ],
  business:[
    {id:'1',type:'text',   label:'First Name',         key:'first_name',  required:true,  validations:{}},
    {id:'2',type:'text',   label:'Last Name',          key:'last_name',   required:true,  validations:{}},
    {id:'3',type:'email',  label:'Email Address',      key:'email',       required:true,  validations:{}},
    {id:'4',type:'number', label:'Work Experience (yrs)',key:'work_exp',  required:true,  validations:{min:0,max:50}},
    {id:'5',type:'text',   label:'Current Employer',   key:'employer',    required:true,  validations:{}},
    {id:'6',type:'text',   label:'Job Title',          key:'job_title',   required:true,  validations:{}},
    {id:'7',type:'number', label:'GMAT Score',         key:'gmat',        required:false, validations:{min:200,max:800}},
    {id:'8',type:'textarea',label:'Leadership Essay',  key:'leadership',  required:true,  validations:{minLength:300}},
    {id:'9',type:'file',   label:'Resume / CV',        key:'resume',      required:true,  validations:{accept:'.pdf,.doc,.docx',maxSizeMB:10}},
  ],
  mechanical:[
    {id:'1',type:'text',   label:'First Name',         key:'first_name',  required:true, validations:{}},
    {id:'2',type:'text',   label:'Last Name',          key:'last_name',   required:true, validations:{}},
    {id:'3',type:'email',  label:'Email Address',      key:'email',       required:true, validations:{}},
    {id:'4',type:'number', label:'GPA',                key:'gpa',         required:true, validations:{min:0,max:4}},
    {id:'5',type:'checkbox',label:'Core Subjects',     key:'core_subjects',required:false,options:['Thermodynamics','Fluid Mechanics','Heat Transfer','Solid Mechanics'],validations:{}},
    {id:'6',type:'textarea',label:'Statement of Purpose',key:'sop',       required:true, validations:{minLength:200}},
    {id:'7',type:'file',   label:'Resume / CV',        key:'resume',      required:true, validations:{accept:'.pdf,.doc,.docx',maxSizeMB:10}},
  ],
  psychology:[
    {id:'1',type:'text',   label:'First Name',         key:'first_name',  required:true, validations:{}},
    {id:'2',type:'text',   label:'Last Name',          key:'last_name',   required:true, validations:{}},
    {id:'3',type:'email',  label:'Email Address',      key:'email',       required:true, validations:{}},
    {id:'4',type:'radio',  label:'Area of Interest',   key:'psych_area',  required:true, options:['Clinical','Cognitive','Behavioral','Developmental'],validations:{}},
    {id:'5',type:'textarea',label:'Research Experience',key:'research_exp',required:true,validations:{minLength:150}},
    {id:'6',type:'textarea',label:'Statement of Purpose',key:'sop',       required:true, validations:{minLength:300}},
    {id:'7',type:'file',   label:'Writing Sample',     key:'writing_sample',required:true,validations:{accept:'.pdf,.doc,.docx',maxSizeMB:20}},
  ],
  design:[
    {id:'1',type:'text',   label:'First Name',         key:'first_name',  required:true, validations:{}},
    {id:'2',type:'text',   label:'Last Name',          key:'last_name',   required:true, validations:{}},
    {id:'3',type:'email',  label:'Email Address',      key:'email',       required:true, validations:{}},
    {id:'4',type:'radio',  label:'Preferred Domain',   key:'design_domain',required:true,options:['UI/UX','Architecture','Product Design','Graphic Design'],validations:{}},
    {id:'5',type:'checkbox',label:'Software Skills',   key:'software_skills',required:true,options:['Figma','AutoCAD','Photoshop','Illustrator','Blender'],validations:{}},
    {id:'6',type:'textarea',label:'Design Statement',  key:'design_statement',required:true,validations:{minLength:200}},
    {id:'7',type:'file',   label:'Portfolio Upload',   key:'portfolio',   required:true, validations:{accept:'.pdf,.zip',maxSizeMB:50}},
  ],
}

const DEPT_NAMES: Record<string,string> = {
  cs:'Computer Science', business:'Business Administration',
  mechanical:'Mechanical Engineering', psychology:'Psychology', design:'Design & Creative Arts',
}

let counter = 100
function uid() { return String(++counter) }

export default function FormsPage() {
  const [dept, setDept]           = useState('cs')
  const [fields, setFields]       = useState<Field[]>(() => DEPT_PRESETS.cs.map(f=>({...f,id:uid()})))
  const [selected, setSelected]   = useState<string|null>(null)
  const [formName, setFormName]   = useState('MS Computer Science — Fall 2025')
  const [dragSrc, setDragSrc]     = useState<string|null>(null)
  const [saved, setSaved]         = useState(false)

  const { data } = useForms()
  const forms = data?.data ?? []
  const { mutate: createForm, isPending: creating } = useCreateForm()
  const { mutate: publishForm } = usePublishForm()

  const selectedField = fields.find(f => f.id === selected)

  function switchDept(d: string) {
    setDept(d)
    setFields((DEPT_PRESETS[d]??[]).map(f=>({...f,id:uid()})))
    setFormName(getDeptFormName(d))
    setSelected(null)
  }

  function getDeptFormName(d: string) {
    const map: Record<string,string> = {
      cs:'MS Computer Science — Fall 2025', business:'MBA Full-time — Fall 2025',
      mechanical:'MS Mechanical Engineering — Fall 2025', psychology:'MS Psychology — Fall 2025',
      design:'MFA Design — Fall 2025',
    }
    return map[d] ?? d
  }

  function addFieldType(type: string) {
    const id = uid()
    const defaults: Record<string,Partial<Field>> = {
      text:{label:'Text field',key:'text_'+id,placeholder:'Enter text…'},
      textarea:{label:'Long text',key:'text_'+id,placeholder:'Write here…'},
      email:{label:'Email',key:'email',placeholder:'you@email.com'},
      tel:{label:'Phone',key:'phone',placeholder:'+1 (555) 000-0000'},
      number:{label:'Number',key:'number_'+id,validations:{min:0}},
      date:{label:'Date',key:'date_'+id},
      select:{label:'Dropdown',key:'select_'+id,options:['Option 1','Option 2','Option 3']},
      radio:{label:'Radio group',key:'radio_'+id,options:['Option A','Option B']},
      checkbox:{label:'Multi-select',key:'multi_'+id,options:['Option A','Option B']},
      file:{label:'File upload',key:'file_'+id,validations:{accept:'.pdf,.doc,.docx',maxSizeMB:10}},
      url:{label:'URL',key:'url_'+id,placeholder:'https://'},
      heading:{label:'Section Heading',key:'heading_'+id},
    }
    const f: Field = { id, type, required:false, validations:{}, options:[], ...defaults[type] } as Field
    setFields(prev => [...prev, f])
    setSelected(id)
    triggerSave()
  }

  function updateField(id: string, key: string, val: unknown) {
    setFields(prev => prev.map(f => f.id===id ? {...f,[key]:val} : f))
    triggerSave()
  }

  function updateValidation(id: string, key: string, val: unknown) {
    setFields(prev => prev.map(f => f.id===id ? {...f,validations:{...f.validations,[key]:val===''?undefined:val}} : f))
    triggerSave()
  }

  function updateOption(id: string, idx: number, val: string) {
    setFields(prev => prev.map(f => {
      if (f.id!==id) return f
      const opts = [...(f.options??[])]
      opts[idx] = val
      return {...f, options:opts}
    }))
  }

  function addOption(id: string) {
    setFields(prev => prev.map(f => f.id===id ? {...f, options:[...(f.options??[]),'New option']} : f))
  }

  function removeOption(id: string, idx: number) {
    setFields(prev => prev.map(f => f.id===id ? {...f, options:(f.options??[]).filter((_,i)=>i!==idx)} : f))
  }

  function deleteField(id: string) {
    setFields(prev => prev.filter(f => f.id!==id))
    if (selected===id) setSelected(null)
    triggerSave()
  }

  function duplicateField(id: string) {
    const f = fields.find(x=>x.id===id)
    if (!f) return
    const copy = {...JSON.parse(JSON.stringify(f)), id:uid(), label:f.label+' (copy)', key:f.key+'_copy'}
    const idx = fields.findIndex(x=>x.id===id)
    setFields(prev => { const n=[...prev]; n.splice(idx+1,0,copy); return n })
    triggerSave()
  }

  // Drag-and-drop reorder
  function onDragStart(e: React.DragEvent, id: string) { setDragSrc(id); e.dataTransfer.effectAllowed='move' }
  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (!dragSrc || dragSrc===id) return
    const from = fields.findIndex(f=>f.id===dragSrc)
    const to   = fields.findIndex(f=>f.id===id)
    if (from===-1||to===-1) return
    setFields(prev => { const n=[...prev]; const [m]=n.splice(from,1); n.splice(to,0,m); return n })
    setDragSrc(id)
  }
  function onDragEnd() { setDragSrc(null); triggerSave() }

  function triggerSave() {
    setSaved(false)
    setTimeout(() => setSaved(true), 800)
  }

  function handlePublish() {
    const schema = { fields: fields.map(({id:_,...f})=>f) }
    createForm({ name:formName, departmentId:dept+'-dept-id', schemaJson:schema }, {
      onSuccess: (res: any) => { publishForm(res.data.id) }
    })
  }

  const vTags = (f: Field) => {
    const v = f.validations??{}
    const tags: string[] = []
    if ((v as any).minLength) tags.push(`min ${(v as any).minLength} chars`)
    if ((v as any).maxLength) tags.push(`max ${(v as any).maxLength} chars`)
    if ((v as any).min!==undefined) tags.push(`≥${(v as any).min}`)
    if ((v as any).max!==undefined) tags.push(`≤${(v as any).max}`)
    if ((v as any).accept) tags.push((v as any).accept)
    if ((v as any).maxSizeMB) tags.push(`≤${(v as any).maxSizeMB}MB`)
    return tags
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Topbar */}
      <div className="h-13 bg-white border-b border-gray-200 flex items-center px-5 gap-3 shrink-0">
        <div className="w-7 h-7 bg-gray-900 rounded flex items-center justify-center text-white text-xs font-bold">D</div>
        <span className="font-semibold text-sm">Form Builder</span>
        <div className="w-px h-4 bg-gray-200"/>
        <select className="border border-gray-200 rounded px-2 py-1.5 text-xs outline-none bg-gray-50" value={dept} onChange={e=>switchDept(e.target.value)}>
          {Object.entries(DEPT_NAMES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <div className="w-px h-4 bg-gray-200"/>
        <input value={formName} onChange={e=>{setFormName(e.target.value);triggerSave()}}
          className="border border-transparent hover:border-gray-200 focus:border-gray-400 rounded px-2 py-1 text-sm outline-none min-w-64 focus:bg-white"/>
        <div className="w-px h-4 bg-gray-200"/>
        <div className={`w-2 h-2 rounded-full ${saved?'bg-green-500':'bg-amber-400'}`}/>
        <span className="text-xs text-gray-400">{saved?'Saved':'Saving…'}</span>
        <div className="ml-auto flex gap-2">
          <a href="/admin/dashboard" className="btn btn-outline btn-sm">← Dashboard</a>
          <button className="btn btn-dark btn-sm" disabled={creating} onClick={handlePublish}>
            {creating?'Publishing…':'Publish form'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Palette */}
        <aside className="w-56 bg-white border-r border-gray-200 overflow-y-auto shrink-0">
          <div className="p-3">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Basic fields</div>
            {FIELD_TYPES.slice(0,6).map(ft=>(
              <div key={ft.type} onClick={()=>addFieldType(ft.type)}
                className="flex items-center gap-2.5 p-2.5 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50 cursor-pointer mb-1 transition">
                <span className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-semibold shrink-0">{ft.icon}</span>
                <div><div className="text-xs font-medium">{ft.label}</div><div className="text-xs text-gray-400">{ft.hint}</div></div>
              </div>
            ))}
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 mt-3">Choice fields</div>
            {FIELD_TYPES.slice(6,9).map(ft=>(
              <div key={ft.type} onClick={()=>addFieldType(ft.type)}
                className="flex items-center gap-2.5 p-2.5 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50 cursor-pointer mb-1 transition">
                <span className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-semibold shrink-0">{ft.icon}</span>
                <div><div className="text-xs font-medium">{ft.label}</div><div className="text-xs text-gray-400">{ft.hint}</div></div>
              </div>
            ))}
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 mt-3">Special</div>
            {FIELD_TYPES.slice(9).map(ft=>(
              <div key={ft.type} onClick={()=>addFieldType(ft.type)}
                className="flex items-center gap-2.5 p-2.5 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50 cursor-pointer mb-1 transition">
                <span className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-semibold shrink-0">{ft.icon}</span>
                <div><div className="text-xs font-medium">{ft.label}</div><div className="text-xs text-gray-400">{ft.hint}</div></div>
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <div className="card mb-4">
              <div className="text-lg font-semibold">{formName}</div>
              <div className="text-xs text-gray-400 mt-0.5">Department: {DEPT_NAMES[dept]} · {fields.length} fields</div>
            </div>
            {fields.length===0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-16 text-center text-gray-400">
                <div className="text-3xl mb-2">⊕</div>
                <div className="text-sm">Click any field type on the left to add it</div>
              </div>
            ) : fields.map(f=>(
              <div key={f.id}
                draggable onDragStart={e=>onDragStart(e,f.id)} onDragOver={e=>onDragOver(e,f.id)} onDragEnd={onDragEnd}
                onClick={()=>setSelected(f.id===selected?null:f.id)}
                className={`bg-white border rounded-lg p-3.5 mb-2 cursor-pointer transition
                  ${selected===f.id?'border-blue-400 ring-2 ring-blue-100':'border-gray-200 hover:border-gray-300'}
                  ${dragSrc===f.id?'opacity-40':''}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-300 cursor-grab text-base">⠿</span>
                  <span className="text-xs font-mono bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-gray-500">{f.type}</span>
                  <span className="text-sm font-medium flex-1">{f.label||'Untitled'}</span>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${f.required?'bg-red-50 text-red-500':'bg-gray-100 text-gray-400'}`}>
                    {f.required?'required':'optional'}
                  </span>
                  <button onClick={e=>{e.stopPropagation();duplicateField(f.id)}} className="w-6 h-6 rounded hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xs">⧉</button>
                  <button onClick={e=>{e.stopPropagation();deleteField(f.id)}} className="w-6 h-6 rounded hover:bg-red-50 flex items-center justify-center text-red-400 text-xs">✕</button>
                </div>
                {/* Field preview */}
                {f.type==='heading' ? (
                  <div className="text-sm font-semibold border-b-2 border-gray-200 pb-1">{f.label}</div>
                ) : ['radio','checkbox'].includes(f.type) ? (
                  <div className="flex flex-wrap gap-1.5 pointer-events-none">
                    {(f.options??[]).slice(0,4).map(o=><span key={o} className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-400">{o}</span>)}
                  </div>
                ) : f.type==='file' ? (
                  <div className="border-2 border-dashed border-gray-200 rounded p-3 text-xs text-gray-400 text-center pointer-events-none">
                    📎 Upload {(f.validations as any)?.accept||''} · max {(f.validations as any)?.maxSizeMB||10}MB
                  </div>
                ) : (
                  <div className="h-8 border border-gray-200 rounded bg-gray-50 flex items-center px-2 text-xs text-gray-300 pointer-events-none">
                    {f.placeholder||f.label}
                  </div>
                )}
                {/* Validation tags */}
                {vTags(f).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {vTags(f).map(t=><span key={t} className="text-xs bg-amber-50 text-amber-600 border border-amber-100 rounded px-1.5 py-0.5 font-mono">{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Inspector */}
        <aside className="w-72 bg-white border-l border-gray-200 overflow-y-auto shrink-0">
          {!selectedField ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
              <div className="text-3xl mb-3 opacity-30">◎</div>
              <div className="text-sm">Click a field to edit its properties</div>
            </div>
          ) : (
            <div className="p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                Field properties
                <span className="font-mono bg-gray-100 border rounded px-1.5 py-0.5 normal-case">{selectedField.type}</span>
              </div>

              {/* Basic */}
              <div className="space-y-3 mb-5">
                <div><label className="label">Label</label>
                  <input className="input text-xs" value={selectedField.label} onChange={e=>updateField(selectedField.id,'label',e.target.value)}/></div>
                <div><label className="label">Field key <span className="text-gray-400 font-normal">(API key)</span></label>
                  <input className="input text-xs font-mono" value={selectedField.key} onChange={e=>updateField(selectedField.id,'key',e.target.value)}/></div>
                {!['heading','file','radio','checkbox'].includes(selectedField.type) && (
                  <div><label className="label">Placeholder</label>
                    <input className="input text-xs" value={selectedField.placeholder??''} onChange={e=>updateField(selectedField.id,'placeholder',e.target.value)}/></div>
                )}
                <div><label className="label">Helper text</label>
                  <input className="input text-xs" value={selectedField.hint??''} onChange={e=>updateField(selectedField.id,'hint',e.target.value)} placeholder="Shown below the field"/></div>
                <div className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer" onClick={()=>updateField(selectedField.id,'required',!selectedField.required)}>
                  <div><div className="text-xs font-medium">Required field</div><div className="text-xs text-gray-400">Must be filled to submit</div></div>
                  <div className={`w-9 h-5 rounded-full relative transition-colors ${selectedField.required?'bg-gray-900':'bg-gray-200'}`}>
                    <div className={`absolute w-3.5 h-3.5 bg-white rounded-full top-0.5 transition-all shadow ${selectedField.required?'left-4.5':'left-0.5'}`} style={{left:selectedField.required?'18px':'2px'}}/>
                  </div>
                </div>
              </div>

              {/* Options */}
              {['select','radio','checkbox'].includes(selectedField.type) && (
                <div className="mb-5">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 border-t border-gray-100 pt-4">Options</div>
                  {(selectedField.options??[]).map((opt,i)=>(
                    <div key={i} className="flex gap-1.5 mb-1.5">
                      <input className="input text-xs flex-1" value={opt} onChange={e=>updateOption(selectedField.id,i,e.target.value)}/>
                      <button onClick={()=>removeOption(selectedField.id,i)} className="w-7 h-7 rounded hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  ))}
                  <button onClick={()=>addOption(selectedField.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1">+ Add option</button>
                </div>
              )}

              {/* Validations */}
              {!['heading'].includes(selectedField.type) && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 border-t border-gray-100 pt-4">Validation rules</div>
                  {['text','textarea','email','url'].includes(selectedField.type) && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div><label className="label">Min length</label>
                        <input type="number" className="input text-xs" value={(selectedField.validations as any)?.minLength??''} onChange={e=>updateValidation(selectedField.id,'minLength',e.target.value?parseInt(e.target.value):'')} placeholder="e.g. 10"/></div>
                      <div><label className="label">Max length</label>
                        <input type="number" className="input text-xs" value={(selectedField.validations as any)?.maxLength??''} onChange={e=>updateValidation(selectedField.id,'maxLength',e.target.value?parseInt(e.target.value):'')} placeholder="e.g. 500"/></div>
                    </div>
                  )}
                  {selectedField.type==='number' && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div><label className="label">Min value</label>
                        <input type="number" className="input text-xs" value={(selectedField.validations as any)?.min??''} onChange={e=>updateValidation(selectedField.id,'min',e.target.value!==''?parseFloat(e.target.value):'')} placeholder="0"/></div>
                      <div><label className="label">Max value</label>
                        <input type="number" className="input text-xs" value={(selectedField.validations as any)?.max??''} onChange={e=>updateValidation(selectedField.id,'max',e.target.value!==''?parseFloat(e.target.value):'')} placeholder="100"/></div>
                      <div className="col-span-2"><label className="label">Step</label>
                        <input type="number" className="input text-xs" value={(selectedField.validations as any)?.step??''} onChange={e=>updateValidation(selectedField.id,'step',e.target.value?parseFloat(e.target.value):'')} placeholder="e.g. 0.01"/></div>
                    </div>
                  )}
                  {selectedField.type==='file' && (
                    <div className="space-y-2">
                      <div><label className="label">Accepted types</label>
                        <input className="input text-xs font-mono" value={(selectedField.validations as any)?.accept??''} onChange={e=>updateValidation(selectedField.id,'accept',e.target.value)} placeholder=".pdf,.doc,.docx"/></div>
                      <div><label className="label">Max size (MB)</label>
                        <input type="number" className="input text-xs" value={(selectedField.validations as any)?.maxSizeMB??''} onChange={e=>updateValidation(selectedField.id,'maxSizeMB',e.target.value?parseInt(e.target.value):'')} placeholder="10"/></div>
                    </div>
                  )}
                  {['text','email'].includes(selectedField.type) && (
                    <div className="mt-2"><label className="label">Regex pattern <span className="text-gray-400">(optional)</span></label>
                      <input className="input text-xs font-mono" value={(selectedField.validations as any)?.pattern??''} onChange={e=>updateValidation(selectedField.id,'pattern',e.target.value||undefined)} placeholder="e.g. ^[A-Z].*"/></div>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-6 border-t border-gray-100 pt-4">
                <button className="btn btn-outline btn-sm flex-1 text-xs" onClick={()=>duplicateField(selectedField.id)}>Duplicate</button>
                <button className="btn-danger flex-1 text-xs" onClick={()=>deleteField(selectedField.id)}>Delete</button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
