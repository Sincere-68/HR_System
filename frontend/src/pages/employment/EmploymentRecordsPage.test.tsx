import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmploymentRecordsPage } from './EmploymentRecordsPage';

const useEmploymentRecords = vi.fn();
const useOrganizations = vi.fn();

vi.mock('../../features/employment/api', () => ({
  useEmploymentRecords: (query: unknown) => useEmploymentRecords(query),
}));
vi.mock('../../features/employees/api', () => ({
  useOrganizations: () => useOrganizations(),
}));

const row = {
  id: 'assignment-1',
  employeeId: 'employee-1',
  employeeNo: 'F-001',
  employeeName: '虚构员工',
  entryDate: '2026-07-15',
  departmentName: '虚构部门',
  positionName: '虚构岗位',
  positionStartDate: '2026-08-01',
  positionEndDate: null,
  personnelLocator: null,
  personnelStatus: 'REGULAR',
  assignmentStatus: 'ACTIVE',
  approvalStatus: null,
  isLatestPrimaryRecord: true,
  interviewEvaluation: null,
  availability: 'AVAILABLE',
  canViewEmployeeDetail: true,
};

function renderPage(entry = '/employment/records') {
  return render(<MemoryRouter initialEntries={[entry]}><EmploymentRecordsPage /></MemoryRouter>);
}

describe('EmploymentRecordsPage', () => {
  beforeEach(() => {
    useEmploymentRecords.mockReset();
    useOrganizations.mockReset();
    useEmploymentRecords.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useOrganizations.mockReturnValue({ data: [{ id: 'org-a', name: '虚构部门' }], isLoading: false });
  });

  it('keeps the required 15-column order and renders real fields, placeholders, and a real action', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '工号', '姓名', '入职日期', '任职部门', '任职职位', '现岗位开始日期', '现岗位结束日期',
      '人员定位', '人员状态', '任职状态', '审批状态', '是否最新主职记录', '面试评价', '简历信息', '操作',
    ]);
    expect(within(table).getByText('F-001')).toBeInTheDocument();
    expect(within(table).getByText('虚构岗位')).toBeInTheDocument();
    expect(within(table).getByText('正式')).toBeInTheDocument();
    expect(within(table).getByText('任职中')).toBeInTheDocument();
    expect(within(table).getByText('是')).toBeInTheDocument();
    expect(within(table).getByText('有附件')).toBeInTheDocument();
    expect(within(table).getAllByText('--')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('preserves current-view URL filters and pagination in the API query', () => {
    renderPage('/employment/records?view=current&keyword=F-002&organizationId=org-a&personnelStatus=REGULAR&assignmentStatus=ENDED&startDateFrom=2026-08-01&startDateTo=2026-08-31&page=3&pageSize=20');
    expect(useEmploymentRecords).toHaveBeenLastCalledWith({
      view: 'current',
      keyword: 'F-002',
      organizationId: 'org-a',
      personnelStatus: 'REGULAR',
      assignmentStatus: undefined,
      startDateFrom: '2026-08-01',
      startDateTo: '2026-08-31',
      page: 3,
      pageSize: 20,
    });
  });

  it('passes the assignment-status filter only for the full-history view', () => {
    renderPage('/employment/records?view=history&assignmentStatus=ENDED&page=2&pageSize=50');
    expect(useEmploymentRecords).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'history', assignmentStatus: 'ENDED', page: 2, pageSize: 50,
    }));
    expect(screen.getByRole('combobox', { name: '筛选任职状态' })).toBeInTheDocument();
  });
});
