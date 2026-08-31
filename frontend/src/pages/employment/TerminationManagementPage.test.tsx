import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TerminationManagementPage } from './TerminationManagementPage';

const useTerminations = vi.fn();
vi.mock('../../features/employment/api', () => ({
  useTerminations: (query: unknown) => useTerminations(query),
}));

const row = {
  id: 'termination-1',
  employeeId: 'employee-1',
  canViewEmployeeDetail: true,
  employeeNo: 'F-001',
  employeeName: '虚构员工',
  previousDepartmentName: '虚构部门',
  previousPositionName: '虚构岗位',
  lastWorkingDate: '2026-09-28',
  lastWorkingDateBasis: 'ACTUAL',
  terminationType: '主动离职',
  terminationReason: '虚构离职原因',
  approvalStatus: 'PENDING',
  currentApproverName: '当前审批人',
  handoverStatus: 'IN_PROGRESS',
  compensationAmount: null,
};

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current search">{location.search}</output>;
}

function renderPage(entry = '/employment/termination') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <TerminationManagementPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('TerminationManagementPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useTerminations.mockReset();
    useTerminations.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('keeps the required 12-column order, renders placeholders, and links employee detail', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '工号', '姓名', '离职前部门', '离职前职位', '最后工作日', '离职类型',
      '离职原因', '审批状态', '当前审批人', '离职交接状态', '离职补偿金', '操作',
    ]);
    expect(screen.getByText('虚构员工')).toBeInTheDocument();
    expect(screen.getByText('2026-09-28')).toBeInTheDocument();
    expect(within(table).getByText(/实际/)).toBeInTheDocument();
    expect(screen.getByText('主动离职')).toBeInTheDocument();
    expect(screen.getByText('虚构离职原因')).toBeInTheDocument();
    expect(within(table).getAllByText('--').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('does not offer employee detail when the API denies current access', () => {
    useTerminations.mockReturnValue({
      data: { data: [{ ...row, canViewEmployeeDetail: false }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    const rendered = renderPage();
    const page = within(rendered.container);
    expect(page.queryByRole('link', { name: /查看/ })).not.toBeInTheDocument();
    expect(page.getByRole('button', { name: '暂无详情' })).toBeDisabled();
  });

  it('changes the view tab through the URL and API query', async () => {
    const user = userEvent.setup();
    renderPage('/employment/termination?view=all&keyword=F-002&status=PENDING&page=4&pageSize=20');

    await user.click(screen.getByRole('button', { name: '已完成的离职' }));

    expect(screen.getByLabelText('current search')).toHaveTextContent(
      '?view=completed&keyword=F-002&status=PENDING&page=1&pageSize=20',
    );
    expect(useTerminations).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'completed', keyword: 'F-002', status: 'PENDING', page: 1, pageSize: 20,
    }));
  });

  it('preserves URL filters and pagination in the API query', () => {
    renderPage('/employment/termination?keyword=F-002&status=APPROVED&lastWorkingDateFrom=2026-09-01&lastWorkingDateTo=2026-09-30&page=3&pageSize=20');
    expect(useTerminations).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'active',
      keyword: 'F-002',
      status: 'APPROVED',
      lastWorkingDateFrom: '2026-09-01',
      lastWorkingDateTo: '2026-09-30',
      page: 3,
      pageSize: 20,
    }));
    expect(screen.getByRole('searchbox', { name: '搜索离职记录' })).toHaveValue('F-002');
  });

  it('syncs a submitted keyword to the URL and API query', async () => {
    const user = userEvent.setup();
    renderPage('/employment/termination?view=all&status=PENDING&page=3');

    const search = screen.getByRole('searchbox', { name: '搜索离职记录' });
    await user.type(search, '  F-003  {Enter}');

    const nextSearch = new URLSearchParams(screen.getByLabelText('current search').textContent ?? '');
    expect(Object.fromEntries(nextSearch)).toEqual({
      view: 'all', status: 'PENDING', page: '1', keyword: 'F-003',
    });
    expect(useTerminations).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'all', keyword: 'F-003', status: 'PENDING', page: 1,
    }));
  });
});
