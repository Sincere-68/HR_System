import type { ContractListItem, ContractListQuery, Paginated } from '@hr-demo/shared';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

function toSearchParams(query: ContractListQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params;
}

export const contractKeys = {
  all: ['contracts'] as const,
  list: (query: ContractListQuery) => ['contracts', 'list', query] as const,
};

export function useContracts(query: ContractListQuery) {
  return useQuery({
    queryKey: contractKeys.list(query),
    queryFn: () => apiRequest<Paginated<ContractListItem>>(`/contracts?${toSearchParams(query)}`),
  });
}
