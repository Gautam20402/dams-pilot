import type { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { ROLE_PERMISSIONS } from '@dams/types'
import type { UserRole } from '@dams/types'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dams-dev-secret-change-in-prod'

const PUBLIC = [
  '/health',
  '/api/leads/partial',
  '/api/leads/drop-off',
  '/api/leads/submit',
  '/api/forms/public/',
  '/api/auth/login',
]

declare module 'fastify' {
  interface FastifyRequest {
    adminId?: string
    userId?: string
    userRole?: string
    departmentId?: string
    adminEmail?: string
    adminName?: string
  }
}

export interface AdminTokenPayload {
  adminId: string
  email: string
  name: string
  role: 'admin' | 'department'
  departmentId: string | null
}

export const JWT_SIGN_SECRET = JWT_SECRET

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  if (PUBLIC.some(r => req.url.startsWith(r))) return

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, error: 'Unauthorized', code: 'MISSING_TOKEN' })
  }

  const token = auth.replace('Bearer ', '')

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AdminTokenPayload
    req.adminId      = payload.adminId
    req.userId       = payload.adminId
    req.adminEmail   = payload.email
    req.adminName    = payload.name
    // Map our roles to the existing RBAC system
    req.userRole     = payload.role === 'admin' ? 'SUPER_ADMIN' : 'DEPT_ADMIN'
    req.departmentId = payload.departmentId ?? undefined
  } catch {
    return reply.status(401).send({ success: false, error: 'Invalid or expired token', code: 'INVALID_TOKEN' })
  }
}

// ── RBAC helpers ───────────────────────────────────────────────────────────────
type Permission = keyof (typeof ROLE_PERMISSIONS)[UserRole]

export function requirePermission(permission: Permission) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const role = req.userRole as UserRole | undefined
    if (!role) return reply.status(401).send({ success: false, error: 'Not authenticated', code: 'UNAUTHENTICATED' })
    const perms = ROLE_PERMISSIONS[role]
    if (!perms?.[permission]) return reply.status(403).send({ success: false, error: 'Forbidden', code: 'FORBIDDEN' })
  }
}

export async function scopeToDepartment(req: FastifyRequest, reply: FastifyReply) {
  const role = req.userRole as UserRole | undefined
  if (role === 'SUPER_ADMIN') return
  if (!req.departmentId) return reply.status(403).send({ success: false, error: 'No department assigned', code: 'NO_DEPT' })
}
