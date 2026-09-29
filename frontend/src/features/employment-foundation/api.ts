import type {
  ApprovalCommentInput,
  ApprovalFlowDefinition,
  CreateEmploymentApprovalFlowDefinitionInput,
  CreateEmploymentApprovalFlowVersionInput,
  CreateEmploymentConversionInput,
  CreatePartTimeRecordInput,
  EmploymentApprovalDetail,
  EmploymentApprovalFlowListQuery,
  EmploymentApprovalFlowOptions,
  EmploymentApprovalListItem,
  EmploymentApprovalListQuery,
  EmploymentConversionDetail,
  EmploymentConversionListItem,
  EmploymentConversionListQuery,
  EmploymentViewCountsQuery,
  EmploymentViewCountsResponse,
  EndPartTimeRecordInput,
  Paginated,
  PartTimeRecordItem,
  PartTimeRecordListQuery,
  RequiredApprovalCommentInput,
  UpdateEmploymentApprovalFlowDefinitionInput,
  UpdateEmploymentApprovalFlowVersionInput,
} from '@hr-demo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

function queryString(query: object) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const result = params.toString();
  return result ? `?${result}` : '';
}

type ApprovalActionResult = {
  id: string;
  status: string;
  employmentStatus: string;
};

export const employmentFoundationKeys = {
  flows: ['employment-foundation', 'flows'] as const,
  flowList: (query: EmploymentApprovalFlowListQuery) => [...employmentFoundationKeys.flows, 'list', query] as const,
  flowDetail: (id: string) => [...employmentFoundationKeys.flows, 'detail', id] as const,
  flowOptions: [...['employment-foundation', 'flows'], 'options'] as const,
  approvals: ['employment-foundation', 'approvals'] as const,
  approvalMine: (query: EmploymentApprovalListQuery) => [...employmentFoundationKeys.approvals, 'mine', query] as const,
  approvalCurrent: (query: EmploymentApprovalListQuery) => [...employmentFoundationKeys.approvals, 'current', query] as const,
  approvalDetail: (id: string) => [...employmentFoundationKeys.approvals, 'detail', id] as const,
  conversions: ['employment-foundation', 'conversions'] as const,
  conversionList: (query: EmploymentConversionListQuery) => [...employmentFoundationKeys.conversions, 'list', query] as const,
  conversionDetail: (id: string) => [...employmentFoundationKeys.conversions, 'detail', id] as const,
  partTime: ['employment-foundation', 'part-time-records'] as const,
  partTimeList: (query: PartTimeRecordListQuery) => [...employmentFoundationKeys.partTime, 'list', query] as const,
  partTimeDetail: (id: string) => [...employmentFoundationKeys.partTime, 'detail', id] as const,
  viewCounts: (query: EmploymentViewCountsQuery) => ['employment', 'view-counts', query] as const,
};

