import type { FastifyInstance } from 'fastify'
import { prisma } from '@dams/db'

export async function departmentsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (_req, reply) => {
    const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } })
    return reply.send({ success: true, data: departments })
  })
}
