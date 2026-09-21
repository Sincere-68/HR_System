import type {
  Paginated,
  EmployeePerformanceAmountBase,
  EmployeePerformanceAmountBaseInput,
  PerformanceAddCycleParticipantsInput,
  PerformanceCreateTemplateInput,
  PerformanceCycleDetail,
  PerformanceCycleListItem,
  PerformanceParticipantAssessmentDetail,
  PerformanceParticipantWorkflowDetail,
  PerformanceCreateEmployeePerformanceAmountBaseInput,
  PerformanceDashboardSummary,
  PerformanceOptions,
  PerformanceResultDetail,
  PerformanceResultListItem,
  PerformanceResultModificationInput,
  PerformanceTaskDetail,
  PerformanceTaskListItem,
  PerformanceTaskSubmissionInput,
  PerformanceWorkflowTaskListItem,
  PerformanceWorkflowTaskSubmissionInput,
  PerformanceArchiveCycleInput,
  PerformanceArchiveTemplateInput,
  PerformanceTemplateCopyResult,
  PerformanceTemplateDetail,
  PerformanceTemplateListItem,
  PerformanceTemplateParseResult,
} from '@hr-demo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, feishuTaskRequest } from '../../lib/api';

function params(query: Record<string, unknown>) {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  return search.toString();
}

export const performanceKeys = {
  all: ['performance'] as const,
  dashboard: ['performance', 'dashboard'] as const,
  templates: ['performance', 'templates'] as const,
  template: (id: string) => ['performance', 'template', id] as const,
  cycle: (id: string) => ['performance', 'cycle', id] as const,
  participantWorkflow: (cycleId: string, instanceId: string) => ['performance', 'participant-workflow', cycleId, instanceId] as const,
  participantAssessmentDetail: (cycleId: string, instanceId: string) => ['performance', 'participant-assessment-detail', cycleId, instanceId] as const,
  options: ['performance', 'options'] as const,
  tasks: (mine: boolean, query: Record<string, unknown>) => ['performance', 'tasks', mine, query] as const,
  task: (id: string) => ['performance', 'task', id] as const,
  workflowTasks: (mine: boolean, query: Record<string, unknown>) => ['performance', 'workflow-tasks', mine, query] as const,
  results: (query: Record<string, unknown>) => ['performance', 'results', query] as const,
  result: (id: string) => ['performance', 'result', id] as const,
  employeeAmountBases: (query: Record<string, unknown>) => ['performance', 'employee-amount-bases', query] as const,
  employeeAmountBaseHistory: (employeeId: string) => ['performance', 'employee-amount-base-history', employeeId] as const,
};

