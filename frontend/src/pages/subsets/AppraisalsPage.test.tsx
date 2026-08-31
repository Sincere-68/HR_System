import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppraisalsPage } from './AppraisalsPage';

const useAppraisalList = vi.fn();

vi.mock('../../features/employee-subsets/api', () => ({
  useAppraisalList: (query: unknown) => useAppraisalList(query),
}));

const record = {
  id: 'appraisal-1', employeeId: 'employee-1', employeeName: '虚构员工甲', employeeNo: 'DEMO-1001',
  workEmail: 'fictional.appraisal@example.invalid', departmentName: '虚构研发部', appraisalYear: 2025,
  periodName: '2025年度/2025-Q1', performanceActivity: '虚构季度绩效活动', appraisalDepartment: null,
  finalScore: 0, startDate: null, endDate: null, canViewEmployeeDetail: true,
};

function renderPage(entry = '/subsets/appraisals') {
  return render(<MemoryRouter initialEntries={[entry]}><AppraisalsPage /></MemoryRouter>);
}

describe('AppraisalsPage', () => {
  beforeEach(() => {
    useAppraisalList.mockReset();
    useAppraisalList.mockReturnValue({
      data: { data: [record], meta: { page: 2, pageSize: 20, total: 41, totalPages: 3 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
  });
  afterEach(() => cleanup());

  it('renders the exact 12-column order and preserves a zero score', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '邮箱', '工号', '部门', '考核年度', '周期名称', '绩效活动', '考核部门',
      '最终得分', '起始日期', '截止日期', '操作',
    ]);
    expect(screen.getByText('fictional.appraisal@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('2025年度/2025-Q1')).toBeInTheDocument();
    expect(screen.getByText('虚构季度绩效活动')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(3);
    expect(screen.getByRole('link', { name: '查看' })).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('passes URL query and writes pagination back', () => {
    renderPage('/subsets/appraisals?keyword=DEMO&organizationId=org-a&page=2&pageSize=20');
    expect(useAppraisalList).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'DEMO', organizationId: 'org-a', page: 2, pageSize: 20,
    }));
    fireEvent.click(screen.getByTitle('Next Page'));
    expect(useAppraisalList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, pageSize: 20 }));
  });

  it('renders null score and unavailable detail, then the empty state', () => {
    useAppraisalList.mockReturnValue({
      data: { data: [{ ...record, finalScore: null, canViewEmployeeDetail: false }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    const view = renderPage();
    expect(screen.getAllByText('--')).toHaveLength(4);
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();

    view.unmount();
    useAppraisalList.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('没有符合条件的考核结果')).toBeInTheDocument();
  });
});
