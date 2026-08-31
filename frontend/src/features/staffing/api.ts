import type { Paginated, TransferTypeListItem, TransferTypeListQuery } from '@hr-demo/shared';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

function toSearchParams(query: TransferTypeListQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params;
}

export const staffingKeys = {
  transferTypes: (query: TransferTypeListQuery) => ['staffing', 'transfer-types', query] as const,
};

export function useTransferTypes(query: TransferTypeListQuery) {
  return useQuery({
    queryKey: staffingKeys.transferTypes(query),
    queryFn: () => apiRequest<Paginated<TransferTypeListItem>>(
      `/staffing/transfer-types?${toSearchParams(query)}`,
    ),
  });
}
