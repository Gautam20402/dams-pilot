import 'dotenv/config'
import Fastify from 'fastify'
import cors     from '@fastify/cors'
import helmet   from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { authMiddleware }    from './middleware/auth.js'
import { leadsRoutes }       from './routes/leads.js'
import { formsRoutes }       from './routes/forms.js'
import { outreachRoutes }    from './routes/outreach.js'
import { authRoutes }        from './routes/auth.js'
import { departmentsRoutes } from './routes/departments.js'
import { salesforceRoutes }  from './routes/salesforce.js'

const server = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
})

await server.register(helmet, { contentSecurityPolicy: false })
await server.register(cors, {
  origin: [
    process.env.NEXTJS_URL ?? 'http://localhost:3000',
    /\.vercel\.app$/,
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})
await server.register(rateLimit, {
  max: 300, timeWindow: '1 minute',
  keyGenerator: req => (req.headers['x-forwarded-for'] as string) ?? req.ip,
})

server.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString(), env: process.env.NODE_ENV }))

server.addHook('preHandler', authMiddleware)

await server.register(authRoutes,        { prefix: '/api/auth' })
await server.register(leadsRoutes,       { prefix: '/api/leads' })
await server.register(formsRoutes,       { prefix: '/api/forms' })
await server.register(outreachRoutes,    { prefix: '/api/outreach' })
await server.register(departmentsRoutes, { prefix: '/api/departments' })
await server.register(salesforceRoutes,  { prefix: '/api/salesforce' })

server.setErrorHandler((error, _req, reply) => {
  server.log.error(error)
  const status = error.statusCode ?? 500
  reply.status(status).send({ success: false, error: error.message, code: 'API_ERROR' })
})

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3001)
    await server.listen({ port, host: '0.0.0.0' })
    console.log(`🚀 API on port ${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}
start()
