import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ── Leads ──────────────────────────────────────────────────────────────────────
export function useLeads(params?: Record<string,string>) {
  return useQuery({ queryKey:['leads',params], queryFn:()=>api.getLeads(params), staleTime: 0, refetchInterval: 10_000, refetchOnWindowFocus: true })
}
export function useLead(id: string) {
  return useQuery({ queryKey:['lead',id], queryFn:()=>api.getLead(id), enabled:!!id })
}
export function useLeadStats() {
  return useQuery({ queryKey:['lead-stats'], queryFn:()=>api.getLeadStats(), staleTime:0, refetchInterval:10_000, refetchOnWindowFocus:true })
}
export function useUpdateLeadStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({id,status,note}:{id:string;status:string;note?:string}) => api.updateStatus(id,{status,note}),
    onSuccess: () => { qc.invalidateQueries({queryKey:['leads']}); qc.invalidateQueries({queryKey:['lead-stats']}) },
  })
}

// ── Forms ──────────────────────────────────────────────────────────────────────
export function useForms(params?: Record<string,string>) {
  return useQuery({ queryKey:['forms',params], queryFn:()=>api.getForms(params) })
}
export function useForm(id: string) {
  return useQuery({ queryKey:['form',id], queryFn:()=>api.getForm(id), enabled:!!id })
}
export function usePublicForm(slug: string) {
  return useQuery({ queryKey:['public-form',slug], queryFn:()=>api.getPublicForm(slug), enabled:!!slug })
}
export function useCreateForm() {
  const qc = useQueryClient()
  return useMutation({ mutationFn:api.createForm, onSuccess:()=>qc.invalidateQueries({queryKey:['forms']}) })
}
export function usePublishForm() {
  const qc = useQueryClient()
  return useMutation({ mutationFn:(id:string)=>api.publishForm(id), onSuccess:()=>qc.invalidateQueries({queryKey:['forms']}) })
}
export function useUpdateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({id,data}:{id:string;data:unknown}) => api.updateForm(id,data),
    onSuccess:  ()=>qc.invalidateQueries({queryKey:['forms']}),
  })
}

// ── Departments ────────────────────────────────────────────────────────────────
export function useDepartments() {
  return useQuery({ queryKey:['departments'], queryFn:()=>api.getDepartments() })
}

// ── Outreach ───────────────────────────────────────────────────────────────────
export function useSendEmail() {
  const qc = useQueryClient()
  return useMutation({ mutationFn:api.sendEmail, onSuccess:(_,v:any)=>qc.invalidateQueries({queryKey:['lead',v.leadId]}) })
}
export function useSendSMS() {
  const qc = useQueryClient()
  return useMutation({ mutationFn:api.sendSMS, onSuccess:(_,v:any)=>qc.invalidateQueries({queryKey:['lead',v.leadId]}) })
}
export function useLogCall() {
  const qc = useQueryClient()
  return useMutation({ mutationFn:api.logCall, onSuccess:(_,v:any)=>qc.invalidateQueries({queryKey:['lead',v.leadId]}) })
}
