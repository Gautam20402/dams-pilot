// ── email.ts  (Brevo REST API — HTTPS port 443, works on Railway) ─────────────
// No SMTP, no port blocking. Just a plain HTTPS POST to api.brevo.com.
import type { Lead } from '@dams/db'

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

function getConfig() {
  const apiKey    = process.env.BREVO_API_KEY   ?? ''
  const fromEmail = process.env.SMTP_USER       ?? ''
  const fromName  = process.env.EMAIL_FROM_NAME ?? 'Graduate Admissions'
  if (!apiKey)    throw new Error('BREVO_API_KEY not set in Railway environment variables.')
  if (!fromEmail) throw new Error('SMTP_USER (sender email) not set in Railway environment variables.')
  return { apiKey, fromEmail, fromName }
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
    const { apiKey, fromEmail, fromName } = getConfig()
    const res = await fetch(BREVO_URL, {
      method:  'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender:      { name: fromName, email: fromEmail },
        to:          [{ email: to }],
        subject,
        htmlContent: html(body),
        textContent: body,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Brevo API error ${res.status}: ${err}`)
    }
    const data = await res.json() as { messageId?: string }
    return { id: data.messageId ?? 'sent' }
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
