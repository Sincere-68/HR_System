import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkHistoryPage } from './WorkHistoryPage';

const useWorkHistoryList = vi.fn();

vi.mock('../../features/employee-subsets/api', () => ({
  useWorkHistoryList: (query: unknown) => useWorkHistoryList(query),
}));

const record = {
  id: 'work-1', employeeId: 'employee-1', employeeName: '虚构员工乙', employeeNo: 'DEMO-1002',
  workEmail: 'fictional.work@example.invalid', departmentName: '虚构运营部', companyName: '虚构科技公司',
  jobTitleName: '虚构岗位', startDate: '2020-01-01', endDate: null, referenceName: null,
  approvalStatus: null, canViewEmployeeDetail: false,
};

function renderPage(entry = '/subsets/work-history') {
  return render(<MemoryRouter initialEntries={[entry]}><WorkHistoryPage /></MemoryRouter>);
}

describe('WorkHistoryPage', () => {
  beforeEach(() => {
    useWorkHistoryList.mockReset();
    useWorkHistoryList.mockReturnValue({ data: { data: [record], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }, isLoading: false, isError: false, refetch: vi.fn() });
  });
  afterEach(() => cleanup());

  it('renders the exact 11-column order and work-history values', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '邮箱', '工号', '当前任职部门', '单位名称', '职务', '开始日期', '结束日期', '证明人', '审批状态', '操作',
    ]);
    expect(screen.getByText('fictional.work@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('虚构岗位')).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();
  });

  it('passes the full URL query and writes pagination back', () => {
    useWorkHistoryList.mockReturnValue({ data: { data: [record], meta: { page: 2, pageSize: 20, total: 41, totalPages: 3 } }, isLoading: false, isError: false, refetch: vi.fn() });
    renderPage('/subsets/work-history?keyword=DEMO&organizationId=org-demo&page=2&pageSize=20');
    expect(useWorkHistoryList).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'DEMO', organizationId: 'org-demo', page: 2, pageSize: 20,
    }));
    fireEvent.click(screen.getByTitle('Next Page'));
    expect(useWorkHistoryList).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'DEMO', organizationId: 'org-demo', page: 3, pageSize: 20,
    }));
  });

  it('renders the empty state returned by the hook', () => {
    useWorkHistoryList.mockReturnValue({ data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }, isLoading: false, isError: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('没有符合条件的工作履历')).toBeInTheDocument();
  });
});
