import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PartTimeManagementPage } from './PartTimeManagementPage';

const usePartTimeRecords = vi.fn();
const useEmploymentViewCounts = vi.fn();
vi.mock('../../features/employment-foundation/api', () => ({
  usePartTimeRecords: (query: unknown) => usePartTimeRecords(query),
  useEmploymentViewCounts: (query: unknown) => useEmploymentViewCounts(query),
}));

const useAllEmployees = vi.fn();
const useEmployeeFormOptions = vi.fn();
const useOrganizations = vi.fn();
vi.mock('../../features/employees/api', () => ({
  useAllEmployees: (query: unknown) => useAllEmployees(query),
  useEmployeeFormOptions: (employeeId?: string, enabled?: boolean) => useEmployeeFormOptions(employeeId, enabled),
  useOrganizations: () => useOrganizations(),
}));

vi.mock('../../components/OrganizationTreeSelect', () => ({
  OrganizationTreeSelect: ({ 'aria-label': ariaLabel, value, onChange, disabled }: { 'aria-label': string; value?: string; onChange?: (value: string) => void; disabled?: boolean }) => (
    <select aria-label={ariaLabel} value={value ?? ''} disabled={disabled} onChange={(event) => onChange?.(event.target.value)}>
      <option value="">部门</option>
      <option value="org-1">兼职组织</option>
    </select>
  ),
}));

vi.mock('../../features/employment-foundation/PartTimeRecordDrawer', () => ({
  PartTimeRecordDrawer: ({ open, recordId, onClose, employee }: { open: boolean; recordId?: string; onClose: () => void; employee: { name: string | null } }) => open ? (
    <div role="dialog" aria-label={recordId ? '兼职记录详情' : '新增兼职记录'}>
      <span>{employee.name}</span>
      {recordId ? <><button type="button" aria-label="生效">生效</button><button type="button" aria-label="结束兼职">结束兼职</button></> : <button type="button">保存</button>}
      <button type="button" onClick={onClose}>关闭</button>
    </div>
  ) : null,
}));

const record = {
  id: 'part-time-1',
  employee: { id: 'employee-1', employeeNo: 'F-001', name: '虚构兼职员工' },
  type: '项目顾问',
  institution: '虚构兼职机构',
  organization: { id: 'org-1', name: '虚构兼职部门' },
  jobTitle: { id: 'job-title-1', code: 'CONSULTANT', name: '虚构兼职职务' },
  managerEmployee: { id: 'manager-1', employeeNo: 'M-001', name: '虚构兼职经理' },
  startDate: '2026-08-01',
  endDate: '2026-12-31',
  status: 'ACTIVE' as const,
  approval: {
    id: 'approval-1',
    status: 'PENDING' as const,
    employmentStatus: 'PENDING' as const,
    currentStep: 1,
    currentApproverName: '虚构审批人',
    submittedAt: '2026-07-20T00:00:00.000Z',
    completedAt: null,
  },
  canActivate: false,
  canEnd: true,
};

