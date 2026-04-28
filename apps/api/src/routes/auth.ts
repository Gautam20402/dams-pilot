import type { FastifyInstance } from 'fastify'
import { prisma } from '@dams/db'
import { SyncUserSchema } from '@dams/validators'

async function getDefaultDept(): Promise<string> {
  const d = await prisma.department.findFirst({ orderBy:{ createdAt:'asc' } })
  if (!d) throw new Error('No departments found — run: pnpm db:seed')
  return d.id
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/sync', async (req, reply) => {
    const b = SyncUserSchema.safeParse(req.body)
    if (!b.success) return reply.status(400).send({ success:false, error:b.error.flatten(), code:'VALIDATION_ERROR' })
    const { clerkId, email, firstName, lastName, departmentId, role } = b.data
    const user = await prisma.user.upsert({
      where:  { clerkId },
      create: { clerkId, email, firstName, lastName, role:(role as any)??'CALLER',
                departmentId: departmentId ?? await getDefaultDept() },
      update: { email, firstName, lastName },
    })
    return reply.send({ success:true, data:user })
  })

  fastify.get('/me', async (req, reply) => {
    if (!req.userId) return reply.status(401).send({ success:false, error:'Not authenticated', code:'UNAUTHENTICATED' })
    const user = await prisma.user.findUnique({ where:{ id:req.userId }, include:{ department:true } })
    return reply.send({ success:true, data:user })
  })
}

export async function webhooksRoutes(fastify: FastifyInstance) {
  fastify.post('/clerk', async (req, reply) => {
    const event = req.body as any
    fastify.log.info({ type:event.type }, 'Clerk webhook')
    if (event.type==='user.created' || event.type==='user.updated') {
      const u = event.data
      const meta = u.public_metadata ?? {}
      await prisma.user.upsert({
        where:  { clerkId:u.id },
        create: { clerkId:u.id, email:u.email_addresses?.[0]?.email_address??'',
                  firstName:u.first_name??'', lastName:u.last_name??'',
                  role:(meta.role as any)?? 'CALLER',
                  departmentId: meta.departmentId ?? await getDefaultDept() },
        update: { email:u.email_addresses?.[0]?.email_address??undefined,
                  firstName:u.first_name??undefined, lastName:u.last_name??undefined },
      })
    }
    return reply.send({ received:true })
  })
}
