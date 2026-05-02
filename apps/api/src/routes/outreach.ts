import type { FastifyInstance } from 'fastify'
import nodemailer from 'nodemailer'
import { prisma } from '@dams/db'
import { SendEmailSchema, SendSMSSchema, LogCallSchema } from '@dams/validators'
import { requirePermission } from '../middleware/auth.js'
import { emailService } from '../services/email.js'
import { smsService }   from '../services/sms.js'

export async function outreachRoutes(fastify: FastifyInstance) {

  // ── SMTP diagnostic — GET /api/outreach/email-test ───────────────────────
  // No auth required so you can hit it straight from curl to verify config
  fastify.get('/email-test', async (_req, reply) => {
    const user = process.env.SMTP_USER ?? ''
    const pass = process.env.SMTP_PASS ?? ''
    const host = process.env.SMTP_HOST ?? 'smtp.gmail.com'
    const port = Number(process.env.SMTP_PORT ?? 587)
    const secure = process.env.SMTP_SECURE === 'true'

    const config = {
      SMTP_HOST:   host,
      SMTP_PORT:   port,
      SMTP_SECURE: secure,
      SMTP_USER:   user ? `${user.slice(0, 4)}****` : '(not set)',
      SMTP_PASS:   pass ? `****` : '(not set)',
    }

    if (!user || !pass) {
      return reply.status(500).send({ ok: false, config, error: 'SMTP_USER or SMTP_PASS not set' })
    }

    const transporter = nodemailer.createTransport({
      host, port, secure,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout:   10_000,
    })

    try {
      await transporter.verify()
      return reply.send({ ok: true, config, message: 'SMTP connection verified ✓' })
    } catch (err: any) {
      return reply.status(500).send({ ok: false, config, error: err?.message ?? String(err) })
    }
  })

  fastify.post('/email', { preHandler:[requirePermission('canSendOutreach')] }, async (req, reply) => {
    const b = SendEmailSchema.safeParse(req.body)
    if (!b.success) return reply.status(400).send({ success:false, error:b.error.flatten(), code:'VALIDATION_ERROR' })
    const lead = await prisma.lead.findUnique({ where:{ id:b.data.leadId } })
    if (!lead) return reply.status(404).send({ success:false, error:'Lead not found', code:'NOT_FOUND' })

    let result: { id: string }
    try {
      result = await emailService.sendCustom(b.data.to, b.data.subject, b.data.body)
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      req.log.error({ err, to: b.data.to }, 'Email send failed')
      return reply.status(500).send({ success: false, error: msg, code: 'EMAIL_SEND_FAILED' })
    }

    await prisma.outreachLog.create({ data:{ leadId:b.data.leadId,
      channel:'email', subject:b.data.subject, body:b.data.body, externalId:result.id } })
    await prisma.leadEvent.create({ data:{ leadId:b.data.leadId,
      eventType:'outreach_sent', metadata:{ channel:'email', subject:b.data.subject, sentBy:req.adminEmail } } })
    if (lead.status==='new'||lead.status==='partial')
      await prisma.lead.update({ where:{ id:b.data.leadId }, data:{ status:'contacted' } })

    return reply.status(201).send({ success:true, data:{ messageId:result.id } })
  })

  fastify.post('/sms', { preHandler:[requirePermission('canSendOutreach')] }, async (req, reply) => {
    const b = SendSMSSchema.safeParse(req.body)
    if (!b.success) return reply.status(400).send({ success:false, error:b.error.flatten(), code:'VALIDATION_ERROR' })
    const lead = await prisma.lead.findUnique({ where:{ id:b.data.leadId } })
    if (!lead) return reply.status(404).send({ success:false, error:'Lead not found', code:'NOT_FOUND' })

    const result = await smsService.send(b.data.to, b.data.body)
    await prisma.outreachLog.create({ data:{ leadId:b.data.leadId,
      channel:'sms', body:b.data.body, externalId:result.sid } })
    await prisma.leadEvent.create({ data:{ leadId:b.data.leadId,
      eventType:'outreach_sent', metadata:{ channel:'sms', sentBy:req.adminEmail } } })
    if (lead.status==='new'||lead.status==='partial')
      await prisma.lead.update({ where:{ id:b.data.leadId }, data:{ status:'contacted' } })

    return reply.status(201).send({ success:true, data:{ sid:result.sid } })
  })

  fastify.post('/call', { preHandler:[requirePermission('canSendOutreach')] }, async (req, reply) => {
    const b = LogCallSchema.safeParse(req.body)
    if (!b.success) return reply.status(400).send({ success:false, error:b.error.flatten(), code:'VALIDATION_ERROR' })
    await prisma.outreachLog.create({ data:{ leadId:b.data.leadId,
      channel:'call', body:b.data.note, outcome:b.data.outcome } })
    await prisma.leadEvent.create({ data:{ leadId:b.data.leadId,
      eventType:'call_logged', metadata:{ duration:b.data.duration, outcome:b.data.outcome, loggedBy:req.adminEmail } } })
    return reply.status(201).send({ success:true })
  })

  fastify.get('/:leadId', async (req, reply) => {
    const { leadId } = req.params as { leadId:string }
    const logs = await prisma.outreachLog.findMany({ where:{ leadId }, orderBy:{ sentAt:'desc' } })
    return reply.send({ success:true, data:logs })
  })
}
