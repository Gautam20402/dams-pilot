import nodemailer from 'nodemailer'
import { Prisma } from '@dams/db'
type Lead = Prisma.LeadGetPayload<Record<string, never>>

function createTransport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

const FROM = `${process.env.EMAIL_FROM_NAME ?? 'Graduate Admissions'} <${process.env.SMTP_USER ?? ''}>`

function html(body: string) {
  const lines = body.split('\n').map(l =>
    `<p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:15px;color:#374151;line-height:1.7">${l || '&nbsp;'}</p>`
  ).join('')
  return `<!DOCTYPE html><html><body style="background:#f3f4f6;padding:40px 16px;margin:0">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
      <div style="background:#111827;padding:24px 32px">
        <h1 style="margin:0;color:#fff;font-family:Arial,sans-serif;font-size:18px;font-weight:700">ABM Technologies</h1>
        <p style="margin:4px 0 0;color:#9ca3af;font-family:Arial,sans-serif;font-size:13px">Graduate Admissions</p>
      </div>
      <div style="padding:32px">${lines}</div>
      <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#9ca3af">ABM Technologies — Graduate Admissions Office</p>
      </div>
    </div>
  </body></html>`
}

export const emailService = {
  async sendCustom(to: string, subject: string, body: string) {
    const transporter = createTransport()
    const info = await transporter.sendMail({ from: FROM, to, subject, html: html(body), text: body })
    return { id: info.messageId }
  },

  async sendConfirmation(lead: Lead, formTitle?: string) {
    if (!lead.email) return
    const name = lead.firstName ?? 'Applicant'
    const program = formTitle ?? 'our graduate program'
    const refId = lead.id.slice(0, 8).toUpperCase()

    return this.sendCustom(
      lead.email,
      `Application Received — Ref #${refId}`,
      `Dear ${name},

Thank you for submitting your application to ${program} at ABM Technologies.

We have successfully received your application and our admissions team will carefully review your submission.

Application Reference: #${refId}
Program: ${program}
Submitted: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

What happens next?
Our admissions committee will review your application within 6–8 weeks. You will receive an email notification regarding the status of your application.

If you have any questions in the meantime, feel free to reply to this email.

Best regards,
Graduate Admissions Team
ABM Technologies`
    )
  },

  async sendConversionCongratulations(lead: Lead, formTitle?: string) {
    if (!lead.email) return
    const name = lead.firstName ?? 'Applicant'
    const program = formTitle ?? 'our graduate program'

    return this.sendCustom(
      lead.email,
      `Congratulations! You have been accepted 🎓`,
      `Dear ${name},

Congratulations! We are thrilled to inform you that you have been accepted into the ${program} at ABM Technologies.

This is a significant achievement and we are excited to welcome you to our academic community.

Next Steps:
1. Log in to your applicant portal to confirm your enrollment
2. Review the program details and start date
3. Complete any outstanding documentation requested by the admissions office
4. Join our student orientation program

Your dedication and hard work have brought you to this moment. We look forward to supporting your academic journey and helping you achieve your goals.

Once again, congratulations on this well-deserved acceptance!

Warm regards,
Graduate Admissions Team
ABM Technologies`
    )
  },

  async sendDropOff(lead: Lead) {
    if (!lead.email) return
    const name = lead.firstName ?? 'there'
    const url  = `${process.env.NEXTJS_URL}/public/apply/resume/${lead.id}`
    return this.sendCustom(
      lead.email,
      'You started an application — pick up where you left off',
      `Hi ${name},

We noticed you started an application but didn't finish it.

Your progress is saved and waiting for you. Resume your application here:
${url}

Don't miss your chance to apply — complete your application today.

— Graduate Admissions Team
ABM Technologies`
    )
  },
}
