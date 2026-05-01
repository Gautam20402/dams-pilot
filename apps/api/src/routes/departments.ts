import type { FastifyInstance } from 'fastify'
import { prisma } from '@dams/db'
import bcrypt from 'bcryptjs'
import { requirePermission } from '../middleware/auth.js'

export async function departmentsRoutes(fastify: FastifyInstance) {

  // GET /api/departments — list all departments with their admins + lead count
  fastify.get('/', async (_req, reply) => {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        admins: { select: { id: true, email: true, name: true, role: true } },
        _count: { select: { leads: true } },
      },
    })
    return reply.send({ success: true, data: departments })
  })

  // POST /api/departments — create department + admin (admin only)
  fastify.post('/', { preHandler: [requirePermission('canManageDepartments')] }, async (req, reply) => {
    const { universityName, departmentName, email, password } = req.body as {
      universityName?: string
      departmentName?: string
      email?: string
      password?: string
    }

    // Validate
    if (!departmentName?.trim()) return reply.status(400).send({ success: false, error: 'departmentName is required', code: 'VALIDATION_ERROR' })
    if (!email?.trim())          return reply.status(400).send({ success: false, error: 'email is required',          code: 'VALIDATION_ERROR' })
    if (!password || password.length < 8) return reply.status(400).send({ success: false, error: 'password must be at least 8 characters', code: 'VALIDATION_ERROR' })

    // Derive slug
    const slug = departmentName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    // Check slug uniqueness
    const existing = await prisma.department.findUnique({ where: { slug } })
    if (existing) return reply.status(409).send({ success: false, error: `A department with slug "${slug}" already exists`, code: 'SLUG_CONFLICT' })

    // Check email uniqueness in admins table
    const existingAdmin = await prisma.admin.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (existingAdmin) return reply.status(409).send({ success: false, error: 'An admin with that email already exists', code: 'EMAIL_CONFLICT' })

    // Create department + admin in a transaction
    const passwordHash = await bcrypt.hash(password, 10)

    const department = await prisma.department.create({
      data: {
        name:          departmentName.trim(),
        slug,
        universityName: universityName?.trim() || null,
        admins: {
          create: {
            name:         `${departmentName.trim()} Admin`,
            email:        email.trim().toLowerCase(),
            passwordHash,
            role:         'department',
          },
        },
      },
      include: {
        admins: { select: { id: true, email: true, name: true, role: true } },
        _count:  { select: { leads: true } },
      },
    })

    fastify.log.info(`Created department "${department.name}" (${department.id}) with admin ${email}`)
    return reply.status(201).send({ success: true, data: department })
  })
}
