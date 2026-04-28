import type { FastifyInstance } from 'fastify'
import { SalesforceLeadSchema } from '@dams/validators'
import { requirePermission } from '../middleware/auth.js'
import { salesforceService } from '../services/salesforce.js'

export async function salesforceRoutes(fastify: FastifyInstance) {
  fastify.post('/leads', { preHandler:[requirePermission('canSendOutreach')] }, async (req, reply) => {
    const b = SalesforceLeadSchema.safeParse(req.body)
    if (!b.success) {
      return reply.status(400).send({ success:false, error:b.error.flatten(), code:'VALIDATION_ERROR' })
    }

    const sfLeadId = await salesforceService.createLead(b.data)
    if (!sfLeadId) {
      return reply.status(502).send({ success:false, error:'Salesforce lead creation failed', code:'SALESFORCE_ERROR' })
    }

    return reply.status(201).send({
      success:true,
      data:{
        sfLeadId,
        mandatoryFields:b.data.mandatoryFields,
        dynamicFields:b.data.dynamicFields,
      },
    })
  })

  fastify.post('/leads/preview', { preHandler:[requirePermission('canSendOutreach')] }, async (req, reply) => {
    const b = SalesforceLeadSchema.safeParse(req.body)
    if (!b.success) {
      return reply.status(400).send({ success:false, error:b.error.flatten(), code:'VALIDATION_ERROR' })
    }

    return reply.send({
      success:true,
      data:{
        object:'Lead',
        record:salesforceService.buildLeadRecord(b.data),
      },
    })
  })
}
