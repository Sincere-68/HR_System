import type {
  BlacklistListItem,
  BlacklistListQuery,
  EmployeeInfoApprovalListItem,
  EmployeeInfoApprovalListQuery,
  CreateEmployeeInput,
  Employee,
  EmployeeDetail,
  EmployeeFormOptions,
  EmployeeListItem,
  EmployeeListQuery,
  Organization,
  Paginated,
  PersonnelLaborWorkerListItem,
  PersonnelLaborWorkerListQuery,
  PersonnelResignedListItem,
  PersonnelResignedListQuery,
  RegularEmployeeListItem,
  RegularEmployeeListQuery,
  UpdateEmployeeInput,
} from '@hr-demo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

export const employeeKeys = {
  all: ['employees'] as const,
  blacklist: (query: BlacklistListQuery) => ['blacklist', 'list', query] as const,
  infoApprovals: (query: EmployeeInfoApprovalListQuery) => ['employee-info-approvals', 'list', query] as const,
  list: (query: EmployeeListQuery) => ['employees', 'list', query] as const,
  regular: (query: RegularEmployeeListQuery) => ['employees', 'regular', query] as const,
  personnelLaborWorkers: (query: PersonnelLaborWorkerListQuery) => ['employees', 'personnel-labor-workers', query] as const,
  personnelResigned: (query: PersonnelResignedListQuery) => ['employees', 'personnel-resigned', query] as const,
  detail: (id: string) => ['employees', 'detail', id] as const,
  organizations: ['organizations'] as const,
  formOptions: ['employees', 'form-options'] as const,
};

function toSearchParams<T extends object>(query: T) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params;
}

export function useEmployees(query: EmployeeListQuery) {
  return useQuery({
    queryKey: employeeKeys.list(query),
    queryFn: () => apiRequest<Paginated<EmployeeListItem>>(`/employees?${toSearchParams(query)}`),
  });
}

export function useRegularEmployees(query: RegularEmployeeListQuery) {
  return useQuery({
    queryKey: employeeKeys.regular(query),
    queryFn: () => apiRequest<Paginated<RegularEmployeeListItem>>(`/employees/regular?${toSearchParams(query)}`),
  });
}

export function usePersonnelLaborWorkers(query: PersonnelLaborWorkerListQuery) {
  return useQuery({
    queryKey: employeeKeys.personnelLaborWorkers(query),
    queryFn: () => apiRequest<Paginated<PersonnelLaborWorkerListItem>>(
      `/employment/personnel-labor-workers?${toSearchParams(query)}`,
    ),
  });
}

export function usePersonnelResigned(query: PersonnelResignedListQuery) {
  return useQuery({
    queryKey: employeeKeys.personnelResigned(query),
    queryFn: () => apiRequest<Paginated<PersonnelResignedListItem>>(
      `/employment/personnel-resigned?${toSearchParams(query)}`,
    ),
  });
}

export function useBlacklist(query: BlacklistListQuery) {
  return useQuery({
    queryKey: employeeKeys.blacklist(query),
    queryFn: () => apiRequest<Paginated<BlacklistListItem>>(`/blacklist?${toSearchParams(query)}`),
  });
}

export function useEmployeeInfoApprovals(query: EmployeeInfoApprovalListQuery) {
  return useQuery({
    queryKey: employeeKeys.infoApprovals(query),
    queryFn: () => apiRequest<Paginated<EmployeeInfoApprovalListItem>>(
      `/employee-info-approvals?${toSearchParams(query)}`,
    ),
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: employeeKeys.detail(id ?? ''),
    queryFn: () => apiRequest<EmployeeDetail>(`/employees/${id}`),
    enabled: Boolean(id),
  });
}

export function useOrganizations() {
  return useQuery({
    queryKey: employeeKeys.organizations,
    queryFn: () => apiRequest<Organization[]>('/organizations'),
  });
}

export function useEmployeeFormOptions(excludeEmployeeId?: string, enabled = true) {
  return useQuery({
    queryKey: [...employeeKeys.formOptions, excludeEmployeeId ?? ''] as const,
    queryFn: () => apiRequest<EmployeeFormOptions>(
      `/employees/form-options${excludeEmployeeId ? `?excludeEmployeeId=${encodeURIComponent(excludeEmployeeId)}` : ''}`,
    ),
    enabled,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) =>
      apiRequest<EmployeeDetail>('/employees', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (employee) => {
      queryClient.setQueryData(employeeKeys.detail(employee.id), employee);
      return queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEmployeeInput) =>
      apiRequest<EmployeeDetail>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: (employee) => {
      queryClient.setQueryData(employeeKeys.detail(id), employee);
      return queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}
