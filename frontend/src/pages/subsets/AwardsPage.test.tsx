import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AwardsPage } from './AwardsPage';

const useAwardList = vi.fn();

vi.mock('../../features/employee-subsets/api', () => ({
  useAwardList: (query: unknown) => useAwardList(query),
}));

const record = {
  id: 'award-1', employeeId: 'employee-1', employeeName: '虚构员工甲', employeeNo: 'DEMO-1001',
  workEmail: 'fictional.award@example.invalid', departmentName: '虚构研发部', awardDate: '2024-12-31',
  awardName: '虚构优秀贡献奖', summary: null, approvalStatus: null, canViewEmployeeDetail: true,
};

function renderPage(entry = '/subsets/awards') {
  return render(<MemoryRouter initialEntries={[entry]}><AwardsPage /></MemoryRouter>);
}

describe('AwardsPage', () => {
  beforeEach(() => {
    useAwardList.mockReset();
    useAwardList.mockReturnValue({
      data: { data: [record], meta: { page: 2, pageSize: 20, total: 41, totalPages: 3 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
  });
  afterEach(() => cleanup());

  it('renders the exact 9-column order, work email, values, and nullable fields', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '邮箱', '工号', '部门', '获奖日期', '奖项', '简述', '审批状态', '操作',
    ]);
    expect(screen.getByText('fictional.award@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('虚构优秀贡献奖')).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(2);
    expect(screen.getByRole('link', { name: '查看' })).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('passes URL query and writes pagination back', () => {
    renderPage('/subsets/awards?keyword=DEMO&organizationId=org-a&page=2&pageSize=20');
    expect(useAwardList).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'DEMO', organizationId: 'org-a', page: 2, pageSize: 20,
    }));
    fireEvent.click(screen.getByTitle('Next Page'));
    expect(useAwardList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, pageSize: 20 }));
  });

  it('renders unavailable detail and the empty state', () => {
    useAwardList.mockReturnValue({
      data: { data: [{ ...record, canViewEmployeeDetail: false }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    const view = renderPage();
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();

    view.unmount();
    useAwardList.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('没有符合条件的表彰与奖励')).toBeInTheDocument();
  });
});
