import type { FastifyInstance } from 'fastify'
import { prisma, Prisma } from '@dams/db'
import { PartialSaveSchema, UpdateLeadStatusSchema, LeadFiltersSchema } from '@dams/validators'
import { requirePermission, scopeToDepartment } from '../middleware/auth.js'
import { salesforceService } from '../services/salesforce.js'
import { salesforceBackendService } from '../services/salesforce-backend.js'
import { emailService } from '../services/email.js'

export async function leadsRoutes(fastify: FastifyInstance) {

  // PUBLIC — no auth
  fastify.post('/partial', async (req, reply) => {
    const b = PartialSaveSchema.safeParse(req.body)
    if (!b.success) return reply.status(400).send({ success:false, error:b.error.flatten(), code:'VALIDATION_ERROR' })
    const d = b.data
    const dj = d.dataJson as Record<string,string>

    const lead = await prisma.lead.upsert({
      where:  { sessionId: d.sessionId },
      create: {
        sessionId:d.sessionId, formId:d.formId, departmentId:d.departmentId,
        status:'partial', source:d.source as any,
        firstName:dj.first_name, lastName:dj.last_name, email:dj.email, phone:dj.phone,
        dataJson:d.dataJson as any, gaClientId:d.gaClientId,
        utmSource:d.utmSource, utmMedium:d.utmMedium, utmCampaign:d.utmCampaign,
        utmContent:d.utmContent, utmTerm:d.utmTerm,
        lastActivePage:d.lastActivePage, fieldsFilled:d.fieldsFilled, completionPct:d.completionPct,
      },
      update: {
        firstName:dj.first_name??undefined, lastName:dj.last_name??undefined,
        email:dj.email??undefined, phone:dj.phone??undefined,
        dataJson:d.dataJson as any, lastActivePage:d.lastActivePage,
        fieldsFilled:d.fieldsFilled, completionPct:d.completionPct,
      },
    })

    await prisma.leadEvent.create({
      data:{ leadId:lead.id, eventType:'partial_save', metadata:{ fieldsFilled:d.fieldsFilled, pct:d.completionPct } },
    })

    // First save → push to Salesforce async
    if (Math.abs(lead.createdAt.getTime() - lead.updatedAt.getTime()) < 1000) {
      salesforceService.pushLead(lead).catch(e => fastify.log.error(e))
    }

    return reply.status(201).send({ success:true, data:{ id:lead.id, sessionId:lead.sessionId } })
  })

  // PUBLIC — final form submission
  fastify.post('/submit', async (req, reply) => {
    const { leadId, sessionId } = req.body as { leadId: string; sessionId: string }
    if (!leadId || !sessionId) return reply.status(400).send({ success:false, error:'leadId and sessionId required', code:'VALIDATION_ERROR' })

    const lead = await prisma.lead.findUnique({ where:{ id:leadId } })
    if (!lead) return reply.status(404).send({ success:false, error:'Lead not found', code:'NOT_FOUND' })
    if (lead.sessionId !== sessionId) return reply.status(403).send({ success:false, error:'Forbidden', code:'SESSION_MISMATCH' })

    const updated = await prisma.lead.update({
      where: { id:leadId },
      data:  { status:'submitted', completionPct:100, submittedAt:new Date() },
    })
    await prisma.leadEvent.create({ data:{ leadId, eventType:'form_submitted', metadata:{ source:'public_form' } } })

    // Fire email + Salesforce in background — do not block the response
    // Use a timestamp suffix so re-submissions never collide on externalLeadId
    const externalLeadId = `web_${updated.id}_${Date.now()}`
    setImmediate(async () => {
      try {
        const form = updated.formId ? await prisma.form.findUnique({ where:{ id: updated.formId } }) : null
        await emailService.sendConfirmation(updated, form?.name)
      } catch (e) { fastify.log.error(e) }

      try {
        // Skip if already successfully pushed to Salesforce
        const current = await prisma.lead.findUnique({ where:{ id: updated.id }, select:{ sfLeadId:true } })
        if (current?.sfLeadId) {
          fastify.log.info({ leadId: updated.id, sfLeadId: current.sfLeadId }, 'Salesforce already submitted, skipping')
          return
        }

        const dept = await prisma.department.findUnique({ where:{ id: updated.departmentId } })
        const payload = salesforceBackendService.buildPayload({
          externalLeadId,
          dataJson: updated.dataJson,
          departmentName: dept?.name,
          completionPct: 100,
          utm: {
            source: updated.utmSource,
            medium: updated.utmMedium,
            campaign: updated.utmCampaign,
            content: updated.utmContent,
            term: updated.utmTerm,
          },
        })
        const body = await salesforceBackendService.submitForm(payload)
        const recordId = typeof (body as any)?.recordId === 'string' ? (body as any).recordId : undefined
        if (recordId) {
          await prisma.lead.update({ where:{ id:updated.id }, data:{ sfLeadId: recordId } })
          await prisma.leadEvent.create({ data:{ leadId:updated.id, eventType:'salesforce_backend_submitted', metadata:{ externalLeadId, recordId } } })
        } else {
          await prisma.leadEvent.create({ data:{ leadId:updated.id, eventType:'salesforce_backend_submitted', metadata:{ externalLeadId } } })
        }
      } catch (e: any) {
        fastify.log.error(e)
        await prisma.leadEvent.create({ data:{ leadId:updated.id, eventType:'salesforce_backend_failed', metadata:{ externalLeadId, error: e?.message } } }).catch(() => {})
      }
    })

    return reply.send({ success:true, data:{ id:updated.id, status:updated.status } })
  })

  // PUBLIC — drop-off beacon
  fastify.post('/drop-off', async (req, reply) => {
    const { sessionId, step, fieldsFilled } = req.body as any
    const lead = await prisma.lead.findUnique({ where:{ sessionId } })
    if (!lead) return reply.status(404).send({ success:false, error:'Lead not found', code:'NOT_FOUND' })

    await prisma.lead.update({ where:{ sessionId }, data:{ status:'dropped', droppedAt:new Date() } })
    await prisma.leadEvent.create({ data:{ leadId:lead.id, eventType:'drop_off', metadata:{ step, fieldsFilled } } })

    if (lead.email) emailService.sendDropOff(lead).catch(e => fastify.log.error(e))
    return reply.status(200).send({ success:true })
  })

  // GET /api/leads — list with filters + pagination
  fastify.get('/', { preHandler:[scopeToDepartment] }, async (req, reply) => {
    const f = LeadFiltersSchema.safeParse(req.query)
    if (!f.success) return reply.status(400).send({ success:false, error:f.error.flatten(), code:'VALIDATION_ERROR' })
    const { status, source, departmentId, search, page, limit, sortBy, sortDir } = f.data

    const scopedDept = req.userRole==='SUPER_ADMIN' ? departmentId : req.departmentId
    const where: any = {
      ...(scopedDept && { departmentId:scopedDept }),
      ...(status     && { status }),
      ...(source     && { source }),
      ...(search     && { OR:[
        { firstName:{ contains:search, mode:'insensitive' } },
        { lastName: { contains:search, mode:'insensitive' } },
        { email:    { contains:search, mode:'insensitive' } },
        { id:       { contains:search, mode:'insensitive' } },
      ]}),
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where, orderBy:{ [sortBy]:sortDir },
        skip:(page-1)*limit, take:limit,
        include:{
          outreachLogs:{ orderBy:{ sentAt:'desc' }, take:3 },
          form:{ select:{ id:true, name:true, slug:true } },
          department:{ select:{ id:true, name:true } },
        },
      }),
      prisma.lead.count({ where }),
    ])

    return reply.send({ success:true, data:leads, pagination:{ page, limit, total, pages:Math.ceil(total/limit) } })
  })

  // GET /api/leads/stats
  fastify.get('/stats/summary', { preHandler:[scopeToDepartment] }, async (req, reply) => {
    const deptId = req.userRole==='SUPER_ADMIN' ? undefined : req.departmentId
    const w = deptId ? { departmentId:deptId } : {}

    const [total, byStatus, bySource, avg] = await Promise.all([
      prisma.lead.count({ where:w }),
      prisma.lead.groupBy({ by:['status'], _count:{ status:true }, where:w }),
      prisma.lead.groupBy({ by:['source'], _count:{ source:true }, where:w }),
      prisma.lead.aggregate({ _avg:{ completionPct:true }, where:w }),
    ])
    const outreach = await prisma.outreachLog.count({ where: deptId ? { lead:{ departmentId:deptId } } : {} })
    const captured = bySource.filter((s: { source: string; _count: { source: number } })=>['ga_poll','partial_save'].includes(s.source)).reduce((n: number, s: { _count: { source: number } })=>n+s._count.source,0)

    return reply.send({ success:true, data:{
      total,
      byStatus: Object.fromEntries(byStatus.map(s=>[s.status,s._count.status])),
      bySource: Object.fromEntries(bySource.map(s=>[s.source,s._count.source])),
      avgCompletion: Math.round(avg._avg.completionPct ?? 0),
      outreachSent:  outreach,
      captureRate:   total>0 ? Math.round(captured/total*100) : 0,
    }})
  })

  // GET /api/leads/:id
  fastify.get('/:id', { preHandler:[scopeToDepartment] }, async (req, reply) => {
    const { id } = req.params as { id:string }
    const lead = await prisma.lead.findUnique({ where:{ id },
      include:{ events:{ orderBy:{ createdAt:'desc' } }, outreachLogs:{ orderBy:{ sentAt:'desc' } },
        form:{ select:{ id:true,name:true,slug:true } }, department:{ select:{ id:true,name:true } } }
    })
    if (!lead) return reply.status(404).send({ success:false, error:'Lead not found', code:'NOT_FOUND' })
    if (req.userRole!=='SUPER_ADMIN' && lead.departmentId!==req.departmentId)
      return reply.status(403).send({ success:false, error:'Forbidden', code:'DEPT_MISMATCH' })
    return reply.send({ success:true, data:lead })
  })

  // PATCH /api/leads/:id/status
  fastify.patch('/:id/status', { preHandler:[requirePermission('canUpdateStatus'), scopeToDepartment] }, async (req, reply) => {
    const { id } = req.params as { id:string }
    const b = UpdateLeadStatusSchema.safeParse(req.body)
    if (!b.success) return reply.status(400).send({ success:false, error:b.error.flatten(), code:'VALIDATION_ERROR' })

    const lead = await prisma.lead.findUnique({ where:{ id } })
    if (!lead) return reply.status(404).send({ success:false, error:'Lead not found', code:'NOT_FOUND' })

    const updated = await prisma.lead.update({ where:{ id }, data:{ status:b.data.status as any } })
    await prisma.leadEvent.create({ data:{
      leadId:id, actorId:req.userId, eventType:'status_change', note:b.data.note,
      beforeState:{ status:lead.status }, afterState:{ status:b.data.status },
    }})

    // Send congratulations email when status changes to converted
    if (b.data.status === 'converted' && lead.status !== 'converted') {
      const form = updated.formId ? await prisma.form.findUnique({ where:{ id: updated.formId } }) : null
      emailService.sendConversionCongratulations(updated, form?.name).catch(e => fastify.log.error(e))
    }

    return reply.send({ success:true, data:updated })
  })
}
