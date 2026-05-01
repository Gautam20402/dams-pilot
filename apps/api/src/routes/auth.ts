import type { FastifyInstance } from 'fastify'
import { prisma } from '@dams/db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { JWT_SIGN_SECRET } from '../middleware/auth.js'

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login — public, no auth required
  fastify.post('/login', async (req, reply) => {
    const { email, password } = req.body as { email?: string; password?: string }
    if (!email || !password) {
      return reply.status(400).send({ success: false, error: 'Email and password are required', code: 'VALIDATION_ERROR' })
    }

    const admin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { department: { select: { id: true, name: true, slug: true } } },
    })
    if (!admin) {
      return reply.status(401).send({ success: false, error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' })
    }

    const valid = await bcrypt.compare(password, admin.passwordHash)
    if (!valid) {
      return reply.status(401).send({ success: false, error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' })
    }

    const token = jwt.sign(
      {
        adminId:      admin.id,
        email:        admin.email,
        name:         admin.name,
        role:         admin.role,
        departmentId: admin.departmentId,
      },
      JWT_SIGN_SECRET,
      { expiresIn: '7d' },
    )

    return reply.send({
      success: true,
      data: {
        token,
        admin: {
          id:           admin.id,
          name:         admin.name,
          email:        admin.email,
          role:         admin.role,
          departmentId: admin.departmentId,
          department:   admin.department,
        },
      },
    })
  })

  // GET /api/auth/me — requires auth (via middleware)
  fastify.get('/me', async (req, reply) => {
    if (!req.adminId) return reply.status(401).send({ success: false, error: 'Not authenticated', code: 'UNAUTHENTICATED' })
    const admin = await prisma.admin.findUnique({
      where: { id: req.adminId },
      include: { department: { select: { id: true, name: true, slug: true } } },
    })
    if (!admin) return reply.status(404).send({ success: false, error: 'Admin not found', code: 'NOT_FOUND' })
    return reply.send({
      success: true,
      data: {
        id:           admin.id,
        name:         admin.name,
        email:        admin.email,
        role:         admin.role,
        departmentId: admin.departmentId,
        department:   admin.department,
      },
    })
  })
}
