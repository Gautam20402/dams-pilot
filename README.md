# DAMS — Decentralized Application Management System

Full-stack monorepo. Next.js 14 frontend on Vercel + Fastify API + BullMQ worker on Railway + PostgreSQL on Supabase + Redis on Upstash.

---

## Stack

| Layer | Tech | Version |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind | 14.1 |
| Auth | Clerk (multi-tenant, RBAC via publicMetadata) | 5.1 |
| Backend | Fastify 4 + TypeScript | 4.26 |
| ORM | Prisma 5 | 5.8 |
| Database | PostgreSQL 16 on Supabase | 16 |
| Queue | BullMQ + Redis on Upstash | 5.1 |
| Email | Resend | 3.2 |
| SMS | Twilio | 5.0 |
| Analytics | GA4 Data API (service account) | googleapis |
| CRM | Salesforce REST API (jsforce) | 1.11 |
| Deploy FE | Vercel | — |
| Deploy BE | Railway (2 services) | — |

---

## Project structure

```
dams/
├── apps/
│   ├── web/                        # Next.js 14 frontend
│   │   └── src/
│   │       ├── app/
│   │       │   ├── admin/dashboard/         # Lead dashboard
│   │       │   ├── admin/dashboard/forms/   # Form builder
│   │       │   ├── public/apply/            # Public application form
│   │       │   └── auth/sign-in/            # Clerk sign-in
│   │       ├── hooks/index.ts               # All React Query hooks
│   │       ├── lib/api.ts                   # Axios API client
│   │       └── lib/ga4.ts                   # GA4 + UTM utilities
│   └── api/                        # Fastify backend
│       └── src/
│           ├── server.ts                    # Entry point
│           ├── routes/                      # leads, forms, outreach, auth
│           ├── middleware/auth.ts           # Clerk JWT + RBAC
│           ├── services/                    # email, sms, salesforce
│           └── workers/poller.worker.ts     # GA4 BullMQ poller
├── packages/
│   ├── db/                         # Prisma schema + client + seed
│   ├── types/                      # Shared TypeScript types + RBAC
│   └── validators/                 # Shared Zod schemas
├── .env.example                    # All env vars documented
└── pnpm-workspace.yaml
```

---

## Prerequisites — create these accounts first

1. **Supabase** — https://supabase.com (free tier) → create project
2. **Upstash Redis** — https://upstash.com (free tier) → create database
3. **Clerk** — https://clerk.com → create application → choose Next.js
4. **Resend** — https://resend.com → verify a sender domain
5. **Twilio** — https://twilio.com → trial account + phone number
6. **GA4** — https://analytics.google.com → create property + GCP service account
7. **Salesforce** → developer org or sandbox
8. **Vercel** — https://vercel.com → connect GitHub repo
9. **Railway** — https://railway.app → create project

---

## Local setup (15 minutes)

### Step 1 — Clone and install

```bash
git clone <your-repo-url>
cd dams
pnpm install
```

### Step 2 — Environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in **minimum required** values:

```env
DATABASE_URL="postgresql://postgres.xxxx:pass@xxxx.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxx:pass@xxxx.pooler.supabase.com:5432/postgres"
REDIS_URL="rediss://default:xxx@xxx.upstash.io:6379"
CLERK_SECRET_KEY="sk_test_xxx"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxx"
RESEND_API_KEY="re_xxx"
EMAIL_FROM="admissions@yourdomain.com"
API_SECRET="any_random_32_char_string_here"
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXTJS_URL="http://localhost:3000"
```

> **Supabase URLs:** Go to Supabase → Settings → Database.
> Copy the **Transaction pooler** string (port 6543) into `DATABASE_URL`.
> Copy the **Direct connection** string (port 5432) into `DIRECT_URL`.
> Replace `[YOUR-PASSWORD]` with your actual DB password in both.

### Step 3 — Database

```bash
# Generate Prisma client
pnpm db:generate

# Create all tables
pnpm db:migrate

# Seed 5 departments, 2 forms, 10 demo leads
pnpm db:seed
```

Verify in Prisma Studio:
```bash
pnpm db:studio
# Opens http://localhost:5555
```

### Step 4 — Start dev servers

```bash
# Terminal 1 — API (port 3001)
cd apps/api && pnpm dev

# Terminal 2 — Frontend (port 3000)
cd apps/web && pnpm dev

# Terminal 3 — GA4 worker (optional for local dev)
cd apps/api && pnpm worker
```

### Step 5 — First sign-in and user sync

1. Open http://localhost:3000 → you are redirected to sign-in
2. Sign up via Clerk
3. Run this **once** in your browser console to sync your user to the database:

```js
const token = await window.Clerk.session.getToken()
await fetch('http://localhost:3001/api/auth/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
  body: JSON.stringify({
    clerkId: window.Clerk.user.id,
    email: window.Clerk.user.primaryEmailAddress.emailAddress,
    firstName: window.Clerk.user.firstName,
    lastName: window.Clerk.user.lastName,
    role: 'SUPER_ADMIN'
  })
})
```

4. In Clerk Dashboard → Users → click your user → **Public metadata** → paste:

```json
{
  "role": "SUPER_ADMIN",
  "departmentId": "paste-any-dept-id-from-prisma-studio"
}
```

