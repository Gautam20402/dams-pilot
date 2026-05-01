FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json            apps/api/
COPY packages/db/package.json         packages/db/
COPY packages/types/package.json      packages/types/
COPY packages/validators/package.json packages/validators/
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app/node_modules                  ./node_modules
COPY --from=deps /app/apps/api/node_modules         ./apps/api/node_modules
COPY . .
# Build workspace packages first — dist/ is gitignored so must be compiled here
RUN pnpm --filter @dams/types build
RUN pnpm --filter @dams/validators build
RUN pnpm --filter @dams/db build
RUN pnpm --filter @dams/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3001
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 fastify
COPY --from=builder /app/apps/api/dist              ./dist
COPY --from=builder /app/node_modules               ./node_modules
COPY --from=builder /app/node_modules/.prisma       ./node_modules/.prisma
COPY --from=builder /app/packages/db/prisma         ./prisma
COPY --from=builder /app/apps/api/package.json      ./
USER fastify
EXPOSE 3001
CMD ["sh","-c","npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/server.js"]
