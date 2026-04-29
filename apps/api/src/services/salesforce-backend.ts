type SalesforceBackendSubmitPayload = {
  externalLeadId: string
  mandatoryFields: {
    firstName: string
    lastName: string
    company: string
    email?: string
    phone?: string
    status?: string
  }
  dynamicFields: Record<string, unknown>
}

type SalesforceBackendSubmitSuccess = {
  recordId?: string
  [key: string]: unknown
}

function asStringRecord(dataJson: unknown): Record<string, string> {
  if (!dataJson || typeof dataJson !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(dataJson as Record<string, unknown>)) {
    if (v === null || v === undefined) continue
    if (typeof v === 'string') out[k] = v
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v)
    else if (Array.isArray(v)) out[k] = v.map(String).join(', ')
    else out[k] = JSON.stringify(v)
  }
  return out
}

function pickDynamicFields(dj: Record<string, string>) {
  const excluded = new Set(['first_name', 'last_name', 'email', 'phone', 'company', 'status'])
  const dynamic: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(dj)) {
    if (!v) continue
    if (excluded.has(k)) continue
    dynamic[k] = v
  }

  return dynamic
}

export const salesforceBackendService = {
  buildPayload(input: {
    externalLeadId: string
    dataJson: unknown
    completionPct?: number | null
    utm?: {
      source?: string | null
      medium?: string | null
      campaign?: string | null
      content?: string | null
      term?: string | null
    }
  }): SalesforceBackendSubmitPayload {
    const dj = asStringRecord(input.dataJson)

    const mandatoryFields = {
      firstName: dj.first_name ?? '',
      lastName: dj.last_name ?? 'Unknown',
      company: dj.company ?? 'Applicant',
      email: dj.email,
      phone: dj.phone,
      status: dj.status ?? 'Open - Not Contacted',
    }

    const dynamicFields: Record<string, unknown> = {
      ...pickDynamicFields(dj),
      ...(input.utm?.source ? { UTM_Source__c: input.utm.source } : {}),
      ...(input.utm?.medium ? { UTM_Medium__c: input.utm.medium } : {}),
      ...(input.utm?.campaign ? { UTM_Campaign__c: input.utm.campaign } : {}),
      ...(input.utm?.content ? { UTM_Content__c: input.utm.content } : {}),
      ...(input.utm?.term ? { UTM_Term__c: input.utm.term } : {}),
      ...(typeof input.completionPct === 'number' ? { Completion_Percentage__c: String(input.completionPct) } : {}),
    }

    return { externalLeadId: input.externalLeadId, mandatoryFields, dynamicFields }
  },

  async submitForm(payload: SalesforceBackendSubmitPayload): Promise<SalesforceBackendSubmitSuccess> {
    const url = process.env.SALESFORCE_BACKEND_SUBMIT_URL ?? 'https://salesforce-backend-pkwm.onrender.com/submitForm'
    const origin = process.env.SALESFORCE_BACKEND_ORIGIN ?? process.env.NEXTJS_URL ?? 'http://localhost:3000'

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
      },
      body: JSON.stringify(payload),
    })

    const contentType = res.headers.get('content-type') ?? ''
    const body = contentType.includes('application/json') ? await res.json() : await res.text()

    if (!res.ok) {
      const err = new Error(`Salesforce backend submit failed (${res.status})`)
      ;(err as any).details = body
      throw err
    }

    return body as SalesforceBackendSubmitSuccess
  },
}

