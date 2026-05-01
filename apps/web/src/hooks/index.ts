import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Leads ──────────────────────────────────────────────────────────────────────
export function useLeads(params?: Record<string, string>) {
  return useQuery<any>({
    queryKey: ["leads", params],
    queryFn: () => api.getLeads(params),
    // Leads don't need aggressive polling; it hurts perceived performance.
    // Keep cached data for a bit and refetch only on explicit user action.
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (prev: any) => prev,
  });
}
export function useLead(id: string) {
  return useQuery<any>({
    queryKey: ["lead", id],
    queryFn: () => api.getLead(id),
    enabled: !!id,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
export function useLeadStats() {
  return useQuery<any>({
    queryKey: ["lead-stats"],
    queryFn: () => api.getLeadStats(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string;
      status: string;
      note?: string;
    }) => api.updateStatus(id, { status, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-stats"] });
    },
  });
}

// ── Forms ──────────────────────────────────────────────────────────────────────
export function useForms(
  params?: Record<string, string>,
  opts?: { enabled?: boolean },
) {
  return useQuery<any>({
    queryKey: ["forms", params],
    queryFn: () => api.getForms(params),
    enabled: opts?.enabled ?? true,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
export function useForm(id: string) {
  return useQuery<any>({
    queryKey: ["form", id],
    queryFn: () => api.getForm(id),
    enabled: !!id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}
export function usePublicForm(slug: string) {
  return useQuery<any>({
    queryKey: ["public-form", slug],
    queryFn: () => api.getPublicForm(slug),
    enabled: !!slug,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
export function useCreateForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createForm,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forms"] }),
  });
}
export function usePublishForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.publishForm(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forms"] }),
  });
}
export function useUpdateForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.updateForm(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forms"] }),
  });
}

// ── Departments ────────────────────────────────────────────────────────────────
export function useDepartments() {
  return useQuery<any>({
    queryKey: ["departments"],
    queryFn: () => api.getDepartments(),
    staleTime: 30 * 60_000,
    gcTime: 2 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createDepartment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}

// ── Outreach ───────────────────────────────────────────────────────────────────
export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.sendEmail,
    onSuccess: (_, v: any) =>
      qc.invalidateQueries({ queryKey: ["lead", v.leadId] }),
  });
}
export function useSendSMS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.sendSMS,
    onSuccess: (_, v: any) =>
      qc.invalidateQueries({ queryKey: ["lead", v.leadId] }),
  });
}
export function useLogCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logCall,
    onSuccess: (_, v: any) =>
      qc.invalidateQueries({ queryKey: ["lead", v.leadId] }),
  });
}
