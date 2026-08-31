import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from './ProjectsPage';

const useProjectList = vi.fn();

vi.mock('../../features/employee-subsets/api', () => ({
  useProjectList: (query: unknown) => useProjectList(query),
}));

const record = {
  id: 'project-1', employeeId: 'employee-1', employeeName: '虚构员工甲', employeeNo: 'DEMO-1001',
  workEmail: 'fictional.project@example.invalid', departmentName: '虚构研发部', startDate: '2024-02-01',
  endDate: null, projectName: '虚构人力资源平台项目', projectRole: '虚构项目负责人',
  description: '虚构项目经历描述', approvalStatus: null, canViewEmployeeDetail: true,
};

function renderPage(entry = '/subsets/projects') {
  return render(<MemoryRouter initialEntries={[entry]}><ProjectsPage /></MemoryRouter>);
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    useProjectList.mockReset();
    useProjectList.mockReturnValue({
      data: { data: [record], meta: { page: 2, pageSize: 20, total: 41, totalPages: 3 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
  });
  afterEach(() => cleanup());

  it('renders the exact 11-column order, work email, values, and nullable fields', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '邮箱', '工号', '部门', '开始日期', '结束日期', '项目名称', '职务', '描述', '审批状态', '操作',
    ]);
    expect(screen.getByText('fictional.project@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('虚构人力资源平台项目')).toBeInTheDocument();
    expect(screen.getByText('虚构项目负责人')).toBeInTheDocument();
    expect(screen.getByText('虚构项目经历描述')).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(2);
    expect(screen.getByRole('link', { name: '查看' })).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('passes URL query and writes pagination back', () => {
    renderPage('/subsets/projects?keyword=DEMO&organizationId=org-a&page=2&pageSize=20');
    expect(useProjectList).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'DEMO', organizationId: 'org-a', page: 2, pageSize: 20,
    }));
    fireEvent.click(screen.getByTitle('Next Page'));
    expect(useProjectList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, pageSize: 20 }));
  });

  it('renders unavailable detail and the empty state', () => {
    useProjectList.mockReturnValue({
      data: { data: [{ ...record, canViewEmployeeDetail: false }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    const view = renderPage();
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();

    view.unmount();
    useProjectList.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('没有符合条件的项目经历')).toBeInTheDocument();
  });
});