export const performanceApi = {
  dashboard: () => apiRequest<PerformanceDashboardSummary>('/performance/dashboard'),
  listTemplates: () => apiRequest<PerformanceTemplateListItem[]>('/performance/templates'),
  getTemplate: (id: string) => apiRequest<PerformanceTemplateDetail>(`/performance/templates/${id}`),
  parseTemplate: (sourceMarkdown: string, sourceName?: string) => apiRequest<PerformanceTemplateParseResult>('/performance/templates/parse', { method: 'POST', body: JSON.stringify({ sourceMarkdown, sourceName }) }),
  createTemplate: (input: PerformanceCreateTemplateInput) => apiRequest<PerformanceTemplateDetail>('/performance/templates', { method: 'POST', body: JSON.stringify(input) }),
  copyTemplate: (id: string) => apiRequest<PerformanceTemplateCopyResult>(`/performance/templates/${id}/copy`, { method: 'POST' }),
  archiveTemplate: (id: string, input: PerformanceArchiveTemplateInput = {}) => apiRequest<PerformanceTemplateListItem>(`/performance/templates/${id}/archive`, { method: 'POST', body: JSON.stringify(input) }),
  createTemplateVersion: (id: string, input: PerformanceCreateTemplateInput) => apiRequest<PerformanceTemplateDetail>(`/performance/templates/${id}/versions`, { method: 'POST', body: JSON.stringify(input) }),
  exchangeFeishuTaskSession: (state: string, code: string) => apiRequest<import('@hr-demo/shared').PerformanceFeishuTaskSessionExchangeResult>('/performance/feishu-task-inbox/session', { method: 'POST', body: JSON.stringify({ state, code }) }),
  feishuTaskInbox: () => feishuTaskRequest<import('@hr-demo/shared').PerformanceFeishuTaskInbox>('/performance/feishu-task-inbox'),
  submitFeishuAssessmentTask: (id: string, input: PerformanceTaskSubmissionInput) => feishuTaskRequest<import('@hr-demo/shared').PerformanceFeishuTaskInbox>(`/performance/feishu-task-inbox/assessment-tasks/${id}/submit`, { method: 'POST', body: JSON.stringify(input) }),
  submitFeishuWorkflowTask: (id: string, input: PerformanceWorkflowTaskSubmissionInput) => feishuTaskRequest<import('@hr-demo/shared').PerformanceFeishuTaskInbox>(`/performance/feishu-task-inbox/workflow-tasks/${id}/submit`, { method: 'POST', body: JSON.stringify(input) }),
  publishTemplateVersion: (id: string, versionId: string) => apiRequest(`/performance/templates/${id}/versions/${versionId}/publish`, { method: 'POST' }),
  listCycles: (query: Record<string, unknown>) => apiRequest<Paginated<PerformanceCycleListItem>>(`/performance/cycles?${params(query)}`),
  getCycle: (id: string) => apiRequest<PerformanceCycleDetail>(`/performance/cycles/${id}`),
  getParticipantWorkflow: (cycleId: string, instanceId: string) => apiRequest<PerformanceParticipantWorkflowDetail>(`/performance/cycles/${cycleId}/participants/${instanceId}/workflow`),
  getParticipantAssessmentDetail: (cycleId: string, instanceId: string) => apiRequest<PerformanceParticipantAssessmentDetail>(`/performance/cycles/${cycleId}/participants/${instanceId}/assessment-detail`),
  createCycle: (input: import('@hr-demo/shared').PerformanceCreateCycleInput) => apiRequest('/performance/cycles', { method: 'POST', body: JSON.stringify(input) }),
  startCycle: (id: string) => apiRequest(`/performance/cycles/${id}/start`, { method: 'POST' }),
  restartCycle: (id: string, employeeIds: string[]) => apiRequest(`/performance/cycles/${id}/restart`, { method: 'POST', body: JSON.stringify({ employeeIds }) }),
  closeCycleParticipants: (id: string, employeeIds: string[]) => apiRequest(`/performance/cycles/${id}/close-participants`, { method: 'POST', body: JSON.stringify({ employeeIds }) }),
  archiveCycle: (id: string, input: PerformanceArchiveCycleInput = {}) => apiRequest<PerformanceCycleListItem>(`/performance/cycles/${id}/archive`, { method: 'POST', body: JSON.stringify(input) }),
  addCycleParticipants: ({ id, input }: { id: string; input: PerformanceAddCycleParticipantsInput }) => apiRequest<PerformanceCycleDetail>(`/performance/cycles/${id}/participants`, { method: 'POST', body: JSON.stringify(input) }),
  updateCycleParticipantTemplate: ({ cycleId, employeeId, input }: { cycleId: string; employeeId: string; input: import('@hr-demo/shared').PerformanceUpdateCycleParticipantTemplateInput }) => apiRequest<PerformanceCycleDetail>(`/performance/cycles/${cycleId}/participants/${employeeId}/template`, { method: 'PATCH', body: JSON.stringify(input) }),
  options: () => apiRequest<PerformanceOptions>('/performance/options'),
  listTasks: (query: Record<string, unknown>) => apiRequest<Paginated<PerformanceTaskListItem>>(`/performance/tasks?${params(query)}`),
  listMyTasks: (query: Record<string, unknown>) => apiRequest<Paginated<PerformanceTaskListItem>>(`/performance/my-tasks?${params(query)}`),
  getTask: (id: string) => apiRequest<PerformanceTaskDetail>(`/performance/tasks/${id}`),
  submitTask: (id: string, input: PerformanceTaskSubmissionInput) => apiRequest<PerformanceTaskDetail>(`/performance/tasks/${id}/submit`, { method: 'POST', body: JSON.stringify(input) }),
  listWorkflowTasks: (query: Record<string, unknown>) => apiRequest<Paginated<PerformanceWorkflowTaskListItem>>(`/performance/workflow-tasks?${params(query)}`),
  listMyWorkflowTasks: (query: Record<string, unknown>) => apiRequest<Paginated<PerformanceWorkflowTaskListItem>>(`/performance/my-workflow-tasks?${params(query)}`),
  submitWorkflowTask: (id: string, input: PerformanceWorkflowTaskSubmissionInput) => apiRequest(`/performance/workflow-tasks/${id}/submit`, { method: 'POST', body: JSON.stringify(input) }),
  listResults: (query: Record<string, unknown>) => apiRequest<Paginated<PerformanceResultListItem>>(`/performance/results?${params(query)}`),
  getResult: (id: string) => apiRequest<PerformanceResultDetail>(`/performance/results/${id}`),
  modifyResult: (id: string, input: PerformanceResultModificationInput) => apiRequest<PerformanceResultDetail>(`/performance/results/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  listEmployeeAmountBases: (query: Record<string, unknown>) => apiRequest<Paginated<EmployeePerformanceAmountBase>>(`/performance/settings/employee-amount-bases?${params(query)}`),
  listEmployeeAmountBaseHistory: (employeeId: string) => apiRequest<EmployeePerformanceAmountBase[]>(`/performance/settings/employee-amount-bases/${employeeId}/history`),
  createEmployeeAmountBase: (input: EmployeePerformanceAmountBaseInput) => apiRequest<EmployeePerformanceAmountBase>('/performance/settings/employee-amount-bases', { method: 'POST', body: JSON.stringify(input) }),
};

export function useFeishuTaskInbox(enabled = true) { return useQuery({ queryKey: ['performance', 'feishu-task-inbox'], queryFn: performanceApi.feishuTaskInbox, enabled }); }
export function useSubmitFeishuAssessmentTask() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: PerformanceTaskSubmissionInput }) => performanceApi.submitFeishuAssessmentTask(id, input), onSuccess: () => client.invalidateQueries({ queryKey: ['performance', 'feishu-task-inbox'] }) }); }
export function useSubmitFeishuWorkflowTask() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: PerformanceWorkflowTaskSubmissionInput }) => performanceApi.submitFeishuWorkflowTask(id, input), onSuccess: () => client.invalidateQueries({ queryKey: ['performance', 'feishu-task-inbox'] }) }); }
export function usePerformanceDashboard() { return useQuery({ queryKey: performanceKeys.dashboard, queryFn: performanceApi.dashboard }); }
export function usePerformanceTemplates() { return useQuery({ queryKey: performanceKeys.templates, queryFn: performanceApi.listTemplates }); }
export function usePerformanceTemplate(id: string) { return useQuery({ queryKey: performanceKeys.template(id), queryFn: () => performanceApi.getTemplate(id), enabled: Boolean(id) }); }
export function usePerformanceOptions(enabled = true) { return useQuery({ queryKey: performanceKeys.options, queryFn: performanceApi.options, enabled }); }
export function usePerformanceCycles(query: Record<string, unknown> = {}) { return useQuery({ queryKey: ['performance', 'cycles', query], queryFn: () => performanceApi.listCycles(query) }); }
export function usePerformanceCycle(id: string) { return useQuery({ queryKey: performanceKeys.cycle(id), queryFn: () => performanceApi.getCycle(id), enabled: Boolean(id) }); }
export function usePerformanceParticipantWorkflow(cycleId: string, instanceId: string, enabled = true) { return useQuery({ queryKey: performanceKeys.participantWorkflow(cycleId, instanceId), queryFn: () => performanceApi.getParticipantWorkflow(cycleId, instanceId), enabled: Boolean(cycleId && instanceId && enabled) }); }
export function usePerformanceParticipantAssessmentDetail(cycleId: string, instanceId: string, enabled = true) { return useQuery({ queryKey: performanceKeys.participantAssessmentDetail(cycleId, instanceId), queryFn: () => performanceApi.getParticipantAssessmentDetail(cycleId, instanceId), enabled: Boolean(cycleId && instanceId && enabled) }); }
export function useCreatePerformanceCycle() { const client = useQueryClient(); return useMutation({ mutationFn: performanceApi.createCycle, onSuccess: () => client.invalidateQueries({ queryKey: performanceKeys.all }) }); }
export function useStartPerformanceCycle() { const client = useQueryClient(); return useMutation({ mutationFn: performanceApi.startCycle, onSuccess: () => client.invalidateQueries({ queryKey: performanceKeys.all }) }); }
export function useRestartPerformanceCycle() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, employeeIds }: { id: string; employeeIds: string[] }) => performanceApi.restartCycle(id, employeeIds), onSuccess: (_, variables) => { client.invalidateQueries({ queryKey: performanceKeys.all }); client.invalidateQueries({ queryKey: performanceKeys.cycle(variables.id) }); } }); }
export function useCloseCycleParticipants() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, employeeIds }: { id: string; employeeIds: string[] }) => performanceApi.closeCycleParticipants(id, employeeIds), onSuccess: (_, variables) => { client.invalidateQueries({ queryKey: performanceKeys.all }); client.invalidateQueries({ queryKey: performanceKeys.cycle(variables.id) }); } }); }
export function useArchivePerformanceCycle() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id: string; input?: PerformanceArchiveCycleInput }) => performanceApi.archiveCycle(id, input), onSuccess: () => client.invalidateQueries({ queryKey: performanceKeys.all }) }); }
export function useAddPerformanceCycleParticipants() { const client = useQueryClient(); return useMutation({ mutationFn: performanceApi.addCycleParticipants, onSuccess: (_, variables) => { client.invalidateQueries({ queryKey: performanceKeys.all }); client.invalidateQueries({ queryKey: performanceKeys.cycle(variables.id) }); } }); }
export function useUpdatePerformanceCycleParticipantTemplate() { const client = useQueryClient(); return useMutation({ mutationFn: performanceApi.updateCycleParticipantTemplate, onSuccess: (_, variables) => { client.invalidateQueries({ queryKey: performanceKeys.all }); client.invalidateQueries({ queryKey: performanceKeys.cycle(variables.cycleId) }); } }); }
export function usePerformanceTasks(query: Record<string, unknown>, mine = false) { return useQuery({ queryKey: performanceKeys.tasks(mine, query), queryFn: () => mine ? performanceApi.listMyTasks(query) : performanceApi.listTasks(query) }); }
export function usePerformanceTask(id: string) { return useQuery({ queryKey: performanceKeys.task(id), queryFn: () => performanceApi.getTask(id), enabled: Boolean(id) }); }
export function usePerformanceWorkflowTasks(query: Record<string, unknown>, mine = false) { return useQuery({ queryKey: performanceKeys.workflowTasks(mine, query), queryFn: () => mine ? performanceApi.listMyWorkflowTasks(query) : performanceApi.listWorkflowTasks(query) }); }
export function usePerformanceResults(query: Record<string, unknown>) { return useQuery({ queryKey: performanceKeys.results(query), queryFn: () => performanceApi.listResults(query) }); }
export function usePerformanceResult(id: string) { return useQuery({ queryKey: performanceKeys.result(id), queryFn: () => performanceApi.getResult(id), enabled: Boolean(id) }); }
export function useEmployeePerformanceAmountBases(query: Record<string, unknown> = {}) { return useQuery({ queryKey: performanceKeys.employeeAmountBases(query), queryFn: () => performanceApi.listEmployeeAmountBases(query) }); }
export function useEmployeePerformanceAmountBaseHistory(employeeId: string) { return useQuery({ queryKey: performanceKeys.employeeAmountBaseHistory(employeeId), queryFn: () => performanceApi.listEmployeeAmountBaseHistory(employeeId), enabled: Boolean(employeeId) }); }
export function useCreatePerformanceTemplate() { const client = useQueryClient(); return useMutation({ mutationFn: performanceApi.createTemplate, onSuccess: () => client.invalidateQueries({ queryKey: performanceKeys.templates }) }); }
export function useCopyPerformanceTemplate() { const client = useQueryClient(); return useMutation({ mutationFn: performanceApi.copyTemplate, onSuccess: () => client.invalidateQueries({ queryKey: performanceKeys.templates }) }); }
export function useArchivePerformanceTemplate() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id: string; input?: PerformanceArchiveTemplateInput }) => performanceApi.archiveTemplate(id, input), onSuccess: () => client.invalidateQueries({ queryKey: performanceKeys.templates }) }); }
export function useCreatePerformanceTemplateVersion() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof performanceApi.createTemplateVersion>[1] }) => performanceApi.createTemplateVersion(id, input), onSuccess: (_, variables) => { client.invalidateQueries({ queryKey: performanceKeys.templates }); client.invalidateQueries({ queryKey: performanceKeys.template(variables.id) }); } }); }
export function useCreateEmployeePerformanceAmountBase() { const client = useQueryClient(); return useMutation({ mutationFn: performanceApi.createEmployeeAmountBase, onSuccess: (_, variables) => { client.invalidateQueries({ queryKey: ['performance', 'employee-amount-bases'] }); client.invalidateQueries({ queryKey: performanceKeys.employeeAmountBaseHistory(variables.employeeId) }); } }); }
export function useSubmitPerformanceTask() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: PerformanceTaskSubmissionInput }) => performanceApi.submitTask(id, input), onSuccess: (_, variables) => { client.invalidateQueries({ queryKey: performanceKeys.task(variables.id) }); client.invalidateQueries({ queryKey: performanceKeys.all }); } }); }
export function useSubmitPerformanceWorkflowTask() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: PerformanceWorkflowTaskSubmissionInput }) => performanceApi.submitWorkflowTask(id, input), onSuccess: () => client.invalidateQueries({ queryKey: performanceKeys.all }) }); }
export function useModifyPerformanceResult() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: PerformanceResultModificationInput }) => performanceApi.modifyResult(id, input), onSuccess: (_, variables) => { client.invalidateQueries({ queryKey: performanceKeys.result(variables.id) }); client.invalidateQueries({ queryKey: performanceKeys.results({}) }); } }); }
