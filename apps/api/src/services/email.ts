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

  async sendStatusUpdate(lead: Lead, newStatus: string) {
    if (!lead.email) return
    const name = lead.firstName ?? 'Applicant'
    const ref  = lead.id

    const templates: Record<string, { subject: string; body: string }> = {
      contacted: {
        subject: 'We have reviewed your application',
        body: `Hi ${name},\n\nThank you for your interest. Our admissions team has reviewed your application (ref: ${ref}) and we will be in touch with you shortly.\n\nIf you have any questions in the meantime, please do not hesitate to reach out.\n\n— Graduate Admissions Team`,
      },
      in_progress: {
        subject: 'Your application is under review',
        body: `Hi ${name},\n\nWe wanted to let you know that your application (ref: ${ref}) is currently being reviewed by our admissions committee.\n\nThis process typically takes 4–6 weeks. We will notify you as soon as a decision has been made.\n\nThank you for your patience.\n\n— Graduate Admissions Team`,
      },
      converted: {
        subject: 'Congratulations — your application has been accepted!',
        body: `Hi ${name},\n\nWe are delighted to inform you that your application (ref: ${ref}) has been successful!\n\nCongratulations — you have been accepted. A member of our team will be in touch shortly with the next steps and enrolment details.\n\nWelcome aboard!\n\n— Graduate Admissions Team`,
      },
      dropped: {
        subject: 'Update on your application',
        body: `Hi ${name},\n\nWe wanted to reach out regarding your application (ref: ${ref}).\n\nUnfortunately, we are unable to progress your application at this time. We encourage you to reapply in the next intake cycle.\n\nThank you for your interest and we wish you all the best.\n\n— Graduate Admissions Team`,
      },
    }

    const template = templates[newStatus]
    if (!template) return  // no email for new / partial / submitted (handled elsewhere)
    return this.sendCustom(lead.email, template.subject, template.body)
  },
}
