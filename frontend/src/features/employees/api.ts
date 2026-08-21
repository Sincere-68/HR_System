import type {
  CreateEmployeeInput,
  Employee,
  EmployeeListQuery,
  Organization,
  Paginated,
  UpdateEmployeeInput,
} from '@hr-demo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

export const employeeKeys = {
  all: ['employees'] as const,
  list: (query: EmployeeListQuery) => ['employees', 'list', query] as const,
  detail: (id: string) => ['employees', 'detail', id] as const,
  organizations: ['organizations'] as const,
};

function toSearchParams(query: EmployeeListQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params;
}

export function useEmployees(query: EmployeeListQuery) {
  return useQuery({
    queryKey: employeeKeys.list(query),
    queryFn: () => apiRequest<Paginated<Employee>>(`/employees?${toSearchParams(query)}`),
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: employeeKeys.detail(id ?? ''),
    queryFn: () => apiRequest<Employee>(`/employees/${id}`),
    enabled: Boolean(id),
  });
}

export function useOrganizations() {
  return useQuery({
    queryKey: employeeKeys.organizations,
    queryFn: () => apiRequest<Organization[]>('/organizations'),
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) =>
      apiRequest<Employee>('/employees', { method: 'POST', body: JSON.stringify(input) }),
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
      apiRequest<Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: (employee) => {
      queryClient.setQueryData(employeeKeys.detail(id), employee);
      return queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}
