// ── email.ts  (Brevo SMTP relay — port 2525, never blocked by Railway) ────────
import nodemailer from 'nodemailer'
import type { Lead } from '@dams/db'

function buildTransporter(): nodemailer.Transporter {
  const host = process.env.SMTP_HOST ?? 'smtp-relay.brevo.com'
  const port = Number(process.env.SMTP_PORT ?? 2525)
  const user = process.env.SMTP_USER ?? ''
  const pass = process.env.SMTP_PASS ?? ''

  if (!user || !pass) {
    throw new Error('SMTP not configured. Set SMTP_USER and SMTP_PASS in Railway environment variables.')
  }

  return nodemailer.createTransport({ host, port, auth: { user, pass } })
}

const FROM_NAME = process.env.EMAIL_FROM_NAME ?? 'Graduate Admissions'

function fromAddress(): string {
  const user = process.env.SMTP_USER ?? ''
  return `"${FROM_NAME}" <${user}>`
}

// ── HTML wrapper ──────────────────────────────────────────────────────────────
function html(text: string): string {
  const lines = text
    .split('\n')
    .map(l => `<p style="margin:0 0 10px;font-family:sans-serif;font-size:14px;color:#374151;line-height:1.6">${l || '&nbsp;'}</p>`)
    .join('')
  return `<!DOCTYPE html><html><body style="background:#f9fafb;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:28px">
      ${lines}
    </div>
  </body></html>`
}

// ── Service ───────────────────────────────────────────────────────────────────
export const emailService = {
  async sendCustom(to: string, subject: string, body: string) {
    const transporter = buildTransporter()
    const info = await transporter.sendMail({
      from: fromAddress(),
      to,
      subject,
      text: body,
      html: html(body),
    })
    return { id: info.messageId }
  },

  async sendDropOff(lead: Lead) {
    if (!lead.email) return
    const name = lead.firstName ?? 'there'
    const url  = `${process.env.NEXTJS_URL}/public/apply/resume/${lead.id}`
    return this.sendCustom(
      lead.email,
      'You started an application — pick up where you left off',
      `Hi ${name},\n\nWe noticed you started an application but didn't complete it.\n\nResume your application here:\n${url}\n\nYour progress is saved and waiting.\n\n— Graduate Admissions Team`,
    )
  },

  async sendConfirmation(lead: Lead) {
    if (!lead.email) return
    const name = lead.firstName ?? 'Applicant'
    return this.sendCustom(
      lead.email,
      `Application received — ref: ${lead.id}`,
      `Hi ${name},\n\nThank you! Your application has been received and is now under review.\n\nReference number: ${lead.id}\n\nYou will hear from us within 6–8 weeks.\n\n— Graduate Admissions Team`,
    )
  },
}
