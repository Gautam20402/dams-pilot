import jsforce from 'jsforce'
import type { Lead } from '@dams/db'
import { prisma } from '@dams/db'

let conn: jsforce.Connection | null = null

async function getConn(): Promise<jsforce.Connection> {
  if (conn) return conn
  conn = new jsforce.Connection({ loginUrl: process.env.SF_LOGIN_URL })
  await conn.login(process.env.SF_USERNAME!, process.env.SF_PASSWORD! + process.env.SF_SECURITY_TOKEN!)
  return conn
}

export const salesforceService = {
  async pushLead(lead: Lead): Promise<string | null> {
    try {
      const sf  = await getConn()
      const dj  = lead.dataJson as Record<string,string>
      const res = await (sf.sobject('Lead') as any).create({
        FirstName:   lead.firstName ?? dj.first_name ?? '',
        LastName:    lead.lastName  ?? dj.last_name  ?? 'Unknown',
        Email:       lead.email     ?? dj.email      ?? '',
        Phone:       lead.phone     ?? dj.phone      ?? '',
        Company:     'Applicant',
        LeadSource:  lead.utmSource ? `UTM:${lead.utmSource}` : 'Web',
        Description: `Program:${dj.program??''} | Dept:${lead.departmentId} | GA4:${lead.gaClientId??''} | Campaign:${lead.utmCampaign??''}`,
        Status:      'Open - Not Contacted',
      })
      if (res.success && res.id) {
        await prisma.lead.update({ where:{ id:lead.id }, data:{ sfLeadId:res.id } })
        return res.id as string
      }
      return null
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
