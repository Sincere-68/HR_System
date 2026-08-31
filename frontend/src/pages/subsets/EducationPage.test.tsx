import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EducationPage } from './EducationPage';

const useEducationList = vi.fn();

vi.mock('../../features/employee-subsets/api', () => ({
  useEducationList: (query: unknown) => useEducationList(query),
}));

const record = {
  id: 'education-1', employeeId: 'employee-1', employeeName: '虚构员工甲', employeeNo: 'DEMO-1001',
  workEmail: 'fictional.employee@example.invalid', departmentName: '虚构研发部', startDate: '2018-09-01',
  endDate: '2022-06-30', schoolName: '虚构大学', schoolType: null, major: '虚构专业', educationLevel: '本科',
  degree: '学士', isHighestEducation: true, canViewEmployeeDetail: true,
};

function renderPage(entry = '/subsets/education') {
  return render(<MemoryRouter initialEntries={[entry]}><EducationPage /></MemoryRouter>);
}

describe('EducationPage', () => {
  beforeEach(() => {
    useEducationList.mockReset();
    useEducationList.mockReturnValue({
      data: { data: [record], meta: { page: 2, pageSize: 20, total: 41, totalPages: 3 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
  });
  afterEach(() => cleanup());

  it('renders the exact 13-column order and values', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '邮箱', '工号', '部门', '开始日期', '结束日期', '毕业学校名称', '毕业学校类型',
      '专业', '学历', '学位', '是否最高学历', '操作',
    ]);
    expect(screen.getByText('fictional.employee@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('虚构大学')).toBeInTheDocument();
    expect(screen.getByText('是')).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '查看' })).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('passes URL query and writes pagination back', () => {
    renderPage('/subsets/education?keyword=DEMO&organizationId=org-demo&page=2&pageSize=20');
    expect(useEducationList).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'DEMO', organizationId: 'org-demo', page: 2, pageSize: 20,
    }));
    fireEvent.click(screen.getByTitle('Next Page'));
    expect(useEducationList).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'DEMO', organizationId: 'org-demo', page: 3, pageSize: 20,
    }));
  });

  it('renders unavailable detail', () => {
    useEducationList.mockReturnValue({ data: { data: [{ ...record, canViewEmployeeDetail: false }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }, isLoading: false, isError: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();
  });

  it('renders the empty state returned by the hook', () => {
    useEducationList.mockReturnValue({ data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }, isLoading: false, isError: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('没有符合条件的教育经历')).toBeInTheDocument();
  });
});