export const employmentFoundationApi = {
  listFlows: (query: EmploymentApprovalFlowListQuery) => apiRequest<Paginated<ApprovalFlowDefinition>>(
    `/employment-approval-flows${queryString(query)}`,
  ),
  getFlow: (id: string) => apiRequest<ApprovalFlowDefinition>(`/employment-approval-flows/${id}`),
  getFlowOptions: () => apiRequest<EmploymentApprovalFlowOptions>('/employment-approval-flows/options'),
  createFlow: (input: CreateEmploymentApprovalFlowDefinitionInput) => apiRequest<ApprovalFlowDefinition>(
    '/employment-approval-flows', { method: 'POST', body: JSON.stringify(input) },
  ),
  createFlowVersion: (id: string, input: CreateEmploymentApprovalFlowVersionInput) => apiRequest<ApprovalFlowDefinition>(
    `/employment-approval-flows/${id}/versions`, { method: 'POST', body: JSON.stringify(input) },
  ),
  updateFlow: (id: string, input: UpdateEmploymentApprovalFlowDefinitionInput) => apiRequest<ApprovalFlowDefinition>(
    `/employment-approval-flows/${id}`, { method: 'PATCH', body: JSON.stringify(input) },
  ),
  updateFlowVersion: (id: string, input: UpdateEmploymentApprovalFlowVersionInput) => apiRequest<ApprovalFlowDefinition>(
    `/employment-approval-flows/versions/${id}`, { method: 'PATCH', body: JSON.stringify(input) },
  ),
  publishFlowVersion: (id: string) => apiRequest<ApprovalFlowDefinition>(
    `/employment-approval-flows/versions/${id}/publish`, { method: 'POST' },
  ),
  archiveFlow: (id: string) => apiRequest<ApprovalFlowDefinition>(
    `/employment-approval-flows/${id}/archive`, { method: 'POST' },
  ),

  listMyApprovals: (query: EmploymentApprovalListQuery) => apiRequest<Paginated<EmploymentApprovalListItem>>(
    `/employment-approvals/my${queryString(query)}`,
  ),
  listCurrentApprovals: (query: EmploymentApprovalListQuery) => apiRequest<Paginated<EmploymentApprovalListItem>>(
    `/employment-approvals/current${queryString(query)}`,
  ),
  getApproval: (id: string) => apiRequest<EmploymentApprovalDetail>(`/employment-approvals/${id}`),
  approveApproval: (id: string, input: ApprovalCommentInput = {}) => apiRequest<ApprovalActionResult>(
    `/employment-approvals/${id}/approve`, { method: 'POST', body: JSON.stringify(input) },
  ),
  rejectApproval: (id: string, input: RequiredApprovalCommentInput) => apiRequest<ApprovalActionResult>(
    `/employment-approvals/${id}/reject`, { method: 'POST', body: JSON.stringify(input) },
  ),
  returnApproval: (id: string, input: RequiredApprovalCommentInput) => apiRequest<ApprovalActionResult>(
    `/employment-approvals/${id}/return`, { method: 'POST', body: JSON.stringify(input) },
  ),
  withdrawApproval: (id: string) => apiRequest<ApprovalActionResult>(
    `/employment-approvals/${id}/withdraw`, { method: 'POST' },
  ),

  listConversions: (query: EmploymentConversionListQuery) => apiRequest<Paginated<EmploymentConversionListItem>>(
    `/employment/conversions${queryString(query)}`,
  ),
  getConversion: (id: string) => apiRequest<EmploymentConversionDetail>(`/employment/conversions/${id}`),
  createConversion: (input: CreateEmploymentConversionInput) => apiRequest<EmploymentConversionListItem>(
    '/employment/conversions', { method: 'POST', body: JSON.stringify(input) },
  ),
  activateConversion: (id: string) => apiRequest<EmploymentConversionDetail>(
    `/employment/conversions/${id}/activate`, { method: 'POST' },
  ),

  listPartTimeRecords: (query: PartTimeRecordListQuery) => apiRequest<Paginated<PartTimeRecordItem>>(
    `/employment/part-time-records${queryString(query)}`,
  ),
  getPartTimeRecord: (id: string) => apiRequest<PartTimeRecordItem>(`/employment/part-time-records/${id}`),
  createPartTimeRecord: (input: CreatePartTimeRecordInput) => apiRequest<PartTimeRecordItem>(
    '/employment/part-time-records', { method: 'POST', body: JSON.stringify(input) },
  ),
  activatePartTimeRecord: (id: string) => apiRequest<PartTimeRecordItem>(
    `/employment/part-time-records/${id}/activate`, { method: 'POST' },
  ),
  endPartTimeRecord: (id: string, input: EndPartTimeRecordInput) => apiRequest<PartTimeRecordItem>(
    `/employment/part-time-records/${id}/end`, { method: 'POST', body: JSON.stringify(input) },
  ),

  getViewCounts: (query: EmploymentViewCountsQuery) => apiRequest<EmploymentViewCountsResponse>(
    `/employment/view-counts${queryString(query)}`,
  ),
  getInternPeriodDetail: (id: string) => apiRequest<unknown>(`/employment/interns/${id}`),
  getLaborPeriodDetail: (id: string) => apiRequest<unknown>(`/employment/labor-workers/${id}`),
};

function useInvalidate(keys: ReadonlyArray<readonly unknown[]>) {
  const queryClient = useQueryClient();
  return () => Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: key })));
}

export function useEmploymentApprovalFlows(query: EmploymentApprovalFlowListQuery) {
  return useQuery({ queryKey: employmentFoundationKeys.flowList(query), queryFn: () => employmentFoundationApi.listFlows(query) });
}
export function useEmploymentApprovalFlow(id: string, enabled = true) {
  return useQuery({ queryKey: employmentFoundationKeys.flowDetail(id), queryFn: () => employmentFoundationApi.getFlow(id), enabled: enabled && Boolean(id) });
}
export function useEmploymentApprovalFlowOptions(enabled = true) {
  return useQuery({ queryKey: employmentFoundationKeys.flowOptions, queryFn: employmentFoundationApi.getFlowOptions, enabled });
}

function flowMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<ApprovalFlowDefinition>) {
  const invalidate = useInvalidate([employmentFoundationKeys.flows]);
  return useMutation({ mutationFn, onSuccess: invalidate });
}
export function useCreateEmploymentApprovalFlow() { return flowMutation(employmentFoundationApi.createFlow); }
export function useCreateEmploymentApprovalFlowVersion() { return flowMutation(({ id, input }: { id: string; input: CreateEmploymentApprovalFlowVersionInput }) => employmentFoundationApi.createFlowVersion(id, input)); }
export function useUpdateEmploymentApprovalFlow() { return flowMutation(({ id, input }: { id: string; input: UpdateEmploymentApprovalFlowDefinitionInput }) => employmentFoundationApi.updateFlow(id, input)); }
export function useUpdateEmploymentApprovalFlowVersion() { return flowMutation(({ id, input }: { id: string; input: UpdateEmploymentApprovalFlowVersionInput }) => employmentFoundationApi.updateFlowVersion(id, input)); }
export function usePublishEmploymentApprovalFlowVersion() { return flowMutation(employmentFoundationApi.publishFlowVersion); }
export function useArchiveEmploymentApprovalFlow() { return flowMutation(employmentFoundationApi.archiveFlow); }

