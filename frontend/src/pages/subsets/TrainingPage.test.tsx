import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrainingPage } from './TrainingPage';

const useTrainingList = vi.fn();

vi.mock('../../features/employee-subsets/api', () => ({
  useTrainingList: (query: unknown) => useTrainingList(query),
}));

const record = {
  id: 'training-1', employeeId: 'employee-1', employeeName: '虚构员工甲', employeeNo: 'DEMO-1001',
  workEmail: 'fictional.training@example.invalid', departmentName: '虚构研发部', startDate: '2025-03-01',
  endDate: null, trainingName: '虚构安全培训', trainingProvider: null, trainingResult: '合格',
  approvalStatus: null, credits: null, canViewEmployeeDetail: true,
};

function renderPage(entry = '/subsets/training') {
  return render(<MemoryRouter initialEntries={[entry]}><TrainingPage /></MemoryRouter>);
}

describe('TrainingPage', () => {
  beforeEach(() => {
    useTrainingList.mockReset();
    useTrainingList.mockReturnValue({
      data: { data: [record], meta: { page: 2, pageSize: 20, total: 41, totalPages: 3 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
  });
  afterEach(() => cleanup());

  it('renders the exact 12-column order, work email, values, and nullable fields', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '邮箱', '工号', '部门', '开始日期', '结束日期', '名称', '培训机构', '培训成绩', '审批状态', '获得学分', '操作',
    ]);
    expect(screen.getByText('fictional.training@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('虚构安全培训')).toBeInTheDocument();
    expect(screen.getByText('合格')).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(4);
    expect(screen.getByRole('link', { name: '查看' })).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('passes URL query and writes pagination back', () => {
    renderPage('/subsets/training?keyword=DEMO&organizationId=org-a&page=2&pageSize=20');
    expect(useTrainingList).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'DEMO', organizationId: 'org-a', page: 2, pageSize: 20,
    }));
    fireEvent.click(screen.getByTitle('Next Page'));
    expect(useTrainingList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, pageSize: 20 }));
  });

  it('renders unavailable detail and the empty state', () => {
    useTrainingList.mockReturnValue({
      data: { data: [{ ...record, canViewEmployeeDetail: false }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    const view = renderPage();
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();

    view.unmount();
    useTrainingList.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('没有符合条件的培训经历')).toBeInTheDocument();
  });
});
