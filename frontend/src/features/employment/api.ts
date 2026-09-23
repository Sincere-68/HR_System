import type {
  EmployeeMovementListItem,
  EmployeeMovementListQuery,
  EmploymentRecordListItem,
  EmploymentRecordListQuery,
  InternListItem,
  InternListQuery,
  LaborWorkerListItem,
  LaborWorkerListQuery,
  Paginated,
  PartTimeListItem,
  PartTimeListQuery,
  ConfirmProbationInput,
  ProbationApproverOption,
  ProbationActionResult,
  ProbationBatchActionResult,
  ProbationImportResult,
  ProbationListItem,
  StartProbationConfirmationsInput,
  StartProbationEvaluationsInput,
  RetirementListItem,
  RetirementListQuery,
  SubmitProbationConfirmationInput,
  TerminationListItem,
  TerminationListQuery,
  ProbationListQuery,
  TrialPostListItem,
  TrialPostListQuery,
  TransferProbationApprovalInput,
  UpdateProbationInput,
} from '@hr-demo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, apiRequest, tokenStorage } from '../../lib/api';

function toSearchParams(query: object) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params;
}

export const employmentKeys = {
  records: (query: EmploymentRecordListQuery) => ['employment', 'records', query] as const,
  interns: (query: InternListQuery) => ['employment', 'interns', query] as const,
  laborWorkers: (query: LaborWorkerListQuery) => ['employment', 'labor-workers', query] as const,
  partTime: (query: PartTimeListQuery) => ['employment', 'part-time', query] as const,
  probation: (query: ProbationListQuery) => ['employment', 'probation', query] as const,
  movements: (query: EmployeeMovementListQuery) => ['employment', 'movements', query] as const,
  trialPosts: (query: TrialPostListQuery) => ['employment', 'trial-posts', query] as const,
  retirements: (query: RetirementListQuery) => ['employment', 'retirements', query] as const,
  terminations: (query: TerminationListQuery) => ['employment', 'terminations', query] as const,
};

export function useEmploymentRecords(query: EmploymentRecordListQuery) {
  return useQuery({
    queryKey: employmentKeys.records(query),
    queryFn: () => apiRequest<Paginated<EmploymentRecordListItem>>(
      `/employment/records?${toSearchParams(query)}`,
    ),
  });
}

export function useInterns(query: InternListQuery) {
  return useQuery({
    queryKey: employmentKeys.interns(query),
    queryFn: () => apiRequest<Paginated<InternListItem>>(
      `/employment/interns?${toSearchParams(query)}`,
    ),
  });
}

export function useLaborWorkers(query: LaborWorkerListQuery) {
  return useQuery({
    queryKey: employmentKeys.laborWorkers(query),
    queryFn: () => apiRequest<Paginated<LaborWorkerListItem>>(
      `/employment/labor-workers?${toSearchParams(query)}`,
    ),
  });
}

export function usePartTimeAssignments(query: PartTimeListQuery) {
  return useQuery({
    queryKey: employmentKeys.partTime(query),
    queryFn: () => apiRequest<Paginated<PartTimeListItem>>(
      `/employment/part-time?${toSearchParams(query)}`,
    ),
  });
}

export function useProbation(query: ProbationListQuery) {
  return useQuery({
    queryKey: employmentKeys.probation(query),
    queryFn: () => apiRequest<Paginated<ProbationListItem>>(`/employment/probation?${toSearchParams(query)}`),
  });
}

export function useProbationApprovers(enabled = true) {
  return useQuery({
    queryKey: ['employment', 'probation', 'approvers'],
    queryFn: () => apiRequest<ProbationApproverOption[]>('/employment/probation/approvers'),
    enabled,
  });
}

function filenameFromDisposition(value: string | null, fallback: string) {
  const encoded = value?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  const plain = value?.match(/filename="?([^";]+)"?/i)?.[1];
  return plain ?? fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importErrorMessage(body: unknown, fallback: string) {
  const message = typeof body === 'object' && body !== null
    ? (body as { message?: unknown }).message
    : undefined;
  return Array.isArray(message) ? message[0] : typeof message === 'string' ? message : fallback;
}

export async function importProbationFile(file: File) {
  const token = tokenStorage.get();
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/employment/probation/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) {
    throw new Error(importErrorMessage(await response.json().catch(() => null), `导入失败 (${response.status})`));
  }
  return response.json() as Promise<ProbationImportResult>;
}

