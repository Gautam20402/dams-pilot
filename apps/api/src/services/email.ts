// ── email.ts  (Brevo REST API — HTTPS port 443, works on Railway) ─────────────
import type { Lead } from '@dams/db'

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

const ORG_NAME  = process.env.EMAIL_FROM_NAME ?? 'Graduate Admissions'
const FROM_EMAIL = () => process.env.SMTP_USER ?? ''

function getConfig() {
  const apiKey    = process.env.BREVO_API_KEY ?? ''
  const fromEmail = FROM_EMAIL()
  if (!apiKey)    throw new Error('BREVO_API_KEY not set in Railway environment variables.')
  if (!fromEmail) throw new Error('SMTP_USER (sender email) not set in Railway environment variables.')
  return { apiKey, fromEmail }
}

// ── Styled HTML email builder ─────────────────────────────────────────────────
interface EmailTemplate {
  heading:    string      // bold title under the badge
  badge:      string      // short label e.g. "Application Received"
  badgeBg:    string      // badge background colour
  badgeColor: string      // badge text colour
  lines:      string[]    // body paragraphs
  ref?:       string      // optional reference number box
  cta?:       { label: string; url: string }  // optional button
}

function buildHtml(t: EmailTemplate): string {
  const paragraphs = t.lines
    .map(l => `<p style="margin:0 0 14px;font-size:15px;color:#374151;line-height:1.7;font-family:Arial,sans-serif">${l}</p>`)
    .join('')

  const refBox = t.ref ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
      <tr>
        <td style="background:#f1f5f9;border-left:4px solid #3b82f6;border-radius:0 6px 6px 0;padding:14px 18px">
          <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">Reference Number</div>
          <div style="font-size:13px;font-family:monospace;color:#1e293b;word-break:break-all">${t.ref}</div>
        </td>
      </tr>
    </table>` : ''

  const ctaBtn = t.cta ? `
    <table cellpadding="0" cellspacing="0" style="margin:24px 0">
      <tr>
        <td style="background:#2563eb;border-radius:8px">
          <a href="${t.cta.url}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif">${t.cta.label}</a>
        </td>
      </tr>
    </table>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 32px">
              <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.01em">${ORG_NAME}</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:2px">Admissions Portal</div>
            </td>
          </tr>

          <!-- Status badge strip -->
          <tr>
            <td style="background:${t.badgeBg};padding:10px 32px">
              <span style="font-size:12px;font-weight:700;color:${t.badgeColor};letter-spacing:0.06em;text-transform:uppercase">${t.badge}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px 32px 24px">
              <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3">${t.heading}</h2>
              ${paragraphs}
              ${refBox}
              ${ctaBtn}
              <p style="margin:24px 0 0;font-size:14px;color:#374151;font-family:Arial,sans-serif">
                Warm regards,<br>
                <strong>${ORG_NAME}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 12px 12px;padding:16px 32px">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6">
                This is an automated message from ${ORG_NAME}. Please do not reply directly to this email.<br>
                If you have questions, contact our admissions office.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Plain text fallback ───────────────────────────────────────────────────────
function buildText(t: EmailTemplate): string {
  const lines = [t.heading, '', ...t.lines]
  if (t.ref) lines.push('', `Reference number: ${t.ref}`)
  if (t.cta) lines.push('', `${t.cta.label}: ${t.cta.url}`)
  lines.push('', `— ${ORG_NAME}`)
  return lines.join('\n')
}

// ── Low-level send ────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, t: EmailTemplate): Promise<{ id: string }> {
  const { apiKey, fromEmail } = getConfig()
  const res = await fetch(BREVO_URL, {
    method:  'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender:      { name: ORG_NAME, email: fromEmail },
      to:          [{ email: to }],
      subject,
      htmlContent: buildHtml(t),
      textContent: buildText(t),
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo API error ${res.status}: ${err}`)
  }
  const data = await res.json() as { messageId?: string }
  return { id: data.messageId ?? 'sent' }
}

// ── Service ───────────────────────────────────────────────────────────────────
export const emailService = {
  /** Raw send — used by the admin outreach panel */
  async sendCustom(to: string, subject: string, body: string) {
    return sendEmail(to, subject, {
      heading:    subject,
      badge:      'Message from Admissions',
      badgeBg:    '#eff6ff',
      badgeColor: '#2563eb',
      lines:      body.split('\n').filter(Boolean),
    })
  },

  /** Sent when a user abandons the form mid-way */
  async sendDropOff(lead: Lead) {
    if (!lead.email) return
    const name = lead.firstName ?? 'there'
    const url  = `${process.env.NEXTJS_URL}/public/apply/resume/${lead.id}`
    return sendEmail(lead.email, 'You left your application unfinished', {
      heading:    'Your application is waiting for you',
      badge:      'Action Required',
      badgeBg:    '#fff7ed',
      badgeColor: '#c2410c',
      lines: [
        `Hi ${name},`,
        `We noticed you started an application but didn't quite finish it. No worries — your progress has been saved and is ready whenever you are.`,
        `Pick up right where you left off by clicking the button below.`,
      ],
      ref: lead.id,
      cta: { label: 'Resume My Application', url },
    })
  },

  /** Sent immediately after a successful form submission */
  async sendConfirmation(lead: Lead) {
    if (!lead.email) return
    const name = lead.firstName ?? 'Applicant'
    return sendEmail(lead.email, `Application received — ref: ${lead.id}`, {
      heading:    'We have received your application!',
      badge:      'Application Received',
      badgeBg:    '#eff6ff',
      badgeColor: '#1d4ed8',
      lines: [
        `Hi ${name},`,
        `Thank you for submitting your application. We are pleased to confirm that it has been received and is now in our system.`,
        `Our admissions team will review your application and you will hear back from us within <strong>6–8 weeks</strong>.`,
        `Please keep your reference number safe — you may need it for future correspondence.`,
      ],
      ref: lead.id,
    })
  },

  /** Sent when an admin changes lead status via the dashboard */
  async sendStatusUpdate(lead: Lead, newStatus: string) {
    if (!lead.email) return
    const name = lead.firstName ?? 'Applicant'
    const ref  = lead.id

    type Tpl = { subject: string } & EmailTemplate

    const templates: Record<string, Tpl> = {
      contacted: {
        subject:    'We have been in touch regarding your application',
        heading:    'Our team has reviewed your application',
        badge:      'Update — Contacted',
        badgeBg:    '#f5f3ff',
        badgeColor: '#6d28d9',
        lines: [
          `Hi ${name},`,
          `Thank you for your interest in ${ORG_NAME}. Our admissions team has reviewed your application and a member of our team will be in touch with you shortly.`,
          `In the meantime, if you have any questions please feel free to reach out to our admissions office.`,
        ],
        ref,
      },
      in_progress: {
        subject:    'Your application is currently under review',
        heading:    'Your application is being reviewed',
        badge:      'Under Review',
        badgeBg:    '#fffbeb',
        badgeColor: '#b45309',
        lines: [
          `Hi ${name},`,
          `We wanted to keep you updated — your application is currently being carefully reviewed by our admissions committee.`,
          `This process typically takes <strong>4–6 weeks</strong>. We will notify you by email as soon as a decision has been reached.`,
          `Thank you for your patience and continued interest.`,
        ],
        ref,
      },
      converted: {
        subject:    '🎉 Congratulations — your application has been accepted!',
        heading:    'Congratulations, you have been accepted!',
        badge:      '🎉 Accepted',
        badgeBg:    '#f0fdf4',
        badgeColor: '#15803d',
        lines: [
          `Hi ${name},`,
          `We are absolutely delighted to inform you that your application has been <strong>successful</strong>!`,
          `You have been accepted and we warmly welcome you to ${ORG_NAME}. A member of our team will be reaching out shortly with your official offer letter and next steps for enrolment.`,
          `Once again, congratulations — we look forward to having you with us!`,
        ],
        ref,
      },
      dropped: {
        subject:    'An update regarding your application',
        heading:    'Update on your application',
        badge:      'Application Update',
        badgeBg:    '#f8fafc',
        badgeColor: '#475569',
        lines: [
          `Hi ${name},`,
          `We are writing to let you know that, after careful consideration, we are unfortunately unable to progress your application at this time.`,
          `We truly appreciate the effort you put into your application and encourage you to consider reapplying in the next intake cycle. Our admissions team would be happy to provide guidance on strengthening a future application.`,
          `We wish you all the very best in your journey ahead.`,
        ],
        ref,
      },
    }

    const t = templates[newStatus]
    if (!t) return
    const { subject, ...emailTpl } = t
    return sendEmail(lead.email, subject, emailTpl)
  },
}
