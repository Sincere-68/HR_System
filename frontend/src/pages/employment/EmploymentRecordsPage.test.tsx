import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmploymentRecordsPage } from './EmploymentRecordsPage';

const useEmploymentRecords = vi.fn();
const useOrganizations = vi.fn();
const apiRequest = vi.fn();

vi.mock('../../features/employment/api', () => ({
  useEmploymentRecords: (query: unknown) => useEmploymentRecords(query),
}));
vi.mock('../../features/employees/api', () => ({
  useOrganizations: () => useOrganizations(),
}));
vi.mock('../../lib/api', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

const row = {
  id: 'assignment-1',
  employeeId: 'employee-1',
  employeeNo: 'F-001',
  employeeName: '虚构员工',
  entryDate: '2026-07-15',
  departmentName: '虚构部门',
  positionName: '虚构岗位',
  positionStartDate: '2026-08-01',
  positionEndDate: null,
  personnelLocator: null,
  personnelStatus: 'REGULAR',
  assignmentStatus: 'ACTIVE',
  approvalStatus: null,
  isLatestPrimaryRecord: true,
  interviewEvaluation: null,
  availability: 'AVAILABLE',
  canViewEmployeeDetail: true,
};

const inaccessibleHistoryRow = {
  ...row,
  id: 'assignment-history-1',
  employeeId: 'employee-history-1',
  employeeNo: 'H-001',
  employeeName: '历史员工',
  assignmentStatus: 'ENDED',
  canViewEmployeeDetail: false,
};

function renderPage(entry = '/employment/records') {
  return render(<MemoryRouter initialEntries={[entry]}><EmploymentRecordsPage /></MemoryRouter>);
}

describe('EmploymentRecordsPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useEmploymentRecords.mockReset();
    useOrganizations.mockReset();
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({});
    useEmploymentRecords.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useOrganizations.mockReturnValue({ data: [{ id: 'org-a', name: '虚构部门' }], isLoading: false });
  });

  it('renders current and history tabs while keeping the required 15-column order', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: '任职记录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '当前有效' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '完整历史' })).toBeInTheDocument();
    for (const action of ['导入', '批量编辑', '导出']) {
      expect(screen.getByRole('button', { name: action })).toBeDisabled();
    }
    expect(screen.getByRole('searchbox', { name: '筛选姓名' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '筛选电子邮件' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '筛选任职状态' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '筛选任职部门' })).toBeInTheDocument();

    const headerTable = [...document.querySelectorAll<HTMLTableElement>('.employment-records-table table')]
      .find((candidate) => candidate.querySelector('thead')) as HTMLTableElement;
    const bodyTable = [...document.querySelectorAll<HTMLTableElement>('.employment-records-table table')]
      .find((candidate) => candidate.querySelector('tbody .ant-table-row')) as HTMLTableElement;
    expect(headerTable).not.toBeNull();
    expect(bodyTable).not.toBeNull();
    expect(within(headerTable).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '工号', '姓名', '入职日期', '任职部门', '任职职位', '现岗位开始日期', '现岗位结束日期',
      '人员定位', '人员状态', '任职状态', '审批状态', '是否最新主职记录', '面试评价', '简历信息', '操作',
    ]);
    expect(within(bodyTable).getByText('F-001')).toBeInTheDocument();
    expect(within(bodyTable).getByText('虚构岗位')).toBeInTheDocument();
    expect(within(bodyTable).getByText('正式')).toBeInTheDocument();
    expect(within(bodyTable).getByText('任职中')).toBeInTheDocument();
    expect(within(bodyTable).getByText('是')).toBeInTheDocument();
    expect(within(bodyTable).getByText('有附件')).toBeInTheDocument();
    expect(within(bodyTable).getAllByText('--')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('defaults to current and falls back to current for an invalid view', () => {
    renderPage('/employment/records?view=unsupported&page=3');

    expect(useEmploymentRecords).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'current',
      page: 3,
    }));
    expect(screen.getByRole('button', { name: '当前有效' })).toHaveAttribute('aria-current', 'page');
  });

  it('preserves URL filters and pagination when explicitly loading history', () => {
    renderPage('/employment/records?view=history&keyword=F-002&organizationId=org-a&personnelStatus=REGULAR&assignmentStatus=ENDED&startDateFrom=2026-08-01&startDateTo=2026-08-31&page=3&pageSize=20');
    expect(useEmploymentRecords).toHaveBeenLastCalledWith({
      view: 'history',
      keyword: 'F-002',
      organizationId: 'org-a',
      personnelStatus: 'REGULAR',
      assignmentStatus: 'ENDED',
      startDateFrom: '2026-08-01',
      startDateTo: '2026-08-31',
      page: 3,
      pageSize: 20,
    });
  });

  it('switches tabs and resets the page while preserving filters', async () => {
    const user = userEvent.setup();
    renderPage('/employment/records?keyword=F-002&page=3&pageSize=20');

    await user.click(screen.getByRole('button', { name: '完整历史' }));

    expect(useEmploymentRecords).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'history',
      keyword: 'F-002',
      page: 1,
      pageSize: 20,
    }));
  });

  it('resets pagination when a connected filter changes', async () => {
    const user = userEvent.setup();
    renderPage('/employment/records?view=history&assignmentStatus=ENDED&page=4');

    await user.click(screen.getByRole('combobox', { name: '筛选任职状态' }));
    await user.click(await screen.findByText('任职中', { selector: '.ant-select-item-option-content' }));

    expect(useEmploymentRecords).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'history',
      assignmentStatus: 'ACTIVE',
      page: 1,
    }));
  });

  it('does not link inaccessible history rows to current employee details', () => {
    useEmploymentRecords.mockReturnValue({
      data: { data: [inaccessibleHistoryRow], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage('/employment/records?view=history');

    expect(screen.getByRole('button', { name: '暂无当前详情' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /查看任职记录/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /当前详情/ })).not.toBeInTheDocument();
  });

  it('renders nested organization and position fields in the read-only history detail drawer', async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue({
      id: row.id,
      employeeName: row.employeeName,
      organization: { id: 'org-history-1', code: 'ORG-HISTORY', name: '历史任职部门' },
      position: { id: 'position-history-1', name: '历史任职职位' },
      assignmentStatus: row.assignmentStatus,
    });
    renderPage('/employment/records?view=history');

    await user.click(screen.getByRole('button', { name: /查看任职记录/ }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/employment/records/${row.id}`));
    const drawer = screen.getByRole('dialog', { name: '任职记录详情' });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByText('只读详情')).toBeInTheDocument();
    expect(within(drawer).getByText('历史任职部门')).toBeInTheDocument();
    expect(within(drawer).getByText('历史任职职位')).toBeInTheDocument();
  });

  it('reveals unavailable advanced filters without pretending they are connected to a query', async () => {
    const user = userEvent.setup();
    renderPage('/employment/records?assignmentStatus=ENDED');

    await user.click(screen.getByRole('button', { name: '高级筛选' }));

    expect(screen.getByRole('combobox', { name: '筛选业务类型' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '筛选审批状态' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '筛选是否当前生效' })).toBeDisabled();
    expect(useEmploymentRecords).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'current', assignmentStatus: 'ENDED',
    }));
  });
});
