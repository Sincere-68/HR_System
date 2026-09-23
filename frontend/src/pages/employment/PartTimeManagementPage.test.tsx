import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(cleanup);

  beforeEach(() => {
    usePartTimeAssignments.mockReset();
    usePartTimeAssignments.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('renders the reference dashboard, disabled action shell, required filters, and exact column order', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: '兼职管理' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '兼职管理视图' })).toHaveTextContent(
      '兼职中1即将到期--未开始—已结束—全部兼职记录—审批中的兼职--',
    );
    for (const action of ['新增兼职', '新增兼职申请', '批量结束兼职', '导出', '导入兼职记录']) {
      expect(screen.getByRole('button', { name: action })).toBeDisabled();
    }
    expect(screen.getByRole('searchbox', { name: '筛选人员' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '筛选任职关系类型' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '筛选兼职类型' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '筛选兼职部门' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '筛选兼职职务' })).toBeDisabled();
    expect(screen.getAllByLabelText('筛选兼职开始日期')).toHaveLength(2);

    const headerTable = [...document.querySelectorAll<HTMLTableElement>('.part-time-table table')]
      .find((candidate) => candidate.querySelector('thead')) as HTMLTableElement;
    const bodyTable = [...document.querySelectorAll<HTMLTableElement>('.part-time-table table')]
      .find((candidate) => candidate.querySelector('tbody .ant-table-row')) as HTMLTableElement;
    expect(headerTable).not.toBeNull();
    expect(bodyTable).not.toBeNull();
    expect(within(headerTable).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
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
    expect(within(bodyTable).getAllByText('--')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('queries authoritative backend views for not-started, ended, and all assignments', () => {
    for (const [uiView, backendView] of [
      ['upcoming', 'not_started'],
      ['ended', 'ended'],
      ['all', 'all'],
    ] as const) {
      cleanup();
      renderPage(`/employment/part-time?view=${uiView}&keyword=F-002&page=2&pageSize=20`);
      expect(usePartTimeAssignments).toHaveBeenLastCalledWith({
        view: backendView,
        keyword: 'F-002',
        assignmentType: undefined,
        startDateFrom: undefined,
        startDateTo: undefined,
        endDateFrom: undefined,
        endDateTo: undefined,
        page: 2,
        pageSize: 20,
      });
      expect(screen.getByText('虚构兼职员工')).toBeInTheDocument();
      expect(screen.queryByText('该视图暂不可用')).not.toBeInTheDocument();
    }
  });

  it('shows unsupported part-time views without reusing the current collection', () => {
    renderPage();
    const callsBeforeSwitch = usePartTimeAssignments.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: /即将到期/ }));

    expect(screen.getByText('该视图暂不可用')).toBeInTheDocument();
    expect(screen.getByText(/兼职到期窗口来源待确认/)).toBeInTheDocument();
    expect(screen.queryByText('虚构兼职员工')).not.toBeInTheDocument();
    expect(usePartTimeAssignments).toHaveBeenCalledTimes(callsBeforeSwitch);
  });

  it('keeps the current total when an ended history query returns its own total', async () => {
    usePartTimeAssignments.mockImplementation((query: { view?: string }) => {
      const total = query.view === 'ended' ? 7 : 2;
      return {
        data: { data: [row], meta: { page: 1, pageSize: 10, total, totalPages: 1 } },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /兼职中/ })).toHaveTextContent('2'));

    fireEvent.click(screen.getByRole('button', { name: /已结束/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /兼职中/ })).toHaveTextContent('2');
      expect(screen.getByRole('button', { name: /已结束/ })).toHaveTextContent('7');
    });
  });

  it('preserves unsupported source fields as placeholders', () => {
    usePartTimeAssignments.mockReturnValue({
      data: {
        data: [{ ...row, partTimeType: 'unexpected-value', institutionName: 'unexpected-value', managerName: 'unexpected-value', approvalStatus: 'unexpected-value' }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.queryByText('unexpected-value')).not.toBeInTheDocument();
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
    const searchbox = screen.getByRole('searchbox', { name: '筛选人员' });
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
