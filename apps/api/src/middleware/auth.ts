import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@dams/db'
import type { UserRole } from '@dams/types'
import { ROLE_PERMISSIONS } from '@dams/types'

const PUBLIC = ['/health', '/api/webhooks', '/api/leads/partial', '/api/leads/drop-off', '/api/forms/public/']

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string; userRole?: string; departmentId?: string; clerkId?: string
  }
}

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  if (PUBLIC.some(r => req.url.startsWith(r))) return

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ success:false, error:'Unauthorized', code:'MISSING_TOKEN' })
  }
  const token = auth.replace('Bearer ', '')

  try {
    if (token === process.env.API_SECRET) { req.userRole = 'SUPER_ADMIN'; return }

    const parts  = token.split('.')
    if (parts.length !== 3) throw new Error('Invalid JWT format')
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    const clerkId = payload.sub as string

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id:true, role:true, departmentId:true, clerkId:true },
    })
    if (!user) return reply.status(401).send({ success:false, error:'User not found', code:'USER_NOT_FOUND' })

    req.userId       = user.id
    req.userRole     = user.role
    req.departmentId = user.departmentId
    req.clerkId      = user.clerkId
  } catch {
    return reply.status(401).send({ success:false, error:'Invalid token', code:'INVALID_TOKEN' })
  }
}

// ── RBAC helpers ───────────────────────────────────────────────────────────────
type Permission = keyof typeof ROLE_PERMISSIONS[UserRole]

export function requirePermission(permission: Permission) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const role = req.userRole as UserRole | undefined
    if (!role) return reply.status(401).send({ success:false, error:'Not authenticated', code:'UNAUTHENTICATED' })
    const perms = ROLE_PERMISSIONS[role]
    if (!perms?.[permission]) return reply.status(403).send({ success:false, error:'Forbidden', code:'FORBIDDEN' })
  }
}

export async function scopeToDepartment(req: FastifyRequest, reply: FastifyReply) {
  const role = req.userRole as UserRole | undefined
  if (role === 'SUPER_ADMIN') return
  if (!req.departmentId) return reply.status(403).send({ success:false, error:'No department assigned', code:'NO_DEPT' })
}
