// ── email.ts  (Gmail SMTP via nodemailer) ─────────────────────────────────────
import nodemailer from 'nodemailer'
import type { Lead } from '@dams/db'

// ── Transporter (lazy, singleton) ────────────────────────────────────────────
let _transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    const port   = Number(process.env.SMTP_PORT ?? 587)
    const secure = process.env.SMTP_SECURE === 'true' // true only for port 465

    _transporter = nodemailer.createTransport({
      host:             process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
      },
      // Prevent requests from hanging forever
      connectionTimeout: 10_000,   // 10 s to establish TCP connection
      greetingTimeout:   10_000,   // 10 s waiting for SMTP greeting
      socketTimeout:     15_000,   // 15 s of inactivity before close
    })
  }
  return _transporter
}

const FROM_NAME  = process.env.EMAIL_FROM_NAME ?? 'Graduate Admissions'
const FROM_EMAIL = process.env.SMTP_USER        ?? 'noreply@example.com'
const FROM       = `"${FROM_NAME}" <${FROM_EMAIL}>`

// ── HTML wrapper ─────────────────────────────────────────────────────────────
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
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    if (!user || !pass) {
      throw new Error('SMTP credentials not configured. Set SMTP_USER and SMTP_PASS environment variables.')
    }
    const info = await getTransporter().sendMail({
      from: FROM,
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
      `Hi ${name},\n\nYour application has been received and is under review.\n\nReference: ${lead.id}\n\nYou will hear from us within 6–8 weeks.\n\n— Graduate Admissions Team`,
    )
  },
}
