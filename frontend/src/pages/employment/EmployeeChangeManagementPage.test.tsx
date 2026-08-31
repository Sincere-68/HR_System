import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function renderPage(entry = '/employment/changes') {
  return render(<MemoryRouter initialEntries={[entry]}><EmployeeChangeManagementPage /></MemoryRouter>);
}

describe('EmployeeChangeManagementPage', () => {
  beforeEach(() => {
    useEmployeeMovements.mockReset();
    useEmployeeMovements.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('keeps the required 17-column order and renders real and placeholder fields', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '工号', '异动日期', '异动类型', '异动类型（员工端）', '审批状态',
      '调动前部门', '调动前职位', '调动前职级', '调动后部门', '调动后职位',
      '调动后职级', '调动后工作地点', '交接状态', '当前审批人', '试岗结束日期', '操作',
    ]);
    expect(screen.getByText('虚构员工')).toBeInTheDocument();
    expect(screen.getByText('部门调动')).toBeInTheDocument();
    expect(within(table).getAllByText('当前审批人').length).toBeGreaterThanOrEqual(2);
    expect(within(table).getAllByText('--').length).toBeGreaterThanOrEqual(5);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('passes the selected tab and URL filters to the API query', () => {
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
  });
});
