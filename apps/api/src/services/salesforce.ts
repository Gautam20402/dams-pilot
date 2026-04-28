import jsforce, { type Connection } from 'jsforce'
import type { Lead } from '@dams/db'
import { prisma } from '@dams/db'
import type { SalesforceLeadInput } from '@dams/validators'

let conn: Connection | null = null

async function getConn(): Promise<Connection> {
  if (conn) return conn
  conn = new jsforce.Connection({ loginUrl: process.env.SF_LOGIN_URL })
  await conn.login(process.env.SF_USERNAME!, process.env.SF_PASSWORD! + process.env.SF_SECURITY_TOKEN!)
  return conn
}

type SalesforceFieldValue = string | number | boolean | null
type RawSalesforceRecord = Record<string, SalesforceFieldValue | undefined>
type SalesforceRecord = Record<string, SalesforceFieldValue>

const MANDATORY_SALESFORCE_FIELDS = new Set([
  'FirstName',
  'LastName',
  'Company',
  'Email',
  'Phone',
  'LeadSource',
  'Status',
])

function compactRecord(record: RawSalesforceRecord): SalesforceRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== ''),
  ) as SalesforceRecord
}

export function buildSalesforceLeadRecord(input: SalesforceLeadInput): SalesforceRecord {
  const dynamicFields = Object.fromEntries(
    Object.entries(input.dynamicFields).filter(([key]) => !MANDATORY_SALESFORCE_FIELDS.has(key)),
  )

  return compactRecord({
    ...dynamicFields,
    FirstName:  input.mandatoryFields.firstName,
    LastName:   input.mandatoryFields.lastName,
    Company:    input.mandatoryFields.company,
    Email:      input.mandatoryFields.email,
    Phone:      input.mandatoryFields.phone,
    LeadSource: input.mandatoryFields.leadSource ?? 'Web',
    Status:     input.mandatoryFields.status ?? 'Open - Not Contacted',
  })
}

export const salesforceService = {
  buildLeadRecord: buildSalesforceLeadRecord,

  async createLead(input: SalesforceLeadInput): Promise<string | null> {
    try {
      const sf = await getConn()
      const record = buildSalesforceLeadRecord(input)
      const res = await (sf.sobject('Lead') as any).create(record)

      if (res.success && res.id) {
        if (input.leadId) {
          await prisma.lead.update({ where:{ id:input.leadId }, data:{ sfLeadId:res.id } })
          await prisma.leadEvent.create({
            data:{
              leadId:input.leadId,
              eventType:'salesforce_lead_created',
              metadata:{ sfLeadId:res.id, dynamicFields:Object.keys(input.dynamicFields) },
            },
          })
        }
        return res.id as string
      }
      return null
    } catch (err) {
      console.error('[Salesforce createLead]', err)
      return null
    }
  },

  async pushLead(lead: Lead): Promise<string | null> {
    try {
      const dj  = lead.dataJson as Record<string,string>
      return await this.createLead({
        leadId: lead.id,
        mandatoryFields: {
          firstName:  lead.firstName ?? dj.first_name,
          lastName:   lead.lastName  ?? dj.last_name  ?? 'Unknown',
          email:      lead.email     ?? dj.email,
          phone:      lead.phone     ?? dj.phone,
          company:    'Applicant',
          leadSource: lead.utmSource ? `UTM:${lead.utmSource}` : 'Web',
          status:     'Open - Not Contacted',
        },
        dynamicFields: {
          Description: `Program:${dj.program??''} | Dept:${lead.departmentId} | GA4:${lead.gaClientId??''} | Campaign:${lead.utmCampaign??''}`,
        },
      })
    } catch (err) {
      console.error('[Salesforce]', err)
      return null
    }
  },
  async updateStatus(sfLeadId: string, status: string) {
    try { const sf = await getConn(); await (sf.sobject('Lead') as any).update({ Id:sfLeadId, Status:status }) }
    catch (err) { console.error('[Salesforce updateStatus]', err) }
  },
}
