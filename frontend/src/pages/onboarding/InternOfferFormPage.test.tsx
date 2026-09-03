import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateInternOfferInput, InternConversionOfferPrefill, InternOfferFormOptions } from '@hr-demo/shared';
import { InternOfferFormPage } from './InternOfferFormPage';

const useInternOfferFormOptions = vi.fn();
const useInternConversionOfferPrefill = vi.fn();
const useCreateInternOffer = vi.fn();
const useAuth = vi.fn();
const successMessage = vi.fn();
const errorMessage = vi.fn();

vi.mock('../../features/auth/auth-context', () => ({ useAuth: () => useAuth() }));
vi.mock('../../features/onboarding/api', () => ({
  useInternOfferFormOptions: (enabled: boolean) => useInternOfferFormOptions(enabled),
  useInternConversionOfferPrefill: (employeeId: string | undefined, enabled: boolean) => useInternConversionOfferPrefill(employeeId, enabled),
  useCreateInternOffer: () => useCreateInternOffer(),
}));
vi.mock('../../features/onboarding/InternOfferForm', () => ({
  InternOfferForm: ({ onSubmit, conversionPrefill }: { onSubmit: (input: CreateInternOfferInput) => void; conversionPrefill?: InternConversionOfferPrefill | null }) => (
    <>
      <output data-testid="prefill-name">{conversionPrefill?.name ?? 'none'}</output>
      <button type="button" onClick={() => onSubmit({ name: '虚构实习候选人', mobile: '13900001001', personalEmail: 'fictional.intern@example.invalid', source: 'SOCIAL_RECRUITMENT', organizationId: 'org-1', positionId: 'position-1', proposedEntryDate: '2026-09-01' })}>模拟保存表单</button>
    </>
  ),
}));
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, App: Object.assign(actual.App, { useApp: () => ({ message: { success: successMessage, error: errorMessage } }) }) };
});

const formOptions: InternOfferFormOptions = {
  organizations: [{ id: 'org-1', name: '虚构研发部' }], positions: [{ id: 'position-1', name: '虚构实习职位', organizationId: 'org-1' }],
  workplaces: [{ id: 'workplace-1', name: '虚构园区', address: '虚构地址' }], employingCompanies: [{ id: 'company-1', name: '虚构全日制公司' }], managers: [],
};
const prefill: InternConversionOfferPrefill = {
  name: '虚构实习生', mobile: '13900001002', personalEmail: 'intern@example.invalid', source: 'INTERNAL_REFERRAL', gender: null, birthDate: null,
  identityDocument: null, educationExperience: null, organizationId: 'org-1', positionId: null, workplaceId: null, jobLevel: null, employeeLevel: null, personnelCategory: null, workArrangement: null, directManagerEmployeeId: null, employingCompanyId: null, agreementType: null, contractTermType: null, contractEndDate: null,
};
function LocationProbe() { const location = useLocation(); return <output data-testid="location-search">{location.pathname}{location.search}</output>; }
function renderPage(path = '/onboarding/offers/new?source=new-hire') { return render(<MemoryRouter initialEntries={[path]}><InternOfferFormPage /><LocationProbe /></MemoryRouter>); }

afterEach(() => cleanup());

describe('InternOfferFormPage', () => {
  beforeEach(() => {
    useAuth.mockReset(); useInternOfferFormOptions.mockReset(); useInternConversionOfferPrefill.mockReset(); useCreateInternOffer.mockReset(); successMessage.mockReset(); errorMessage.mockReset();
    useAuth.mockReturnValue({ user: { permissions: ['employee.create'] } });
    useInternOfferFormOptions.mockReturnValue({ isLoading: false, isError: false, data: formOptions });
    useInternConversionOfferPrefill.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    useCreateInternOffer.mockReturnValue({ isError: false, isPending: false, mutateAsync: vi.fn().mockResolvedValue({ id: 'offer-1' }) });
  });

  it('loads a new-hire direct form without a template request', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: '新建实习Offer' })).toBeInTheDocument();
    expect(useInternOfferFormOptions).toHaveBeenCalledWith(true);
    expect(useInternConversionOfferPrefill).toHaveBeenCalledWith(undefined, false);
    expect(screen.getByTestId('prefill-name')).toHaveTextContent('none');
  });

  it('loads a selected intern prefill then directly saves the editable Offer payload', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'offer-1' });
    useInternConversionOfferPrefill.mockReturnValue({ isLoading: false, isError: false, data: prefill });
    useCreateInternOffer.mockReturnValue({ isError: false, isPending: false, mutateAsync });
    renderPage('/onboarding/offers/new?source=intern-conversion&employeeId=intern-1');
    expect(screen.getByRole('heading', { name: '实习生转正Offer' })).toBeInTheDocument();
    expect(screen.getByTestId('prefill-name')).toHaveTextContent('虚构实习生');
    expect(useInternConversionOfferPrefill).toHaveBeenCalledWith('intern-1', true);
    fireEvent.click(screen.getByRole('button', { name: '模拟保存表单' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ name: '虚构实习候选人', source: 'SOCIAL_RECRUITMENT' })));
    expect(mutateAsync.mock.calls[0]![0]).not.toHaveProperty('creationPath');
    await waitFor(() => expect(successMessage).toHaveBeenCalledWith('实习生转正 Offer 已保存'));
  });

  it('shows a missing-intern path error instead of creating records', () => {
    renderPage('/onboarding/offers/new?source=intern-conversion');
    expect(screen.getByText('请先选择实习生')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回创建入口' })).toHaveAttribute('href', '/onboarding/offers/templates');
  });

  it('shows a 403 result without create permission and disables direct Offer reads', () => {
    useAuth.mockReturnValue({ user: { permissions: ['employee.read'] } });
    renderPage();
    expect(screen.getByText('无权执行此操作')).toBeInTheDocument();
    expect(useInternOfferFormOptions).toHaveBeenCalledWith(false);
    expect(useInternConversionOfferPrefill).toHaveBeenCalledWith(undefined, false);
  });

  it('reports conversion prefill API errors before rendering the form', () => {
    useInternConversionOfferPrefill.mockReturnValue({ isLoading: false, isError: true, error: new Error('预填读取失败') });
    renderPage('/onboarding/offers/new?source=intern-conversion&employeeId=intern-1');
    expect(screen.getByText('无法读取实习生转正预填信息')).toBeInTheDocument();
    expect(screen.getByText('预填读取失败')).toBeInTheDocument();
  });
});
