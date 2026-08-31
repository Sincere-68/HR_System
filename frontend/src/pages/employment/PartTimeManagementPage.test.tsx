import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PartTimeManagementPage } from './PartTimeManagementPage';

const usePartTimeAssignments = vi.fn();
vi.mock('../../features/employment/api', () => ({
  usePartTimeAssignments: (query: unknown) => usePartTimeAssignments(query),
}));

const row = {
  id: 'assignment-part-time-1',
  employeeId: 'employee-1',
  employeeName: '虚构兼职员工',
  employeeNo: 'F-001',
  partTimeType: null,
  startDate: '2026-08-01',
  institutionName: null,
  departmentName: '虚构兼职部门',
  managerName: null,
  jobTitleName: '虚构兼职职务',
  endDate: '2026-12-31',
  assignmentStatus: 'ACTIVE' as const,
  approvalStatus: null,
  canViewEmployeeDetail: true,
};

function renderPage(entry = '/employment/part-time') {
  return render(<MemoryRouter initialEntries={[entry]}><PartTimeManagementPage /></MemoryRouter>);
}

describe('PartTimeManagementPage', () => {
  beforeEach(() => {
    cleanup();
    usePartTimeAssignments.mockReset();
    usePartTimeAssignments.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('keeps the exact required column order and renders real and unsupported fields', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '工号', '兼职类型', '兼职开始日期', '兼职机构', '兼职部门', '兼职直线经理',
      '兼职职务', '兼职结束日期', '任职状态', '审批状态', '操作',
    ]);
    expect(screen.getByText('虚构兼职员工')).toBeInTheDocument();
    expect(screen.getByText('F-001')).toBeInTheDocument();
    expect(screen.getByText('虚构兼职部门')).toBeInTheDocument();
    expect(screen.getByText('虚构兼职职务')).toBeInTheDocument();
    expect(screen.getByText('2026-08-01')).toBeInTheDocument();
    expect(screen.getByText('2026-12-31')).toBeInTheDocument();
    expect(screen.getByText('任职中')).toBeInTheDocument();
    expect(within(table).getAllByText('--')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('preserves URL filters and pagination in the API query', () => {
    renderPage('/employment/part-time?keyword=F-002&assignmentType=ADDITIONAL&startDateFrom=2026-08-01&startDateTo=2026-08-31&endDateFrom=2026-12-01&endDateTo=2026-12-31&page=3&pageSize=20');
    expect(usePartTimeAssignments).toHaveBeenLastCalledWith({
      keyword: 'F-002', assignmentType: 'ADDITIONAL', startDateFrom: '2026-08-01', startDateTo: '2026-08-31',
      endDateFrom: '2026-12-01', endDateTo: '2026-12-31', page: 3, pageSize: 20,
    });
  });

  it('writes a submitted keyword to URL-backed API state and resets the page', () => {
    renderPage('/employment/part-time?page=3&pageSize=20');
    const searchbox = screen.getByRole('searchbox', { name: '搜索兼职任职' });
    fireEvent.change(searchbox, { target: { value: '虚构姓名' } });
    fireEvent.keyDown(searchbox, { key: 'Enter', code: 'Enter' });
    expect(usePartTimeAssignments).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: '虚构姓名', page: 1, pageSize: 20 }));
  });

  it('shows loading failure and empty states', () => {
    usePartTimeAssignments.mockReturnValue({ data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }, isLoading: false, isError: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('没有符合条件的当前兼职任职记录')).toBeInTheDocument();
    cleanup();
    usePartTimeAssignments.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('网络错误'), refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('兼职管理加载失败')).toBeInTheDocument();
    expect(screen.getByText('网络错误')).toBeInTheDocument();
  });
});