5. Refresh → http://localhost:3000/admin/dashboard → 10 demo leads appear

---

## Deploy — Backend to Railway

### Step 1 — Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### Step 2 — Create project

```bash
railway init
# Choose: Create new project → name it "dams"
```

### Step 3 — Add Supabase and Redis

In Railway dashboard:
- Click **+ New** → **Database** → Connect your Supabase (or Railway will offer managed Postgres)
- Click **+ New** → add Redis or connect Upstash

### Step 4 — Create API service

```bash
# In Railway dashboard:
# + New → GitHub Repo → select your repo
# Set Dockerfile path: apps/api/Dockerfile
# Service name: dams-api
```

### Step 5 — Create Worker service

In Railway dashboard:
- **+ New** → same GitHub repo
- Dockerfile: `apps/api/Dockerfile.worker`
- Service name: `dams-worker`

### Step 6 — Set Railway environment variables

In each service → Variables → add all values from `.env`:

```
DATABASE_URL
DIRECT_URL
REDIS_URL
CLERK_SECRET_KEY
RESEND_API_KEY
EMAIL_FROM
EMAIL_FROM_NAME
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
GA4_PROPERTY_ID
GA4_SERVICE_ACCOUNT_KEY_BASE64
SF_LOGIN_URL
SF_USERNAME
SF_PASSWORD
SF_SECURITY_TOKEN
NEXTJS_URL             ← set after Vercel deploy
API_SECRET
NODE_ENV=production
```

### Step 7 — Deploy

```bash
railway up
```

Railway auto-runs `prisma migrate deploy` before the API starts (from the Dockerfile CMD).

### Step 8 — Get your Railway URL

Dashboard → dams-api → Settings → copy the public URL.  
Example: `https://dams-api-production.up.railway.app`

---

## Deploy — Frontend to Vercel

### Step 1 — Install Vercel CLI

```bash
npm install -g vercel
cd apps/web
vercel
```

Follow the prompts. When asked about the root directory, enter `apps/web`.

### Step 2 — Set environment variables in Vercel

```bash
vercel env add NEXT_PUBLIC_API_URL          # your Railway URL
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add NEXT_PUBLIC_GA4_MEASUREMENT_ID
```

Or add them in Vercel Dashboard → Project → Settings → Environment Variables.

### Step 3 — Deploy

```bash
vercel --prod
```

Copy your Vercel URL (e.g. `https://dams.vercel.app`).

### Step 4 — Update Railway with Vercel URL

In Railway → dams-api service → Variables:
```
NEXTJS_URL=https://dams.vercel.app
```

Also update in Railway → dams-worker:
```
NEXTJS_URL=https://dams.vercel.app
```

### Step 5 — Set Clerk webhook

In Clerk Dashboard → Webhooks → + Add endpoint:
```
URL: https://dams-api-production.up.railway.app/api/webhooks/clerk
Events: user.created, user.updated
```

---

## Set up Clerk user roles

For every admin user, set in Clerk Dashboard → Users → Public metadata:

```json
{
  "role": "SUPER_ADMIN",
  "departmentId": "get-this-from-your-db"
}
```

**Roles:**

| Role | Can update status | Can send outreach | Can edit forms | Sees all depts |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | ✓ | ✓ | ✓ |
| DEPT_ADMIN | ✓ | ✓ | ✓ | ✗ |
| CALLER | ✓ | ✓ | ✗ | ✗ |
| BUILDER | ✗ | ✗ | ✓ | ✗ |

---

## URL structure

| URL | What it is |
|---|---|
| `/admin/dashboard` | Lead dashboard (protected, Clerk) |
| `/admin/dashboard/forms` | Drag-and-drop form builder |
| `/public/apply` | Public application form (no auth) |
| `/auth/sign-in` | Clerk sign-in page |
| `API /health` | Health check |
| `API /api/leads/partial` | Progressive save endpoint (public) |
| `API /api/forms/public/:slug` | Public form schema fetch |

---

## GA4 service account setup

```bash
# 1. Go to Google Cloud Console → IAM → Service Accounts
# 2. Create service account → download JSON key
# 3. In GA4 → Admin → Property Access → add service account email as Viewer
# 4. Base64 encode the key:
base64 -i service-account.json | tr -d '\n'
# 5. Paste output into GA4_SERVICE_ACCOUNT_KEY_BASE64
```

---

## Troubleshooting

**"No departments found" on startup**
→ Run `pnpm db:seed`

**Dashboard shows 0 leads after sign-in**
→ Your Clerk user isn't synced to the DB. Run the browser console sync script in Step 5 of local setup.

**CORS errors in browser**
→ Make sure `NEXTJS_URL` in Railway matches your exact Vercel URL (no trailing slash).

**Prisma Client error on Railway deploy**
→ The Dockerfile runs `prisma generate` during build. Make sure `DATABASE_URL` and `DIRECT_URL` are set in Railway before deploying.

**GA4 poller "permission denied"**
→ The service account email must be added to the GA4 property as a Viewer. Check GA4 → Admin → Property Access Management.

**Salesforce connection fails**
→ For sandbox orgs, set `SF_LOGIN_URL=https://test.salesforce.com`
