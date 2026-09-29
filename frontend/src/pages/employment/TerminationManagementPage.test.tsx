import { cleanup, render, screen } from '@testing-library/react';
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

  it('renders direct reference tabs and changes only the supported view query', async () => {
    const user = userEvent.setup();
    renderPage('/employment/termination?view=all&keyword=F-002&status=PENDING&page=4&pageSize=20');

    expect(screen.getByRole('button', { name: '离职中的员工' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '已完成的离职' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部离职记录' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '已完成的离职' }));

    expect(Object.fromEntries(new URLSearchParams(screen.getByLabelText('current search').textContent ?? ''))).toEqual({
      view: 'completed',
      keyword: 'F-002',
      status: 'PENDING',
      page: '1',
      pageSize: '20',
    });
    expect(useTerminations).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'completed',
      keyword: 'F-002',
      status: 'PENDING',
      page: 1,
      pageSize: 20,
    }));
  });

  it('keeps the reference column order and uses placeholders instead of fabricated values', () => {
    renderPage();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '工号', '姓名', '离职前部门', '离职前职位', '最后工作日', '离职类型',
      '离职原因', '审批状态', '当前审批人', '离职交接状态', '离职补偿金', '操作',
    ]);
    expect(screen.getByText('虚构员工')).toBeInTheDocument();
    expect(screen.getByText('2026-09-28')).toBeInTheDocument();
    expect(screen.getByText('主动离职')).toBeInTheDocument();
    expect(screen.getByText('虚构离职原因')).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('keeps compensation unavailable even when a row contains an unexpected value', () => {
    useTerminations.mockReturnValue({
      data: { data: [{ ...row, compensationAmount: 'unexpected-value' }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.queryByText('unexpected-value')).not.toBeInTheDocument();
  });

  it('keeps the employee action permission-aware and exposes no false process action', () => {
    useTerminations.mockReturnValue({
      data: { data: [{ ...row, canViewEmployeeDetail: false }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.queryByRole('link', { name: /查看/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '被动离职' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /导入历史离职人员/ })).toBeDisabled();
  });

  it('preserves existing filters and clears only the supported filter query keys', async () => {
    const user = userEvent.setup();
    renderPage('/employment/termination?view=all&keyword=F-002&status=APPROVED&lastWorkingDateFrom=2026-09-01&lastWorkingDateTo=2026-09-30&page=3&pageSize=20');

    expect(useTerminations).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'all',
      keyword: 'F-002',
      status: 'APPROVED',
      lastWorkingDateFrom: '2026-09-01',
      lastWorkingDateTo: '2026-09-30',
      page: 3,
      pageSize: 20,
    }));
    expect(screen.getByRole('searchbox', { name: '筛选人员' })).toHaveValue('F-002');

    await user.click(screen.getByRole('button', { name: '清空筛选' }));

    expect(Object.fromEntries(new URLSearchParams(screen.getByLabelText('current search').textContent ?? ''))).toEqual({
      view: 'all',
      page: '1',
      pageSize: '20',
    });
    expect(useTerminations).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'all',
      page: 1,
      pageSize: 20,
      keyword: undefined,
      status: undefined,
      lastWorkingDateFrom: undefined,
      lastWorkingDateTo: undefined,
    }));
  });
});
