import type { FastifyInstance } from 'fastify'
import { google } from 'googleapis'
import { prisma } from '@dams/db'
import { SendEmailSchema, SendSMSSchema, LogCallSchema } from '@dams/validators'
import { requirePermission } from '../middleware/auth.js'
import { emailService } from '../services/email.js'
import { smsService }   from '../services/sms.js'

export async function outreachRoutes(fastify: FastifyInstance) {

  // ── Gmail OAuth2 diagnostic — GET /api/outreach/email-test ───────────────
  fastify.get('/email-test', async (_req, reply) => {
    const clientId     = process.env.GMAIL_CLIENT_ID     ?? ''
    const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? ''
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN ?? ''
    const user         = process.env.GMAIL_USER ?? process.env.SMTP_USER ?? ''

    const config = {
      GMAIL_USER:          user         ? `${user.slice(0,4)}****`         : '(not set)',
      GMAIL_CLIENT_ID:     clientId     ? `${clientId.slice(0,8)}****`     : '(not set)',
      GMAIL_CLIENT_SECRET: clientSecret ? '****'                           : '(not set)',
      GMAIL_REFRESH_TOKEN: refreshToken ? `${refreshToken.slice(0,6)}****` : '(not set)',
    }

    if (!clientId || !clientSecret || !refreshToken || !user) {
      return reply.status(500).send({ ok: false, config, error: 'One or more Gmail OAuth2 env vars not set' })
    }

    try {
      const oauth2 = new google.auth.OAuth2(
        clientId, clientSecret, 'https://developers.google.com/oauthplayground'
      )
      oauth2.setCredentials({ refresh_token: refreshToken })
      const { token } = await oauth2.getAccessToken()
      if (!token) throw new Error('Failed to obtain access token — check refresh token or client credentials')
      return reply.send({ ok: true, config, message: 'Gmail OAuth2 credentials verified ✓' })
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
