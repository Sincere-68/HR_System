import type {
  EmployeeRosterListItem,
  EmployeeRosterListQuery,
  Paginated,
} from '@hr-demo/shared';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

function toSearchParams(query: EmployeeRosterListQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params;
}

export const employeeRosterKeys = {
  all: ['analytics', 'employee-roster'] as const,
  list: (query: EmployeeRosterListQuery) => ['analytics', 'employee-roster', 'list', query] as const,
};

export function useEmployeeRosterList(query: EmployeeRosterListQuery) {
  return useQuery({
    queryKey: employeeRosterKeys.list(query),
    queryFn: () => apiRequest<Paginated<EmployeeRosterListItem>>(`/analytics/roster?${toSearchParams(query)}`),
  });
}
