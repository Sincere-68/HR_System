import type {
  AppraisalListItem,
  AwardListItem,
  CertificateListItem,
  EducationListItem,
  EmployeeSubsetListQuery,
  FamilyListItem,
  LanguageListItem,
  Paginated,
  ProjectListItem,
  SkillListItem,
  TrainingListItem,
  WorkHistoryListItem,
} from '@hr-demo/shared';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

function toSearchParams(query: EmployeeSubsetListQuery) {
  const params = new URLSearchParams();
  const values = {
    keyword: query.keyword,
    organizationId: query.organizationId,
    page: query.page,
    pageSize: query.pageSize,
  };
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params;
}

export const employeeSubsetKeys = {
  all: ['employee-subsets'] as const,
  education: (query: EmployeeSubsetListQuery) => ['employee-subsets', 'education', query] as const,
  workHistory: (query: EmployeeSubsetListQuery) => ['employee-subsets', 'work-history', query] as const,
  family: (query: EmployeeSubsetListQuery) => ['employee-subsets', 'family', query] as const,
  appraisals: (query: EmployeeSubsetListQuery) => ['employee-subsets', 'appraisals', query] as const,
  training: (query: EmployeeSubsetListQuery) => ['employee-subsets', 'training', query] as const,
  awards: (query: EmployeeSubsetListQuery) => ['employee-subsets', 'awards', query] as const,
  certificates: (query: EmployeeSubsetListQuery) => ['employee-subsets', 'certificates', query] as const,
  projects: (query: EmployeeSubsetListQuery) => ['employee-subsets', 'projects', query] as const,
  skills: (query: EmployeeSubsetListQuery) => ['employee-subsets', 'skills', query] as const,
  languages: (query: EmployeeSubsetListQuery) => ['employee-subsets', 'languages', query] as const,
};

export function useEducationList(query: EmployeeSubsetListQuery) {
  return useQuery({
    queryKey: employeeSubsetKeys.education(query),
    queryFn: () => apiRequest<Paginated<EducationListItem>>(`/subsets/education?${toSearchParams(query)}`),
  });
}

export function useWorkHistoryList(query: EmployeeSubsetListQuery) {
  return useQuery({
    queryKey: employeeSubsetKeys.workHistory(query),
    queryFn: () => apiRequest<Paginated<WorkHistoryListItem>>(`/subsets/work-history?${toSearchParams(query)}`),
  });
}

export function useFamilyList(query: EmployeeSubsetListQuery) {
  return useQuery({
    queryKey: employeeSubsetKeys.family(query),
    queryFn: () => apiRequest<Paginated<FamilyListItem>>(`/subsets/family?${toSearchParams(query)}`),
  });
}

export function useAppraisalList(query: EmployeeSubsetListQuery) {
  return useQuery({
    queryKey: employeeSubsetKeys.appraisals(query),
    queryFn: () => apiRequest<Paginated<AppraisalListItem>>(`/subsets/appraisals?${toSearchParams(query)}`),
  });
}

export function useTrainingList(query: EmployeeSubsetListQuery) {
  return useQuery({
    queryKey: employeeSubsetKeys.training(query),
    queryFn: () => apiRequest<Paginated<TrainingListItem>>(`/subsets/training?${toSearchParams(query)}`),
  });
}

export function useAwardList(query: EmployeeSubsetListQuery) {
  return useQuery({
    queryKey: employeeSubsetKeys.awards(query),
    queryFn: () => apiRequest<Paginated<AwardListItem>>(`/subsets/awards?${toSearchParams(query)}`),
  });
}

export function useCertificateList(query: EmployeeSubsetListQuery) {
  return useQuery({
    queryKey: employeeSubsetKeys.certificates(query),
    queryFn: () => apiRequest<Paginated<CertificateListItem>>(`/subsets/certificates?${toSearchParams(query)}`),
  });
}

export function useProjectList(query: EmployeeSubsetListQuery) {
  return useQuery({
    queryKey: employeeSubsetKeys.projects(query),
    queryFn: () => apiRequest<Paginated<ProjectListItem>>(`/subsets/projects?${toSearchParams(query)}`),
  });
}

export function useSkillList(query: EmployeeSubsetListQuery) {
  return useQuery({
    queryKey: employeeSubsetKeys.skills(query),
    queryFn: () => apiRequest<Paginated<SkillListItem>>(`/subsets/skills?${toSearchParams(query)}`),
  });
}

export function useLanguageList(query: EmployeeSubsetListQuery) {
  return useQuery({
    queryKey: employeeSubsetKeys.languages(query),
    queryFn: () => apiRequest<Paginated<LanguageListItem>>(`/subsets/languages?${toSearchParams(query)}`),
  });
}