export function useMyEmploymentApprovals(query: EmploymentApprovalListQuery) {
  return useQuery({ queryKey: employmentFoundationKeys.approvalMine(query), queryFn: () => employmentFoundationApi.listMyApprovals(query) });
}
export function useCurrentEmploymentApprovals(query: EmploymentApprovalListQuery) {
  return useQuery({ queryKey: employmentFoundationKeys.approvalCurrent(query), queryFn: () => employmentFoundationApi.listCurrentApprovals(query) });
}
export function useEmploymentApprovalDetail(id: string, enabled = true) {
  return useQuery({ queryKey: employmentFoundationKeys.approvalDetail(id), queryFn: () => employmentFoundationApi.getApproval(id), enabled: enabled && Boolean(id) });
}
function approvalMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<ApprovalActionResult>) {
  const invalidate = useInvalidate([employmentFoundationKeys.approvals, employmentFoundationKeys.conversions, employmentFoundationKeys.partTime, ['employment', 'view-counts']]);
  return useMutation({ mutationFn, onSuccess: invalidate });
}
export function useApproveEmploymentApproval() { return approvalMutation(({ id, input }: { id: string; input?: ApprovalCommentInput }) => employmentFoundationApi.approveApproval(id, input)); }
export function useRejectEmploymentApproval() { return approvalMutation(({ id, input }: { id: string; input: RequiredApprovalCommentInput }) => employmentFoundationApi.rejectApproval(id, input)); }
export function useReturnEmploymentApproval() { return approvalMutation(({ id, input }: { id: string; input: RequiredApprovalCommentInput }) => employmentFoundationApi.returnApproval(id, input)); }
export function useWithdrawEmploymentApproval() { return approvalMutation(employmentFoundationApi.withdrawApproval); }

export function useEmploymentConversions(query: EmploymentConversionListQuery) {
  return useQuery({ queryKey: employmentFoundationKeys.conversionList(query), queryFn: () => employmentFoundationApi.listConversions(query) });
}
export function useEmploymentConversion(id: string, enabled = true) {
  return useQuery({ queryKey: employmentFoundationKeys.conversionDetail(id), queryFn: () => employmentFoundationApi.getConversion(id), enabled: enabled && Boolean(id) });
}
function conversionMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const invalidate = useInvalidate([employmentFoundationKeys.conversions, ['employment', 'interns'], ['employment', 'labor-workers'], ['employment', 'records'], ['employment', 'view-counts']]);
  return useMutation({ mutationFn, onSuccess: invalidate });
}
export function useCreateEmploymentConversion() { return conversionMutation(employmentFoundationApi.createConversion); }
export function useActivateEmploymentConversion() { return conversionMutation(employmentFoundationApi.activateConversion); }

export function usePartTimeRecords(query: PartTimeRecordListQuery) {
  return useQuery({ queryKey: employmentFoundationKeys.partTimeList(query), queryFn: () => employmentFoundationApi.listPartTimeRecords(query) });
}
export function usePartTimeRecord(id: string, enabled = true) {
  return useQuery({ queryKey: employmentFoundationKeys.partTimeDetail(id), queryFn: () => employmentFoundationApi.getPartTimeRecord(id), enabled: enabled && Boolean(id) });
}
function partTimeMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const invalidate = useInvalidate([employmentFoundationKeys.partTime, ['employment', 'view-counts']]);
  return useMutation({ mutationFn, onSuccess: invalidate });
}
export function useCreatePartTimeRecord() { return partTimeMutation(employmentFoundationApi.createPartTimeRecord); }
export function useActivatePartTimeRecord() { return partTimeMutation(employmentFoundationApi.activatePartTimeRecord); }
export function useEndPartTimeRecord() { return partTimeMutation(({ id, input }: { id: string; input: EndPartTimeRecordInput }) => employmentFoundationApi.endPartTimeRecord(id, input)); }

export function useEmploymentViewCounts(query: EmploymentViewCountsQuery) {
  return useQuery({ queryKey: employmentFoundationKeys.viewCounts(query), queryFn: () => employmentFoundationApi.getViewCounts(query) });
}
export function useInternPeriodDetail(id: string, enabled = true) {
  return useQuery({ queryKey: ['employment', 'interns', 'detail', id], queryFn: () => employmentFoundationApi.getInternPeriodDetail(id), enabled: enabled && Boolean(id) });
}
export function useLaborPeriodDetail(id: string, enabled = true) {
  return useQuery({ queryKey: ['employment', 'labor-workers', 'detail', id], queryFn: () => employmentFoundationApi.getLaborPeriodDetail(id), enabled: enabled && Boolean(id) });
}
