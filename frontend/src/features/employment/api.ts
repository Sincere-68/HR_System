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
  ProbationListItem,
  RetirementListItem,
  RetirementListQuery,
  TerminationListItem,
  TerminationListQuery,
  ProbationListQuery,
  TrialPostListItem,
  TrialPostListQuery,
} from '@hr-demo/shared';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

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
