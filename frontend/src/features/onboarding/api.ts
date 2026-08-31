import type {
  EmployeeIntroductionListItem,
  IdCardReadListItem,
  OfferListItem,
  OfferListQuery,
  OnboardingEntryListItem,
  OnboardingIntegrationListItem,
  OnboardingListQuery,
  Paginated,
  PaginatedOfferList,
} from '@hr-demo/shared';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';

function toSearchParams(query: OnboardingListQuery) {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 10));
  return params;
}

function toOfferSearchParams(query: OfferListQuery) {
  const params = new URLSearchParams();
  params.set('view', query.view ?? 'PENDING_SEND');
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 10));
  return params;
}

export const onboardingKeys = {
  offers: (query: OfferListQuery) => ['onboarding', 'offers', query] as const,
  entries: (query: OnboardingListQuery) => ['onboarding', 'entries', query] as const,
  integration: (query: OnboardingListQuery) => ['onboarding', 'integration', query] as const,
  introduction: (query: OnboardingListQuery) => ['onboarding', 'introduction', query] as const,
  idCardReader: (query: OnboardingListQuery) => ['onboarding', 'id-card-reader', query] as const,
};

export function useOffers(query: OfferListQuery) {
  return useQuery({
    queryKey: onboardingKeys.offers(query),
    queryFn: () => apiRequest<PaginatedOfferList>(`/onboarding/offers?${toOfferSearchParams(query)}`),
  });
}

export function useOnboardingEntries(query: OnboardingListQuery) {
  return useQuery({
    queryKey: onboardingKeys.entries(query),
    queryFn: () => apiRequest<Paginated<OnboardingEntryListItem>>(`/onboarding/entries?${toSearchParams(query)}`),
  });
}

export function useOnboardingIntegration(query: OnboardingListQuery) {
  return useQuery({
    queryKey: onboardingKeys.integration(query),
    queryFn: () => apiRequest<Paginated<OnboardingIntegrationListItem>>(`/onboarding/integration?${toSearchParams(query)}`),
  });
}

export function useEmployeeIntroduction(query: OnboardingListQuery) {
  return useQuery({
    queryKey: onboardingKeys.introduction(query),
    queryFn: () => apiRequest<Paginated<EmployeeIntroductionListItem>>(`/onboarding/introduction?${toSearchParams(query)}`),
  });
}

export function useIdCardReader(query: OnboardingListQuery) {
  return useQuery({
    queryKey: onboardingKeys.idCardReader(query),
    queryFn: () => apiRequest<Paginated<IdCardReadListItem>>(`/onboarding/id-card-reader?${toSearchParams(query)}`),
  });
}
