import { PrismaClient, LeadStatus, LeadSource, FormStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

async function main() {
  console.log('🌱 Seeding...')

  // ── Departments ────────────────────────────────────────────────────────────
  const depts = await Promise.all([
    prisma.department.upsert({ where:{slug:'computer-science'},   update:{}, create:{name:'Computer Science',         slug:'computer-science',   description:'MS/PhD CS programs'} }),
    prisma.department.upsert({ where:{slug:'business'},           update:{}, create:{name:'Business Administration',  slug:'business',           description:'MBA and MS business programs'} }),
    prisma.department.upsert({ where:{slug:'mechanical'},         update:{}, create:{name:'Mechanical Engineering',   slug:'mechanical',         description:'MS/PhD mechanical programs'} }),
    prisma.department.upsert({ where:{slug:'psychology'},         update:{}, create:{name:'Psychology',               slug:'psychology',         description:'MS/PhD psychology programs'} }),
    prisma.department.upsert({ where:{slug:'design'},             update:{}, create:{name:'Design & Creative Arts',   slug:'design',             description:'MFA/MS design programs'} }),
  ])
  const [cs, biz, mech, psych, design] = depts
  console.log(`✅ ${depts.length} departments`)

  // ── Admin credentials ──────────────────────────────────────────────────────
  // 1 super admin + 3 department-specific admins
  const adminCredentials = [
    { name:'Super Admin',             email:'admin@dams.edu',    password:'Admin@2026',  role:'admin',      departmentId: null      },
    { name:'CS Department Admin',     email:'cs@dams.edu',       password:'CS@2026',     role:'department', departmentId: cs.id     },
    { name:'Business Department Admin',email:'business@dams.edu',password:'Biz@2026',   role:'department', departmentId: biz.id    },
    { name:'Mech Department Admin',   email:'mech@dams.edu',     password:'Mech@2026',   role:'department', departmentId: mech.id   },
  ]

  for (const cred of adminCredentials) {
    const passwordHash = await hashPassword(cred.password)
    await prisma.admin.upsert({
      where:  { email: cred.email },
      update: { passwordHash, name: cred.name },
      create: {
        name:         cred.name,
        email:        cred.email,
        passwordHash,
        role:         cred.role,
        departmentId: cred.departmentId,
      },
    })
    console.log(`  👤 ${cred.email} (${cred.role}) — password: ${cred.password}`)
  }
  console.log(`✅ 4 admin accounts`)

  // ── Forms ──────────────────────────────────────────────────────────────────
  const csForm = await prisma.form.upsert({
    where: { slug:'ms-computer-science-fall-2025' }, update:{},
    create: {
      name:'MS Computer Science — Fall 2025', slug:'ms-computer-science-fall-2025',
      departmentId: cs.id, status: FormStatus.active, publishedAt: new Date(),
      schemaJson: { fields:[
        {id:'f1',type:'text',   label:'First Name',       key:'first_name',   required:true,  validations:{minLength:2}},
        {id:'f2',type:'text',   label:'Last Name',        key:'last_name',    required:true,  validations:{minLength:2}},
        {id:'f3',type:'email',  label:'Email Address',    key:'email',        required:true,  validations:{}},
        {id:'f4',type:'tel',    label:'Phone Number',     key:'phone',        required:true,  validations:{}},
        {id:'f5',type:'number', label:'GPA (4.0 scale)',  key:'gpa',          required:true,  validations:{min:0,max:4}},
        {id:'f6',type:'select', label:'Degree Earned',    key:'degree',       required:true,  options:['BS','BA','BEng','Currently Enrolled'],validations:{}},
        {id:'f7',type:'number', label:'GRE Score',        key:'gre_score',    required:false, validations:{min:260,max:340}},
        {id:'f8',type:'checkbox',label:'Specialization',  key:'specialization',required:true, options:['AI','Data Science','Systems','Cybersecurity','HCI'],validations:{}},
        {id:'f9',type:'textarea',label:'Statement of Purpose',key:'sop',      required:true,  validations:{minLength:200,maxLength:2000}},
        {id:'f10',type:'file',  label:'Resume / CV',      key:'resume',       required:true,  validations:{accept:'.pdf,.doc,.docx',maxSizeMB:10}},
        {id:'f11',type:'file',  label:'Transcript',       key:'transcript',   required:true,  validations:{accept:'.pdf',maxSizeMB:10}},
      ]},
    },
  })

  const bizForm = await prisma.form.upsert({
    where: { slug:'mba-fulltime-fall-2025' }, update:{},
    create: {
      name:'MBA Full-time — Fall 2025', slug:'mba-fulltime-fall-2025',
      departmentId: biz.id, status: FormStatus.active, publishedAt: new Date(),
      schemaJson: { fields:[
        {id:'f1',type:'text',   label:'First Name',       key:'first_name',   required:true,  validations:{minLength:2}},
        {id:'f2',type:'text',   label:'Last Name',        key:'last_name',    required:true,  validations:{minLength:2}},
        {id:'f3',type:'email',  label:'Email Address',    key:'email',        required:true,  validations:{}},
        {id:'f4',type:'number', label:'Work Experience (years)',key:'work_exp',required:true, validations:{min:0,max:50}},
        {id:'f5',type:'text',   label:'Current Employer', key:'employer',     required:true,  validations:{}},
        {id:'f6',type:'text',   label:'Job Title',        key:'job_title',    required:true,  validations:{}},
        {id:'f7',type:'number', label:'GMAT Score',       key:'gmat',         required:false, validations:{min:200,max:800}},
        {id:'f8',type:'textarea',label:'Leadership Essay',key:'leadership',   required:true,  validations:{minLength:300}},
        {id:'f9',type:'file',   label:'Resume / CV',      key:'resume',       required:true,  validations:{accept:'.pdf,.doc,.docx',maxSizeMB:10}},
      ]},
    },
  })
  console.log('✅ 2 forms')

  // ── Demo leads ─────────────────────────────────────────────────────────────
  const demos = [
    {fn:'Priya',  ln:'Sharma',  email:'priya.sharma@email.com',  dept:cs.id,    form:csForm.id,  status:LeadStatus.new,         src:LeadSource.ga_poll,      pct:25,  camp:'grad_admissions_2025'},
    {fn:'Marcus', ln:'Webb',    email:'marcus.webb@email.com',   dept:biz.id,   form:bizForm.id, status:LeadStatus.contacted,   src:LeadSource.partial_save, pct:58,  camp:'mba_fall_2025'},
    {fn:'Sofia',  ln:'Reyes',   email:'sofia.reyes@email.com',   dept:cs.id,    form:csForm.id,  status:LeadStatus.in_progress, src:LeadSource.partial_save, pct:82,  camp:'grad_admissions_2025'},
    {fn:'Aiden',  ln:'Park',    email:'aiden.park@email.com',    dept:biz.id,   form:bizForm.id, status:LeadStatus.submitted,   src:LeadSource.direct,       pct:100, camp:null},
    {fn:'Zara',   ln:'Hassan',  email:'zara.hassan@email.com',   dept:cs.id,    form:csForm.id,  status:LeadStatus.new,         src:LeadSource.ga_poll,      pct:15,  camp:'grad_admissions_2025'},
    {fn:'Ethan',  ln:'Nguyen',  email:'ethan.nguyen@email.com',  dept:mech.id,  form:csForm.id,  status:LeadStatus.contacted,   src:LeadSource.partial_save, pct:60,  camp:'engineering_2025'},
    {fn:'Chloe',  ln:'Osei',    email:'chloe.osei@email.com',    dept:design.id,form:csForm.id,  status:LeadStatus.dropped,     src:LeadSource.ga_poll,      pct:30,  camp:'arts_fall_2025'},
    {fn:'Liam',   ln:'Torres',  email:'liam.torres@email.com',   dept:cs.id,    form:csForm.id,  status:LeadStatus.in_progress, src:LeadSource.partial_save, pct:88,  camp:'phd_program_2025'},
    {fn:'Maya',   ln:'Patel',   email:'maya.patel@email.com',    dept:biz.id,   form:bizForm.id, status:LeadStatus.new,         src:LeadSource.ga_poll,      pct:8,   camp:'mba_fall_2025'},
    {fn:'Noah',   ln:'Kim',     email:'noah.kim@email.com',      dept:psych.id, form:csForm.id,  status:LeadStatus.submitted,   src:LeadSource.direct,       pct:100, camp:null},
  ]

  for (const [i, d] of demos.entries()) {
    await prisma.lead.upsert({
      where: { sessionId:`seed_${i}` }, update:{},
      create: {
        sessionId:`seed_${i}`, formId:d.form, departmentId:d.dept,
        status:d.status, source:d.src,
        firstName:d.fn, lastName:d.ln, email:d.email,
        dataJson:{first_name:d.fn,last_name:d.ln,email:d.email},
        gaClientId:`${Math.floor(Math.random()*9e8+1e8)}.${Math.floor(Date.now()/1000)-i*3600}`,
        utmSource: d.src===LeadSource.ga_poll?'google':d.src===LeadSource.partial_save?'meta':'direct',
        utmMedium: d.src!==LeadSource.direct?'cpc':null,
        utmCampaign: d.camp,
        fieldsFilled: Math.round(d.pct/100*11),
        completionPct: d.pct,
        sfLeadId: d.status===LeadStatus.submitted?'00Q'+Math.random().toString(36).slice(2,12).toUpperCase():null,
        submittedAt: d.status===LeadStatus.submitted?new Date():null,
        droppedAt:   d.status===LeadStatus.dropped?new Date():null,
        createdAt: new Date(Date.now()-(10-i)*3600000),
      },
    })
  }
  console.log(`✅ ${demos.length} demo leads`)
  console.log('🎉 Seed complete')
  console.log('\n📋 Admin credentials:')
  console.log('  admin@dams.edu     / Admin@2026  (admin — sees all)')
  console.log('  cs@dams.edu        / CS@2026     (Computer Science)')
  console.log('  business@dams.edu  / Biz@2026    (Business Administration)')
  console.log('  mech@dams.edu      / Mech@2026   (Mechanical Engineering)')
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect())
