import 'dotenv/config'
import { Queue, Worker, QueueEvents } from 'bullmq'
import { google } from 'googleapis'
import { prisma }  from '@dams/db'
import { emailService } from '../services/email.js'
import { salesforceService } from '../services/salesforce.js'

const REDIS = { connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' } }
const INTERVAL_MS = 5 * 60 * 1000   // 5 minutes — well under 18-min GA4 token window

const queue = new Queue('ga4-poller', REDIS)

await queue.upsertJobScheduler('poll-5min', { every: INTERVAL_MS },
  { name:'ga4-poll', data:{}, opts:{ removeOnComplete:100, removeOnFail:50 } })

function getGA4() {
  const key = JSON.parse(Buffer.from(process.env.GA4_SERVICE_ACCOUNT_KEY_BASE64 ?? '', 'base64').toString())
  const auth = new google.auth.GoogleAuth({ credentials:key, scopes:['https://www.googleapis.com/auth/analytics.readonly'] })
  return google.analyticsdata({ version:'v1beta', auth })
}

const worker = new Worker('ga4-poller', async (job) => {
  console.log(`[GA4 Poller] Cycle #${job.attemptsMade+1} — ${new Date().toISOString()}`)

  const ga4   = getGA4()   // fresh client = fresh token every cycle
  const propId = process.env.GA4_PROPERTY_ID!

  const forms = await prisma.form.findMany({ where:{ status:'active' }, select:{ slug:true, id:true, departmentId:true } })
  if (!forms.length) { console.log('[GA4 Poller] No active forms'); return }

  const paths = forms.map(f => `/apply/${f.slug}`)

  const response = await ga4.properties.runReport({
    property: propId,
    requestBody: {
      dateRanges: [{ startDate:'6minutesAgo', endDate:'today' }],
      dimensions: [
        { name:'pagePath' }, { name:'sessionCampaignName' },
        { name:'firstUserSource' }, { name:'firstUserMedium' }, { name:'sessionId' },
      ],
      metrics: [{ name:'sessions' }, { name:'conversions' }],
      dimensionFilter: { orGroup: { expressions: paths.map((p: string) => ({
        filter: { fieldName:'pagePath', stringFilter:{ matchType:'CONTAINS', value:p } }
      }))}},
    },
  })

  const rows = response.data.rows ?? []
  console.log(`[GA4 Poller] ${rows.length} sessions found`)
  let created = 0, skipped = 0

  for (const row of rows) {
    const dims       = row.dimensionValues ?? []
    const pagePath   = dims[0]?.value ?? ''
    const campaign   = dims[1]?.value ?? ''
    const utmSource  = dims[2]?.value ?? ''
    const utmMedium  = dims[3]?.value ?? ''
    const sessionId  = dims[4]?.value ?? ''
    const conversions = Number(row.metricValues?.[1]?.value ?? 0)

    if (conversions > 0) { skipped++; continue }

    const form = forms.find((f: { slug: string; id: string; departmentId: string }) => pagePath.includes(f.slug))
    if (!form) { skipped++; continue }

    const gaClientId = `ga_${sessionId}`
    const existing   = await prisma.lead.findFirst({ where:{ gaClientId } })
    if (existing) { skipped++; continue }

    const lead = await prisma.lead.create({ data: {
      sessionId:   `ga_${sessionId}_${Date.now()}`,
      formId:      form.id, departmentId:form.departmentId,
      status:      'new', source:'ga_poll',
      gaClientId,  utmSource, utmMedium,
      utmCampaign: campaign !== '(not set)' ? campaign : undefined,
      dataJson:    {},
    }})
    await prisma.leadEvent.create({ data:{ leadId:lead.id, eventType:'lead_created', metadata:{ source:'ga4_poller', pagePath } } })
    salesforceService.pushLead(lead).catch(console.error)
    created++
    console.log(`[GA4 Poller] Lead created: ${lead.id}`)
  }

  console.log(`[GA4 Poller] Done — created:${created} skipped:${skipped}`)
  return { created, skipped }
}, { ...REDIS, concurrency:1 })

const qEvents = new QueueEvents('ga4-poller', REDIS)
let consecutiveFails = 0

qEvents.on('failed', async ({ jobId, failedReason }) => {
  consecutiveFails++
  console.error(`[GA4 Poller] Job ${jobId} failed (${consecutiveFails}): ${failedReason}`)
  if (consecutiveFails >= 3) {
    console.error('[GA4 Poller] ⚠️  3 consecutive failures — sending alert')
    // TODO: replace with real alert (Slack, PagerDuty, email)
    consecutiveFails = 0
  }
})
qEvents.on('completed', () => { consecutiveFails = 0 })
worker.on('error', err => console.error('[GA4 Poller] Worker error:', err))

console.log('🔄 GA4 Poller started — polling every 5 minutes')

process.on('SIGTERM', async () => {
  await worker.close(); await queue.close(); await prisma.$disconnect(); process.exit(0)
})
