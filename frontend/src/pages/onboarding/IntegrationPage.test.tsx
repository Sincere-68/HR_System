import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationPage } from './IntegrationPage';

const useOnboardingIntegration = vi.fn();

vi.mock('../../features/onboarding/api', () => ({
  useOnboardingIntegration: (query: unknown) => useOnboardingIntegration(query),
}));

const integration = {
  id: 'integration-1',
  employeeName: '虚构员工己',
  organizationName: '虚构产品中心',
  jobTitleName: '虚构产品职务',
  entryDate: '2026-08-07',
  managerName: '虚构直线经理',
  integrationStatus: 'IN_PROGRESS',
  integrationProgress: null,
};

function renderPage(initialEntry = '/onboarding/integration') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <IntegrationPage />
    </MemoryRouter>,
  );
}

describe('IntegrationPage', () => {
  beforeEach(() => {
    useOnboardingIntegration.mockReset();
    useOnboardingIntegration.mockReturnValue({
      data: { data: [integration], meta: { page: 2, pageSize: 20, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => cleanup());

  it('renders exactly eight integration columns in order with mapped and nullable values', () => {
    renderPage('/onboarding/integration?page=2&pageSize=20');
    const table = screen.getByRole('table');
    const columnHeaders = within(table).getAllByRole('columnheader');

    expect(columnHeaders.map((heading) => heading.textContent?.trim()).filter(Boolean)).toEqual([
      '人员', '部门', '职务', '入职日期', '直线经理', '融入状态', '融入进度', '操作',
    ]);
    expect(screen.getByText('虚构员工己')).toBeInTheDocument();
    expect(screen.getByText('虚构产品中心')).toBeInTheDocument();
    expect(screen.getByText('虚构产品职务')).toBeInTheDocument();
    expect(screen.getByText('2026-08-07')).toBeInTheDocument();
    expect(screen.getByText('虚构直线经理')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(within(table).getByText('--')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂无操作' })).toBeDisabled();
  });

  it('passes URL pagination to the integration query', () => {
    renderPage('/onboarding/integration?page=2&pageSize=20');
    expect(useOnboardingIntegration).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
  });

  it('renders the requested empty state', () => {
    useOnboardingIntegration.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByRole('heading', { name: '新员工融入' })).toBeInTheDocument();
    expect(screen.getByText('暂无新员工融入记录')).toBeInTheDocument();
  });
});
