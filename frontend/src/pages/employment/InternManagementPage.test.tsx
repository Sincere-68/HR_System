import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(cleanup);

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
    const tables = [...document.querySelectorAll<HTMLTableElement>('.intern-table table')];
    const headerTable = tables.find((candidate) => candidate.querySelector('thead')) as HTMLTableElement;
    const dataTable = tables.find((candidate) => candidate.querySelector('tbody .ant-table-row')) as HTMLTableElement;
    expect(headerTable).not.toBeNull();
    expect(dataTable).not.toBeNull();
    expect(within(headerTable).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '邮箱', '实习机构', '实习部门', '实习职位', '实习开始日期',
      '审批状态', '直线经理', '银行', '银行账号', '开户行支行', '操作',
    ]);
    expect(screen.getByText('虚构实习生')).toBeInTheDocument();
    expect(screen.getByText('虚构部门')).toBeInTheDocument();
    expect(screen.getByText('虚构岗位')).toBeInTheDocument();
    expect(screen.getByText('fictional.intern@example.invalid')).toBeInTheDocument();
    expect(within(dataTable).getAllByText('--')).toHaveLength(6);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('renders the reference tabs, notice, filters, and unavailable business actions', () => {
    renderPage();

    expect(screen.getByRole('navigation', { name: '实习生管理视图' }))
      .toHaveTextContent('实习生实习转正中已转正已离职');
    expect(screen.getByText(/当前页面仅展示当前有效实习任职记录/)).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '筛选人员' })).toHaveAttribute('placeholder', '人员');
    expect(screen.getByRole('textbox', { name: '筛选邮箱' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '筛选实习部门' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '筛选实习职位' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /批量实习转正/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /新增实习生/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /批量编辑/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /批量结束实习/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /更多操作/ })).toBeDisabled();
  });

  it('shows unsupported views without querying the current internship collection', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '实习转正中' }));

    expect(screen.getByText('该视图暂不可用')).toBeInTheDocument();
    expect(screen.getByText(/转换事件来源待确认/)).toBeInTheDocument();
    expect(screen.queryByText('虚构实习生')).not.toBeInTheDocument();
    expect(useInterns).toHaveBeenCalledTimes(1);
  });

  it('queries the authoritative resigned view for exited interns', () => {
    renderPage('/employment/interns?view=exited&keyword=F-002&startDateFrom=2026-08-01&startDateTo=2026-08-31&page=2&pageSize=20');

    expect(useInterns).toHaveBeenLastCalledWith({
      view: 'resigned',
      keyword: 'F-002',
      startDateFrom: '2026-08-01',
      startDateTo: '2026-08-31',
      page: 2,
      pageSize: 20,
    });
    expect(screen.getByText('虚构实习生')).toBeInTheDocument();
    expect(screen.queryByText('该视图暂不可用')).not.toBeInTheDocument();
  });

  it('explains the historical source instead of claiming exited interns are current', () => {
    renderPage('/employment/interns?view=exited');

    expect(screen.getByRole('heading', { name: '已离职' })).toBeInTheDocument();
    expect(screen.getByText(/已离职实习记录按退出日期的历史任职关系查询/)).toBeInTheDocument();
    expect(screen.queryByText(/当前页面仅展示当前有效实习任职记录/)).not.toBeInTheDocument();
  });

  it('keeps bank fields as placeholders even when an unsupported value is supplied', () => {
    useInterns.mockReturnValue({
      data: {
        data: [{ ...row, bankName: 'unexpected-value', bankAccountNumber: 'unexpected-value', bankBranchName: 'unexpected-value' }],
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
    const searchbox = screen.getByRole('searchbox', { name: '筛选人员' });
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
