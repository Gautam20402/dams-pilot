import { z } from 'zod'

export const PartialSaveSchema = z.object({
  sessionId:      z.string().min(1),
  formId:         z.string().optional(),
  departmentId:   z.string().min(1),
  dataJson:       z.record(z.unknown()).default({}),
  gaClientId:     z.string().optional(),
  utmSource:      z.string().optional(),
  utmMedium:      z.string().optional(),
  utmCampaign:    z.string().optional(),
  utmContent:     z.string().optional(),
  utmTerm:        z.string().optional(),
  lastActivePage: z.number().int().min(0).default(0),
  fieldsFilled:   z.number().int().min(0).default(0),
  completionPct:  z.number().int().min(0).max(100).default(0),
  source:         z.enum(['ga_poll','partial_save','direct','referral']).default('partial_save'),
})

export const UpdateLeadStatusSchema = z.object({
  status: z.enum(['new','partial','contacted','in_progress','submitted','dropped','converted']),
  note:   z.string().optional(),
})

export const LeadFiltersSchema = z.object({
  status:       z.enum(['new','partial','contacted','in_progress','submitted','dropped','converted']).optional(),
  source:       z.enum(['ga_poll','partial_save','direct','referral']).optional(),
  departmentId: z.string().optional(),
  search:       z.string().optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
  sortBy:       z.enum(['createdAt','updatedAt','completionPct','firstName']).default('createdAt'),
  sortDir:      z.enum(['asc','desc']).default('desc'),
})

export const CreateFormSchema = z.object({
  name:         z.string().min(1).max(200),
  departmentId: z.string().min(1),
  schemaJson:   z.record(z.unknown()),
})

export const UpdateFormSchema = z.object({
  name:       z.string().min(1).max(200).optional(),
  schemaJson: z.record(z.unknown()).optional(),
  status:     z.enum(['draft','active','archived']).optional(),
})

export const SendEmailSchema = z.object({
  to:      z.string().email(),
  subject: z.string().min(1).max(500),
  body:    z.string().min(1),
  leadId:  z.string().min(1),
})

export const SendSMSSchema = z.object({
  to:     z.string().min(10),
  body:   z.string().min(1).max(1600),
  leadId: z.string().min(1),
})

export const LogCallSchema = z.object({
  leadId:   z.string().min(1),
  note:     z.string().optional(),
  duration: z.number().int().min(0).optional(),
  outcome:  z.string().optional(),
})

const SalesforceFieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])

export const SalesforceLeadSchema = z.object({
  leadId: z.string().min(1).optional(),
  mandatoryFields: z.object({
    lastName:   z.string().min(1),
    company:    z.string().min(1).default('Applicant'),
    firstName:  z.string().optional(),
    email:      z.string().email().optional(),
    phone:      z.string().optional(),
    leadSource: z.string().optional(),
    status:     z.string().optional(),
  }),
  dynamicFields: z.record(
    z.string().regex(/^[A-Za-z][A-Za-z0-9_]*(__c)?$/, 'Use Salesforce field API names only'),
    SalesforceFieldValueSchema,
  ).default({}),
})

export const SyncUserSchema = z.object({
  clerkId:      z.string().min(1),
  email:        z.string().email(),
  firstName:    z.string(),
  lastName:     z.string(),
  departmentId: z.string().optional(),
  role:         z.enum(['SUPER_ADMIN','DEPT_ADMIN','BUILDER','CALLER']).optional(),
})

export type PartialSaveInput      = z.infer<typeof PartialSaveSchema>
export type UpdateLeadStatusInput = z.infer<typeof UpdateLeadStatusSchema>
export type LeadFiltersInput      = z.infer<typeof LeadFiltersSchema>
export type CreateFormInput       = z.infer<typeof CreateFormSchema>
export type SendEmailInput        = z.infer<typeof SendEmailSchema>
export type SendSMSInput          = z.infer<typeof SendSMSSchema>
export type LogCallInput          = z.infer<typeof LogCallSchema>
export type SalesforceLeadInput   = z.infer<typeof SalesforceLeadSchema>
