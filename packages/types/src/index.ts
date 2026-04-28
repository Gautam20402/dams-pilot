export type LeadStatus   = 'new'|'partial'|'contacted'|'in_progress'|'submitted'|'dropped'|'converted'
export type LeadSource   = 'ga_poll'|'partial_save'|'direct'|'referral'
export type OutreachChannel = 'email'|'sms'|'call'
export type UserRole     = 'SUPER_ADMIN'|'DEPT_ADMIN'|'BUILDER'|'CALLER'
export type TeamRole     = 'BUILDER'|'CALLER'
export type FormStatus   = 'draft'|'active'|'archived'

export interface Lead {
  id: string; sessionId: string; formId?: string|null; departmentId: string
  status: LeadStatus; source: LeadSource
  firstName?: string|null; lastName?: string|null; email?: string|null; phone?: string|null
  dataJson: Record<string,unknown>
  gaClientId?: string|null; utmSource?: string|null; utmMedium?: string|null
  utmCampaign?: string|null; utmContent?: string|null; utmTerm?: string|null
  lastActivePage: number; fieldsFilled: number; completionPct: number
  sfLeadId?: string|null; submittedAt?: Date|null; droppedAt?: Date|null
  createdAt: Date; updatedAt: Date
}

export interface Form {
  id: string; name: string; slug: string; departmentId: string
  schemaJson: Record<string,unknown>; status: FormStatus
  publishedAt?: Date|null; version: number; createdAt: Date; updatedAt: Date
}

export interface Department {
  id: string; name: string; slug: string; description?: string|null
  createdAt: Date; updatedAt: Date
}

export interface ApiResponse<T> { data: T; success: true }
export interface ApiError      { error: string; code: string; success: false }

export const ROLE_PERMISSIONS: Record<UserRole,{
  canUpdateStatus: boolean; canSendOutreach: boolean
  canEditForms: boolean; canViewAllDepts: boolean; canManageTeams: boolean
}> = {
  SUPER_ADMIN: { canUpdateStatus:true,  canSendOutreach:true,  canEditForms:true,  canViewAllDepts:true,  canManageTeams:true  },
  DEPT_ADMIN:  { canUpdateStatus:true,  canSendOutreach:true,  canEditForms:true,  canViewAllDepts:false, canManageTeams:true  },
  BUILDER:     { canUpdateStatus:false, canSendOutreach:false, canEditForms:true,  canViewAllDepts:false, canManageTeams:false },
  CALLER:      { canUpdateStatus:true,  canSendOutreach:true,  canEditForms:false, canViewAllDepts:false, canManageTeams:false },
}