const employees = {
  data: {
    data: [{ id: 'employee-1', employeeNo: 'F-001', name: '虚构兼职员工' }],
    meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
  },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

const counts = {
  data: {
    businessDate: '2026-09-23',
    scope: { organizationId: null, organizationMode: 'ALL_DATA' as const },
    items: [
      ['active', 3], ['expiring', 2], ['not_started', 1], ['ended', 4], ['approval', 5], ['all', 6],
    ].map(([view, count]) => ({ key: `part-time.${view}`, label: view, supported: true, count, reason: null })),
  },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

function renderPage(entry = '/employment/part-time') {
  return render(<MemoryRouter initialEntries={[entry]}><PartTimeManagementPage /></MemoryRouter>);
}

describe('PartTimeManagementPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    usePartTimeRecords.mockReset();
    usePartTimeRecords.mockReturnValue({
      data: { data: [record], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useEmploymentViewCounts.mockReset();
    useEmploymentViewCounts.mockReturnValue(counts);
    useAllEmployees.mockReset();
    useAllEmployees.mockReturnValue(employees);
    useEmployeeFormOptions.mockReset();
    useEmployeeFormOptions.mockReturnValue({ data: { managers: [{ id: 'manager-1', employeeNo: 'M-001', name: '虚构兼职经理' }], jobTitles: [{ id: 'job-title-1', code: 'CONSULTANT', name: '虚构兼职职务' }] }, isLoading: false, isError: false });
    useOrganizations.mockReset();
    useOrganizations.mockReturnValue({ data: [{ id: 'org-1', code: 'ORG-1', name: '兼职组织', parentId: null }], isLoading: false, isError: false, refetch: vi.fn() });
  });

  it('renders six views, live record fields, and disabled direct actions with reasons', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: '兼职管理' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '兼职管理视图' })).toHaveTextContent(
      '兼职中3即将到期2未开始1已结束4审批中的兼职5全部兼职记录6',
    );
    expect(screen.getByRole('button', { name: '新增兼职申请' })).not.toBeDisabled();
    for (const [action, reason] of [
      ['新增兼职', '直接新增兼职暂不可用'],
      ['批量结束兼职', '批量结束兼职暂不可用'],
      ['导出', '兼职记录导出暂不可用'],
      ['导入兼职记录', '兼职记录导入暂不可用'],
    ] as const) {
      const button = screen.getByRole('button', { name: action });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', expect.stringContaining(reason));
    }

    const headerTable = [...document.querySelectorAll<HTMLTableElement>('.part-time-table table')]
      .find((candidate) => candidate.querySelector('thead')) as HTMLTableElement;
    expect(within(headerTable).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '工号', '兼职类型', '兼职开始日期', '兼职机构', '兼职部门', '兼职直线经理',
      '兼职职务', '兼职结束日期', '任职状态', '审批状态', '操作',
    ]);
    expect(screen.getByText('项目顾问')).toBeInTheDocument();
    expect(screen.getByText('虚构兼职机构')).toBeInTheDocument();
    expect(screen.getByText('虚构兼职经理')).toBeInTheDocument();
    expect(screen.getByText('审批中（虚构审批人）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看兼职记录/ })).toBeInTheDocument();
  });

  it('queries each authoritative foundation view and uses the shared counts query', () => {
    for (const view of ['active', 'expiring', 'not_started', 'ended', 'approval', 'all'] as const) {
      cleanup();
      renderPage(`/employment/part-time?view=${view}&keyword=F-002&organizationId=org-1&page=2&pageSize=20`);
      expect(usePartTimeRecords).toHaveBeenLastCalledWith({
        view,
        keyword: 'F-002',
        organizationId: 'org-1',
        page: 2,
        pageSize: 20,
      });
      expect(useEmploymentViewCounts).toHaveBeenLastCalledWith({ organizationId: 'org-1' });
    }
  });

  it('uses the organization tree filter and updates the URL-backed records query', () => {
    renderPage('/employment/part-time?page=3&pageSize=20');
    fireEvent.change(screen.getByRole('combobox', { name: '筛选兼职部门' }), { target: { value: 'org-1' } });
    expect(usePartTimeRecords).toHaveBeenLastCalledWith(expect.objectContaining({ organizationId: 'org-1', page: 1, pageSize: 20 }));
  });

  it('opens an application employee picker and the record drawer form', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '新增兼职申请' }));
    expect(screen.getByRole('dialog', { name: '新增兼职申请' })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '申请员工' }));
    fireEvent.click(await screen.findByText('虚构兼职员工（F-001）', { selector: '.ant-select-item-option-content' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '新增兼职申请' })).getByText('继 续'));
    expect(await screen.findByRole('dialog', { name: '新增兼职记录' })).toBeInTheDocument();
  });

  it('opens one record detail so its activate and end actions remain available', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /查看兼职记录/ }));
    const drawer = await screen.findByRole('dialog', { name: '兼职记录详情' });
    expect(within(drawer).getByRole('button', { name: '生效' })).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: '结束兼职' })).toBeInTheDocument();
  });

  it('shows loading failures and empty states from the records endpoint', () => {
    usePartTimeRecords.mockReturnValue({ data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }, isLoading: false, isError: false, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('没有符合条件的当前兼职记录')).toBeInTheDocument();
    cleanup();
    usePartTimeRecords.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('网络错误'), refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('兼职管理加载失败')).toBeInTheDocument();
    expect(screen.getByText('网络错误')).toBeInTheDocument();
  });
});
