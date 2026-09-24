import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InternManagementPage } from './InternManagementPage';

const useInterns = vi.fn();
const useEmploymentConversions = vi.fn();
const useEmploymentConversion = vi.fn();
const useEmploymentViewCounts = vi.fn();
const createConversion = vi.fn();
const useOrganizations = vi.fn();
const useEmployeeFormOptions = vi.fn();
vi.mock('../../features/employment/api', () => ({
  useInterns: (query: unknown) => useInterns(query),
}));
vi.mock('../../features/employment-foundation/api', () => ({
  useEmploymentConversions: (query: unknown) => useEmploymentConversions(query),
  useEmploymentConversion: (id: string, enabled?: boolean) => useEmploymentConversion(id, enabled),
  useEmploymentViewCounts: (query: unknown) => useEmploymentViewCounts(query),
  useCreateEmploymentConversion: () => ({ mutateAsync: createConversion, isPending: false }),
  useActivateEmploymentConversion: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../features/employees/api', () => ({
  useOrganizations: () => useOrganizations(),
  useEmployeeFormOptions: (excludeEmployeeId?: string, enabled?: boolean) => useEmployeeFormOptions(excludeEmployeeId, enabled),
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
    useEmploymentConversions.mockReset();
    useEmploymentConversion.mockReset();
    useEmploymentViewCounts.mockReset();
    createConversion.mockReset();
    useOrganizations.mockReset();
    useEmployeeFormOptions.mockReset();
    useInterns.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useEmploymentConversions.mockReturnValue({ data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }, isLoading: false, isError: false, refetch: vi.fn() });
    useEmploymentConversion.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    useEmploymentViewCounts.mockReturnValue({ data: { items: [] }, isLoading: false, isError: false, refetch: vi.fn() });
    useOrganizations.mockReturnValue({ data: [{ id: 'org-1', code: 'ORG-1', name: '目标组织', parentId: null }], isLoading: false, isError: false, refetch: vi.fn() });
    useEmployeeFormOptions.mockReturnValue({ data: { positions: [{ id: 'position-1', name: '目标岗位' }], managers: [], jobTitles: [{ id: 'title-1', name: '目标职务', code: 'TITLE-1' }] }, isLoading: false, isError: false });
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
    expect(screen.getByText(/当前页面展示有效实习任职记录及转换申请/)).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '筛选人员' })).toHaveAttribute('placeholder', '人员');
    expect(screen.getByRole('textbox', { name: '筛选邮箱' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '筛选实习部门' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '筛选实习职位' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /申请实习转正/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /新增实习生/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /批量编辑/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /批量结束实习/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /更多操作/ })).toBeDisabled();
  });

  it('loads conversion rows with the authoritative in-progress view and exact type', () => {
    useEmploymentConversions.mockReturnValue({
      data: { data: [{ id: 'conversion-1', type: 'INTERN_TO_EMPLOYEE', status: 'PENDING', plannedEffectiveDate: '2026-10-01', employee: { id: 'employee-1', employeeNo: 'I-001', name: '待转正式实习生' }, source: { employmentPeriodId: 'period-1', sequenceNo: 1, employmentRelationship: 'INTERN', entryDate: '2026-08-01', organization: { id: 'org-source', name: '实习部门' }, position: { id: 'position-source', name: '实习岗位' }, jobTitle: null, jobLevel: null }, target: { organization: { id: 'org-target', name: '正式部门', code: 'ORG-TARGET' }, position: null, jobTitle: null, jobLevel: null }, approval: null, canActivate: false, canViewEmployeeDetail: true }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }, isLoading: false, isError: false, refetch: vi.fn() });
    renderPage('/employment/interns?view=converting');

    expect(useEmploymentConversions).toHaveBeenCalledWith(expect.objectContaining({ view: 'in_progress', type: 'INTERN_TO_EMPLOYEE' }));
    expect(screen.getByText('待转正式实习生')).toBeInTheDocument();
    expect(screen.queryByText('该视图暂不可用')).not.toBeInTheDocument();
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