export async function downloadProbationImportTemplate(format: 'XLSX' | 'CSV') {
  const token = tokenStorage.get();
  const response = await fetch(`${API_BASE_URL}/employment/probation/import-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ format }),
  });
  if (!response.ok) {
    throw new Error(importErrorMessage(await response.json().catch(() => null), `下载模板失败 (${response.status})`));
  }
  downloadBlob(
    await response.blob(),
    filenameFromDisposition(response.headers.get('Content-Disposition'), `试用管理导入模板.${format.toLowerCase()}`),
  );
}

function useInvalidateProbation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['employment', 'probation'] });
}

export function useUpdateProbation() {
  const invalidateProbation = useInvalidateProbation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProbationInput }) =>
      apiRequest<ProbationActionResult>(`/employment/probation/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidateProbation,
  });
}

export function useStartProbationEvaluation() {
  const invalidateProbation = useInvalidateProbation();
  return useMutation({
    mutationFn: (id: string) => apiRequest<ProbationActionResult>(
      `/employment/probation/${id}/evaluation`,
      { method: 'POST' },
    ),
    onSuccess: invalidateProbation,
  });
}

export function useStartProbationEvaluations() {
  const invalidateProbation = useInvalidateProbation();
  return useMutation({
    mutationFn: (input: StartProbationEvaluationsInput) => apiRequest<ProbationBatchActionResult>(
      '/employment/probation/evaluations',
      { method: 'POST', body: JSON.stringify(input) },
    ),
    onSuccess: invalidateProbation,
  });
}

export function useStartProbationConfirmations() {
  const invalidateProbation = useInvalidateProbation();
  return useMutation({
    mutationFn: (input: StartProbationConfirmationsInput) => apiRequest<ProbationBatchActionResult>(
      '/employment/probation/confirmations',
      { method: 'POST', body: JSON.stringify(input) },
    ),
    onSuccess: invalidateProbation,
  });
}

export function useSubmitProbationConfirmation() {
  const invalidateProbation = useInvalidateProbation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SubmitProbationConfirmationInput }) =>
      apiRequest<ProbationActionResult>(`/employment/probation/${id}/submit-confirmation`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidateProbation,
  });
}

export function useConfirmProbation() {
  const invalidateProbation = useInvalidateProbation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfirmProbationInput }) =>
      apiRequest<ProbationActionResult>(`/employment/probation/${id}/confirm`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidateProbation,
  });
}

export function useApproveProbation() {
  const invalidateProbation = useInvalidateProbation();
  return useMutation({
    mutationFn: (id: string) => apiRequest<ProbationActionResult>(
      `/employment/probation/${id}/approval/approve`,
      { method: 'POST' },
    ),
    onSuccess: invalidateProbation,
  });
}

export function useReturnProbationToEvaluation() {
  const invalidateProbation = useInvalidateProbation();
  return useMutation({
    mutationFn: (id: string) => apiRequest<ProbationActionResult>(
      `/employment/probation/${id}/return-to-evaluation`,
      { method: 'POST' },
    ),
    onSuccess: invalidateProbation,
  });
}

export function useRemindProbationApproval() {
  const invalidateProbation = useInvalidateProbation();
  return useMutation({
    mutationFn: (id: string) => apiRequest<ProbationActionResult>(
      `/employment/probation/${id}/approval/reminders`,
      { method: 'POST' },
    ),
    onSuccess: invalidateProbation,
  });
}

export function useTransferProbationApproval() {
  const invalidateProbation = useInvalidateProbation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransferProbationApprovalInput }) =>
      apiRequest<ProbationActionResult>(`/employment/probation/${id}/approval/transfer`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidateProbation,
  });
}

export function useEmployeeMovements(query: EmployeeMovementListQuery) {
  return useQuery({
    queryKey: employmentKeys.movements(query),
    queryFn: () => apiRequest<Paginated<EmployeeMovementListItem>>(
      `/employment/movements?${toSearchParams(query)}`,
    ),
  });
}

export function useTrialPosts(query: TrialPostListQuery) {
  return useQuery({
    queryKey: employmentKeys.trialPosts(query),
    queryFn: () => apiRequest<Paginated<TrialPostListItem>>(
      `/employment/trial-posts?${toSearchParams(query)}`,
    ),
  });
}

export function useTerminations(query: TerminationListQuery) {
  return useQuery({
    queryKey: employmentKeys.terminations(query),
    queryFn: () => apiRequest<Paginated<TerminationListItem>>(
      `/employment/terminations?${toSearchParams(query)}`,
    ),
  });
}

export function useRetirements(query: RetirementListQuery) {
  return useQuery({
    queryKey: employmentKeys.retirements(query),
    queryFn: () => apiRequest<Paginated<RetirementListItem>>(
      `/employment/retirements?${toSearchParams(query)}`,
    ),
  });
}
