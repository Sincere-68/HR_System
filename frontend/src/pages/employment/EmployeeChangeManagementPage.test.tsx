import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeChangeManagementPage } from './EmployeeChangeManagementPage';

const useEmployeeMovements = vi.fn();
vi.mock('../../features/employment/api', () => ({
  useEmployeeMovements: (query: unknown) => useEmployeeMovements(query),
}));

const row = {
  id: 'movement-1',
  employeeId: 'employee-1',
  canViewEmployeeDetail: true,
  employeeNo: 'F-001',
  employeeName: '虚构员工',
  effectiveDate: '2026-08-20',
  movementTypeName: '部门调动',
  movementTypeEmployeeName: null,
  movementStatus: 'APPROVED',
  approvalStatus: 'PENDING',
  fromDepartmentName: '原部门',
  fromPositionName: null,
  fromJobLevel: null,
  toDepartmentName: '新部门',
  toPositionName: '新岗位',
  toJobLevel: 'S1',
  toWorkplaceName: null,
  handoverStatus: null,
  currentApproverName: '当前审批人',
  trialPostEndDate: null,
};

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current search">{location.search}</output>;
}

function renderPage(entry = '/employment/changes') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <EmployeeChangeManagementPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('EmployeeChangeManagementPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useEmployeeMovements.mockReset();
    useEmployeeMovements.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('renders the direct reference tabs and keeps current filters when switching view', async () => {
    const user = userEvent.setup();
    renderPage('/employment/changes?keyword=F-002&approvalStatus=PENDING&page=3&pageSize=20');

    expect(screen.getByRole('button', { name: '异动中员工' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '已完成的异动' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部异动记录' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '已完成的异动' }));

    expect(Object.fromEntries(new URLSearchParams(screen.getByLabelText('current search').textContent ?? ''))).toEqual({
      keyword: 'F-002',
      approvalStatus: 'PENDING',
      page: '1',
      pageSize: '20',
      view: 'completed',
    });
    expect(useEmployeeMovements).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'completed',
      keyword: 'F-002',
      approvalStatus: 'PENDING',
      page: 1,
      pageSize: 20,
    }));
  });

  it('keeps the required 17-column order and renders only real or placeholder values', () => {
    renderPage();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '工号', '异动日期', '异动类型', '异动类型（员工端）', '审批状态',
      '调动前部门', '调动前职位', '调动前职级', '调动后部门', '调动后职位',
      '调动后职级', '调动后工作地点', '交接状态', '当前审批人', '试岗结束日期', '操作',
    ]);
    expect(screen.getByText('虚构员工')).toBeInTheDocument();
    expect(screen.getByText('部门调动')).toBeInTheDocument();
    expect(screen.getAllByText('当前审批人').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(5);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('passes the supported URL filters to the API query without inventing new filters', () => {
    renderPage('/employment/changes?view=completed&keyword=F-002&approvalStatus=APPROVED&effectiveDateFrom=2026-08-01&effectiveDateTo=2026-08-31&page=3&pageSize=20');
    expect(useEmployeeMovements).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'completed',
      keyword: 'F-002',
      approvalStatus: 'APPROVED',
      effectiveDateFrom: '2026-08-01',
      effectiveDateTo: '2026-08-31',
      page: 3,
      pageSize: 20,
    }));
    expect(screen.getByRole('button', { name: '异动申请' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /批量异动申请/ })).toBeDisabled();
  });

  it('shows a permission state for a forbidden list response instead of an empty result', () => {
    useEmployeeMovements.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: Object.assign(new Error('Forbidden'), { status: 403 }),
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('暂无访问权限')).toBeInTheDocument();
    expect(screen.queryByText('没有符合条件的异动记录')).not.toBeInTheDocument();
    expect(screen.queryByText('虚构员工')).not.toBeInTheDocument();
  });
});
