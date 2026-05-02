import axios from 'axios'
import { getToken } from '@/lib/auth'

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  r => r,
  err => Promise.reject(new Error(err.response?.data?.error ?? err.message))
)

export const api = {
  // Leads
  getLeads:      (p?: Record<string,string>) => apiClient.get('/api/leads', { params:p }).then(r=>r.data),
  getLead:       (id: string)                => apiClient.get(`/api/leads/${id}`).then(r=>r.data),
  getLeadStats:  ()                          => apiClient.get('/api/leads/stats/summary').then(r=>r.data),
  partialSave:   (d: unknown)                => apiClient.post('/api/leads/partial', d).then(r=>r.data),
  submitLead:    (leadId: string, sessionId: string) => apiClient.post('/api/leads/submit', { leadId, sessionId }).then(r=>r.data),
  dropOff:       (d: unknown)                => apiClient.post('/api/leads/drop-off', d).then(r=>r.data),
  updateStatus:  (id: string, d: unknown)    => apiClient.patch(`/api/leads/${id}/status`, d).then(r=>r.data),
  // Forms
  getForms:      (p?: Record<string,string>) => apiClient.get('/api/forms', { params:p }).then(r=>r.data),
  getForm:       (id: string)                => apiClient.get(`/api/forms/${id}`).then(r=>r.data),
  getPublicForm: (slug: string)              => apiClient.get(`/api/forms/public/${slug}`).then(r=>r.data),
  createForm:    (d: unknown)                => apiClient.post('/api/forms', d).then(r=>r.data),
  updateForm:    (id: string, d: unknown)    => apiClient.patch(`/api/forms/${id}`, d).then(r=>r.data),
  publishForm:   (id: string)                => apiClient.post(`/api/forms/${id}/publish`).then(r=>r.data),
  archiveForm:   (id: string)                => apiClient.post(`/api/forms/${id}/archive`).then(r=>r.data),
  deleteForm:    (id: string)                => apiClient.delete(`/api/forms/${id}`).then(r=>r.data),
  // Outreach
  sendEmail:     (d: unknown)                => apiClient.post('/api/outreach/email', d).then(r=>r.data),
  sendSMS:       (d: unknown)                => apiClient.post('/api/outreach/sms', d).then(r=>r.data),
  logCall:       (d: unknown)                => apiClient.post('/api/outreach/call', d).then(r=>r.data),
  getOutreach:   (leadId: string)            => apiClient.get(`/api/outreach/${leadId}`).then(r=>r.data),
  // Departments
  getDepartments:   ()           => apiClient.get('/api/departments').then(r=>r.data),
  createDepartment: (d: unknown) => apiClient.post('/api/departments', d).then(r=>r.data),
  // Auth
  getMe:         ()  => apiClient.get('/api/auth/me').then(r=>r.data),
}
