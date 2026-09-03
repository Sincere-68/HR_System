import type {
  CreateInternOfferInput,
  CreatedInternOffer,
  EmployeeIntroductionListItem,
  IdCardReadListItem,
  InternConversionEmployeeOption,
  InternConversionOfferPrefill,
  InternOfferFormOptions,
  OfferListItem,
  OfferListQuery,
  OnboardingEntryListItem,
  OnboardingIntegrationListItem,
  OnboardingListQuery,
  Paginated,
  PaginatedOfferList,
} from '@hr-demo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { downloadTableExport } from '../employees/download';

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
  all: ['onboarding'] as const,
  offers: (query: OfferListQuery) => ['onboarding', 'offers', query] as const,
  internOfferFormOptions: ['onboarding', 'intern-offer-form-options'] as const,
  internConversionOptions: ['onboarding', 'intern-conversion-options'] as const,
  internConversionPrefill: (employeeId: string | undefined) => ['onboarding', 'intern-conversion-options', employeeId] as const,
  entries: (query: OnboardingListQuery) => ['onboarding', 'entries', query] as const,
  integration: (query: OnboardingListQuery) => ['onboarding', 'integration', query] as const,
  introduction: (query: OnboardingListQuery) => ['onboarding', 'introduction', query] as const,
  idCardReader: (query: OnboardingListQuery) => ['onboarding', 'id-card-reader', query] as const,
};

export function downloadOnboardingExport(
  endpoint: 'offers' | 'entries' | 'integration' | 'introduction' | 'id-card-reader',
  input: { format: 'XLSX' | 'CSV'; fields: string[]; employeeIds?: string[]; query?: object },
  fallbackName: string,
) {
  const { query, ...body } = input;
  const offerView = (query as { view?: unknown } | undefined)?.view;
  const queryString = endpoint === 'offers' && offerView
    ? `?view=${encodeURIComponent(String(offerView))}`
    : '';
  return downloadTableExport(`/onboarding/${endpoint}/export${queryString}`, body, fallbackName);
}

export function useOffers(query: OfferListQuery) {
  return useQuery({
    queryKey: onboardingKeys.offers(query),
    queryFn: () => apiRequest<PaginatedOfferList>(`/onboarding/offers?${toOfferSearchParams(query)}`),
  });
}

export function useInternOfferFormOptions(enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.internOfferFormOptions,
    queryFn: () => apiRequest<InternOfferFormOptions>('/onboarding/intern-offer-form-options'),
    enabled,
  });
}

export function useCreateInternOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInternOfferInput) =>
      apiRequest<CreatedInternOffer>('/onboarding/intern-offers', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: onboardingKeys.all }),
  });
}

export function useInternConversionOptions(enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.internConversionOptions,
    queryFn: () => apiRequest<InternConversionEmployeeOption[]>('/onboarding/intern-conversion-options'),
    enabled,
  });
}

export function useInternConversionOfferPrefill(employeeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.internConversionPrefill(employeeId),
    queryFn: () => apiRequest<InternConversionOfferPrefill>(`/onboarding/intern-conversion-options/${encodeURIComponent(employeeId!)}`),
    enabled: Boolean(employeeId) && enabled,
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
