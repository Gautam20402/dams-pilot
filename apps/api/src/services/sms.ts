// ── sms.ts ────────────────────────────────────────────────────────────────────
import twilio from 'twilio'
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
export const smsService = {
  async send(to: string, body: string) {
    const msg = await client.messages.create({ from:process.env.TWILIO_PHONE_NUMBER!, to, body })
    return { sid:msg.sid, status:msg.status }
  },
}
