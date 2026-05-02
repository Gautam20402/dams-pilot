// ── forms.ts ──────────────────────────────────────────────────────────────────
import type { FastifyInstance } from 'fastify'
import { prisma, Prisma } from '@dams/db'
import { CreateFormSchema, UpdateFormSchema } from '@dams/validators'
import { requirePermission, scopeToDepartment } from '../middleware/auth.js'

export async function formsRoutes(fastify: FastifyInstance) {
  // PUBLIC
  fastify.get('/public/:slug', async (req, reply) => {
    const { slug } = req.params as { slug:string }
    const form = await prisma.form.findUnique({ where:{ slug },
      select:{
        id:true,
        name:true,
        slug:true,
        schemaJson:true,
        departmentId:true,
        status:true,
        department: { select: { id:true, name:true, slug:true } },
      } })
    if (!form || form.status!=='active')
      return reply.status(404).send({ success:false, error:'Form not found or inactive', code:'NOT_FOUND' })
    return reply.send({ success:true, data:form })
  })

  fastify.get('/', { preHandler:[scopeToDepartment] }, async (req, reply) => {
    const deptId = req.userRole==='SUPER_ADMIN' ? (req.query as any).departmentId : req.departmentId
    const forms = await prisma.form.findMany({ where: deptId?{ departmentId:deptId }:{},
      orderBy:{ createdAt:'desc' }, include:{ _count:{ select:{ leads:true } } } })
    return reply.send({ success:true, data:forms })
  })

  fastify.get('/:id', { preHandler:[scopeToDepartment] }, async (req, reply) => {
    const { id } = req.params as { id:string }
    const form = await prisma.form.findUnique({ where:{ id },
      include:{ department:true, _count:{ select:{ leads:true } } } })
    if (!form) return reply.status(404).send({ success:false, error:'Form not found', code:'NOT_FOUND' })
    if (req.userRole!=='SUPER_ADMIN' && form.departmentId!==req.departmentId)
      return reply.status(403).send({ success:false, error:'Forbidden', code:'DEPT_MISMATCH' })
    return reply.send({ success:true, data:form })
  })

  fastify.post('/', { preHandler:[requirePermission('canEditForms')] }, async (req, reply) => {
    const b = CreateFormSchema.safeParse(req.body)
    if (!b.success) return reply.status(400).send({ success:false, error:b.error.flatten(), code:'VALIDATION_ERROR' })
    const departmentId = req.userRole==='SUPER_ADMIN' ? b.data.departmentId : req.departmentId!
    const slug = b.data.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').slice(0,60)+'-'+Date.now().toString(36)
    const form = await prisma.form.create({
      data:{ ...b.data, departmentId, slug, schemaJson:b.data.schemaJson as any },
    })
    return reply.status(201).send({ success:true, data:form })
  })

  fastify.patch('/:id', { preHandler:[requirePermission('canEditForms')] }, async (req, reply) => {
    const { id } = req.params as { id:string }
    const b = UpdateFormSchema.safeParse(req.body)
    if (!b.success) return reply.status(400).send({ success:false, error:b.error.flatten(), code:'VALIDATION_ERROR' })
    const existing = await prisma.form.findUnique({ where:{ id } })
    if (!existing) return reply.status(404).send({ success:false, error:'Not found', code:'NOT_FOUND' })
    const form = await prisma.form.update({ where:{ id }, data:b.data as any })
    return reply.send({ success:true, data:form })
  })

  fastify.post('/:id/publish', { preHandler:[requirePermission('canEditForms')] }, async (req, reply) => {
    const { id } = req.params as { id:string }
    const form = await prisma.form.update({ where:{ id },
      data:{ status:'active', publishedAt:new Date(), version:{ increment:1 } } })
    return reply.send({ success:true, data:form })
  })

  fastify.post('/:id/archive', { preHandler:[requirePermission('canEditForms')] }, async (req, reply) => {
    const { id } = req.params as { id:string }
    const form = await prisma.form.update({ where:{ id }, data:{ status:'archived' } })
    return reply.send({ success:true, data:form })
  })

  fastify.delete('/:id', { preHandler:[requirePermission('canEditForms')] }, async (req, reply) => {
    const { id } = req.params as { id:string }
    const existing = await prisma.form.findUnique({ where:{ id } })
    if (!existing) return reply.status(404).send({ success:false, error:'Form not found', code:'NOT_FOUND' })
    if (req.userRole!=='SUPER_ADMIN' && existing.departmentId!==req.departmentId)
      return reply.status(403).send({ success:false, error:'Forbidden', code:'DEPT_MISMATCH' })
    // Nullify form reference on leads before deleting to avoid FK violation
    await prisma.lead.updateMany({ where:{ formId:id }, data:{ formId:null } })
    await prisma.form.delete({ where:{ id } })
    return reply.send({ success:true })
  })
}
