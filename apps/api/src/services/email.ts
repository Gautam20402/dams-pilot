// ── email.ts ──────────────────────────────────────────────────────────────────
import { Resend } from 'resend'
import { Prisma } from '@dams/db'
type Lead = Prisma.LeadGetPayload<Record<string, never>>

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = `${process.env.EMAIL_FROM_NAME ?? 'Graduate Admissions'} <${process.env.EMAIL_FROM ?? 'noreply@yourdomain.com'}>`

function html(text: string) {
  const lines = text.split('\n').map(l =>
    `<p style="margin:0 0 10px;font-family:sans-serif;font-size:14px;color:#374151;line-height:1.6">${l||'&nbsp;'}</p>`
  ).join('')
  return `<!DOCTYPE html><html><body style="background:#f9fafb;padding:32px 16px"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:28px">${lines}</div></body></html>`
}

export const emailService = {
  async sendCustom(to: string, subject: string, body: string) {
    const { data, error } = await resend.emails.send({ from:FROM, to, subject, html:html(body), text:body })
    if (error) throw new Error(`Resend: ${error.message}`)
    return { id: data!.id }
  },
  async sendDropOff(lead: Lead) {
    if (!lead.email) return
    const name = lead.firstName ?? 'there'
    const url  = `${process.env.NEXTJS_URL}/public/apply/resume/${lead.id}`
    return this.sendCustom(lead.email,
      'You started an application — pick up where you left off',
      `Hi ${name},\n\nWe noticed you started an application but didn't complete it.\n\nResume your application here:\n${url}\n\nYour progress is saved and waiting.\n\n— Graduate Admissions Team`
    )
  },
  async sendConfirmation(lead: Lead) {
    if (!lead.email) return
    const name = lead.firstName ?? 'Applicant'
    return this.sendCustom(lead.email,
      `Application received — ref: ${lead.id}`,
      `Hi ${name},\n\nYour application has been received and is under review.\n\nReference: ${lead.id}\n\nYou will hear from us within 6–8 weeks.\n\n— Graduate Admissions Team`
    )
  },
}
