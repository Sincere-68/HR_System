import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RetirementManagementPage } from './RetirementManagementPage';

const useRetirements = vi.fn();
const useOrganizations = vi.fn();
vi.mock('../../features/employment/api', () => ({
  useRetirements: (query: unknown) => useRetirements(query),
}));
vi.mock('../../features/employees/api', () => ({
  useOrganizations: () => useOrganizations(),
}));

const row = {
  id: 'retirement-1',
  employeeId: 'employee-1',
  employeeName: '虚构员工',
  employeeNo: 'F-001',
  gender: 'FEMALE',
  age: 55,
  birthDate: '1970-08-26',
  plannedRetirementDate: '2030-08-24',
  departmentName: '虚构部门',
  jobTitleName: '虚构职务',
  canViewEmployeeDetail: true,
};

function renderPage(entry = '/employment/retirement') {
  return render(<MemoryRouter initialEntries={[entry]}><RetirementManagementPage /></MemoryRouter>);
}

describe('RetirementManagementPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useRetirements.mockReset();
    useOrganizations.mockReset();
    useRetirements.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useOrganizations.mockReturnValue({
      data: [{ id: 'org-a', name: '虚构部门' }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('keeps the exact nine-column order, renders real fields, and links employee detail', () => {
    renderPage();
    const tableSurface = document.querySelector('.retirement-table') as HTMLElement;
    const headerTable = within(tableSurface).getAllByRole('table')[0]!;
    expect(within(headerTable).getAllByRole('columnheader')
      .map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '工号', '性别', '年龄', '出生日期', '预计退休日期', '部门', '职务', '操作',
    ]);
    expect(screen.getByText('虚构员工')).toBeInTheDocument();
    expect(screen.getByText('F-001')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('1970-08-26')).toBeInTheDocument();
    expect(screen.getByText('2030-08-24')).toBeInTheDocument();
    expect(screen.getByText('虚构部门')).toBeInTheDocument();
    expect(screen.getByText('虚构职务')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看/ }).closest('a'))
      .toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('renders the Beisen retirement dashboard, filters, and disabled management actions', () => {
    renderPage();

    expect(screen.getByText('即将退休')).toBeInTheDocument();
    expect(screen.getByText('退休中员工')).toBeInTheDocument();
    expect(screen.getByText('过期未退休员工')).toBeInTheDocument();
    expect(screen.getByText('已完成的退休')).toBeInTheDocument();
    expect(screen.getByText('全部退休记录')).toBeInTheDocument();
    expect(screen.getByText('意向退休日期申请')).toBeInTheDocument();
    expect(screen.getByText('在此页面可查看临近预计退休日期尚未发起退休的人员。')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '筛选人员' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '筛选性别' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^退\s*休$/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '退休申请' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /导出/ })).toBeDisabled();
  });

  it('queries each authoritative retirement view', () => {
    for (const view of ['upcoming', 'in_progress', 'overdue', 'completed', 'all'] as const) {
      cleanup();
      renderPage(`/employment/retirement?view=${view}&keyword=F-002&page=2&pageSize=20`);
      expect(useRetirements).toHaveBeenLastCalledWith({
        view,
        keyword: 'F-002',
        status: undefined,
        plannedRetirementDateFrom: undefined,
        plannedRetirementDateTo: undefined,
        departmentId: undefined,
        page: 2,
        pageSize: 20,
      });
      expect(screen.getByText('虚构员工')).toBeInTheDocument();
      expect(screen.queryByText('该视图暂不可用')).not.toBeInTheDocument();
    }
  });

  it('keeps intention retirement applications unsupported', () => {
    renderPage('/employment/retirement?view=intention_application');

    expect(screen.getByText('该视图暂不可用')).toBeInTheDocument();
    expect(screen.getAllByText(/退休意向申请来源尚未接入/)).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(useRetirements).not.toHaveBeenCalled();
  });

  it('renders missing sourced fields and unavailable assignment values as placeholders', () => {
    useRetirements.mockReturnValue({
      data: {
        data: [{
          ...row,
          gender: null,
          age: null,
          birthDate: null,
          plannedRetirementDate: null,
          departmentName: null,
          jobTitleName: null,
        }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const view = renderPage();
    expect(within(view.container.querySelector('.retirement-table') as HTMLElement)
      .getAllByText('--')).toHaveLength(6);
  });

  it('shows the loaded retirement total only for the active view and unknown counts for other supported views', () => {
    renderPage();

    const dashboard = screen.getByLabelText('退休管理视图');
    expect(within(dashboard).getByText('即将退休').parentElement).toHaveTextContent('1');
    expect(within(dashboard).getByText('退休中员工').parentElement).toHaveTextContent('—');
    expect(within(dashboard).getByText('过期未退休员工').parentElement).toHaveTextContent('—');
    expect(within(dashboard).getByText('已完成的退休').parentElement).toHaveTextContent('—');
    expect(within(dashboard).getByText('全部退休记录').parentElement).toHaveTextContent('—');
    expect(within(dashboard).getByText('意向退休日期申请').parentElement).toHaveTextContent('--');
  });

  it('explains why the unsupported intention retirement view has no count', () => {
    renderPage();

    const dashboard = screen.getByLabelText('退休管理视图');
    expect(within(dashboard).getByText('暂不可用：退休意向申请来源尚未接入')).toBeInTheDocument();
  });

  it('preserves URL filters and pagination in the API query', () => {
    renderPage('/employment/retirement?keyword=F-002&status=APPROVED&plannedRetirementDateFrom=2030-01-01&plannedRetirementDateTo=2030-12-31&departmentId=org-a&page=3&pageSize=20');
    expect(useRetirements).toHaveBeenLastCalledWith({
      view: 'upcoming',
      keyword: 'F-002',
      status: 'APPROVED',
      plannedRetirementDateFrom: '2030-01-01',
      plannedRetirementDateTo: '2030-12-31',
      departmentId: 'org-a',
      page: 3,
      pageSize: 20,
    });
  });
});
