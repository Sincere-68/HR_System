import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrialPostManagementPage } from './TrialPostManagementPage';

const useTrialPosts = vi.fn();
vi.mock('../../features/employment/api', () => ({ useTrialPosts: (query: unknown) => useTrialPosts(query) }));

const row = {
  id: 'trial-1', employeeId: 'employee-1', canViewEmployeeDetail: true,
  employeeNo: 'F-001', employeeName: '虚构员工', startDate: '2026-08-01', endDate: null,
  movementTypeName: null, departmentName: '虚构部门', jobTitleName: null,
  result: '通过', status: 'COMPLETED',
};

function renderPage(entry = '/employment/trial-post') {
  return render(<MemoryRouter initialEntries={[entry]}><TrialPostManagementPage /></MemoryRouter>);
}

describe('TrialPostManagementPage', () => {
  beforeEach(() => {
    useTrialPosts.mockReset();
    useTrialPosts.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('keeps the exact required column order, placeholders, result, and employee detail link', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '工号', '试岗开始日期', '试岗结束日期', '调动类型', '试岗部门', '试岗职务', '考核结果', '试岗状态', '操作',
    ]);
    expect(screen.getByText('虚构员工')).toBeInTheDocument();
    expect(screen.getByText('F-001')).toBeInTheDocument();
    expect(screen.getByText('虚构部门')).toBeInTheDocument();
    expect(screen.getByText('通过')).toBeInTheDocument();
    expect(within(table).getAllByText('--').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('preserves URL filters and pagination in the API query', () => {
    renderPage('/employment/trial-post?keyword=F-002&status=APPROVED&startDateFrom=2026-08-01&startDateTo=2026-08-31&endDateFrom=2026-09-01&endDateTo=2026-09-30&page=3&pageSize=20');
    expect(useTrialPosts).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'F-002', status: 'APPROVED', startDateFrom: '2026-08-01', startDateTo: '2026-08-31',
      endDateFrom: '2026-09-01', endDateTo: '2026-09-30', page: 3, pageSize: 20,
    }));
  });
});
