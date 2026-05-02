// ── email.ts  (Gmail API via OAuth2 — works on Railway / any host) ────────────
// Uses googleapis over HTTPS (port 443), never blocked by cloud providers.
// nodemailer is kept as the message builder; the transport is OAuth2/Gmail.
import nodemailer from 'nodemailer'
import { google }  from 'googleapis'
import type { Lead } from '@dams/db'

// ── OAuth2 client (lazy) ──────────────────────────────────────────────────────
let _transporter: nodemailer.Transporter | null = null

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (_transporter) return _transporter

  const clientId     = process.env.GMAIL_CLIENT_ID     ?? ''
  const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? ''
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN ?? ''
  const user         = process.env.GMAIL_USER          ?? process.env.SMTP_USER ?? ''

  if (!clientId || !clientSecret || !refreshToken || !user) {
    throw new Error(
      'Gmail OAuth2 not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, ' +
      'GMAIL_REFRESH_TOKEN and GMAIL_USER in Railway environment variables.'
    )
  }

  const oauth2 = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'https://developers.google.com/oauthplayground',
  )
  oauth2.setCredentials({ refresh_token: refreshToken })

  const { token: accessToken } = await oauth2.getAccessToken()

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type:         'OAuth2',
      user,
      clientId,
      clientSecret,
      refreshToken,
      accessToken:  accessToken ?? undefined,
    },
  } as any)

  return _transporter
}

const FROM_NAME = process.env.EMAIL_FROM_NAME ?? 'Graduate Admissions'

function fromAddress(): string {
  const user = process.env.GMAIL_USER ?? process.env.SMTP_USER ?? ''
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
    const transporter = await getTransporter()
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
      `Hi ${name},\n\nYour application has been received and is under review.\n\nReference: ${lead.id}\n\nYou will hear from us within 6–8 weeks.\n\n— Graduate Admissions Team`,
    )
  },
}
