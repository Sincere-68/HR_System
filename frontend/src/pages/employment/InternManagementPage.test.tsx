import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InternManagementPage } from './InternManagementPage';

const useInterns = vi.fn();
vi.mock('../../features/employment/api', () => ({
  useInterns: (query: unknown) => useInterns(query),
}));

const row = {
  id: 'period-1',
  employeeId: 'employee-1',
  employeeName: '虚构实习生',
  workEmail: 'fictional.intern@example.invalid',
  internshipOrganizationName: null,
  departmentName: '虚构部门',
  positionName: '虚构岗位',
  startDate: '2026-08-01',
  approvalStatus: null,
  managerName: null,
  bankName: null,
  bankAccountNumber: null,
  bankBranchName: null,
  canViewEmployeeDetail: true,
};

function renderPage(entry = '/employment/interns') {
  return render(<MemoryRouter initialEntries={[entry]}><InternManagementPage /></MemoryRouter>);
}

describe('InternManagementPage', () => {
  beforeEach(() => {
    cleanup();
    useInterns.mockReset();
    useInterns.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('keeps the exact required column order and renders real fields and placeholders', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '邮箱', '实习机构', '实习部门', '实习职位', '实习开始日期',
      '审批状态', '直线经理', '银行', '银行账号', '开户行支行', '操作',
    ]);
    expect(screen.getByText('虚构实习生')).toBeInTheDocument();
    expect(screen.getByText('虚构部门')).toBeInTheDocument();
    expect(screen.getByText('虚构岗位')).toBeInTheDocument();
    expect(screen.getByText('fictional.intern@example.invalid')).toBeInTheDocument();
    expect(within(table).getAllByText('--')).toHaveLength(6);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('preserves URL filters and pagination in the API query', () => {
    renderPage('/employment/interns?keyword=F-002&startDateFrom=2026-08-01&startDateTo=2026-08-31&page=3&pageSize=20');
    expect(useInterns).toHaveBeenLastCalledWith({
      keyword: 'F-002',
      startDateFrom: '2026-08-01',
      startDateTo: '2026-08-31',
      page: 3,
      pageSize: 20,
    });
  });

  it('writes a submitted keyword to URL-backed API state and resets the page', () => {
    renderPage('/employment/interns?page=3&pageSize=20');
    const searchbox = screen.getByRole('searchbox', { name: '搜索实习生' });
    fireEvent.change(searchbox, { target: { value: '虚构姓名' } });
    fireEvent.keyDown(searchbox, { key: 'Enter', code: 'Enter' });
    expect(useInterns).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: '虚构姓名', page: 1, pageSize: 20,
    }));
  });

  it('shows the explicit empty state', () => {
    useInterns.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('没有符合条件的实习生任职记录')).toBeInTheDocument();
  });
});
