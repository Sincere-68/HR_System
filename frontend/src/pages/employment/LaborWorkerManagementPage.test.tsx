import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LaborWorkerManagementPage } from './LaborWorkerManagementPage';

const useLaborWorkers = vi.fn();
const useEmploymentConversions = vi.fn();
const useEmploymentConversion = vi.fn();
const useEmploymentViewCounts = vi.fn();
const createConversion = vi.fn();
const useOrganizations = vi.fn();
const useEmployeeFormOptions = vi.fn();
const activateConversion = vi.fn();
vi.mock('../../features/employment/api', () => ({
  useLaborWorkers: (query: unknown) => useLaborWorkers(query),
}));
vi.mock('../../features/employment-foundation/api', () => ({
  useEmploymentConversions: (query: unknown) => useEmploymentConversions(query),
  useEmploymentConversion: (id: string, enabled?: boolean) => useEmploymentConversion(id, enabled),
  useEmploymentViewCounts: (query: unknown) => useEmploymentViewCounts(query),
  useCreateEmploymentConversion: () => ({ mutateAsync: createConversion, isPending: false }),
  useActivateEmploymentConversion: () => ({ mutateAsync: activateConversion, isPending: false }),
}));
vi.mock('../../features/employees/api', () => ({
  useOrganizations: () => useOrganizations(),
  useEmployeeFormOptions: (excludeEmployeeId?: string, enabled?: boolean) => useEmployeeFormOptions(excludeEmployeeId, enabled),
}));

const row = {
  id: 'period-labor-1',
  employeeId: 'employee-labor-1',
  employeeName: '虚构劳务人员',
  workEmail: 'fictional.labor@example.invalid',
  employeeNo: 'L-001',
  entryDate: '2026-08-01',
  departmentName: '虚构部门',
  jobTitleName: '虚构职务',
  workArrangement: 'LABOR_EMPLOYMENT' as const,
  managerName: '虚构经理',
  workplaceName: '虚构工作地点',
  canViewEmployeeDetail: true,
};

function renderPage(entry = '/employment/labor') {
  return render(<MemoryRouter initialEntries={[entry]}><LaborWorkerManagementPage /></MemoryRouter>);
}

describe('LaborWorkerManagementPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    cleanup();
    useLaborWorkers.mockReset();
    useEmploymentConversions.mockReset();
    useEmploymentConversion.mockReset();
    useEmploymentViewCounts.mockReset();
    createConversion.mockReset();
    activateConversion.mockReset();
    useOrganizations.mockReset();
    useEmployeeFormOptions.mockReset();
    useLaborWorkers.mockReturnValue({
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

  it('keeps the exact required column order and renders the company email', () => {
    renderPage();
    const table = screen.getAllByRole('table')[0]!;
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '电子邮箱', '工号', '入职日期', '部门', '职务', '用工形式', '直线经理', '工作地点', '操作',
    ]);
    expect(screen.getByText('虚构劳务人员')).toBeInTheDocument();
    expect(screen.getByText('fictional.labor@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('L-001')).toBeInTheDocument();
    expect(screen.getByText('虚构职务')).toBeInTheDocument();
    expect(screen.getByText('劳务用工')).toBeInTheDocument();
    expect(screen.getByText('虚构经理')).toBeInTheDocument();
    expect(screen.getByText('虚构工作地点')).toBeInTheDocument();
    expect(within(table).queryByText('--')).not.toBeInTheDocument();
    expect(screen.queryByText(/电子邮箱取同一员工主档案/)).not.toBeInTheDocument();
    expect(screen.queryByText(/电子邮箱尚未确认/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-labor-1');
  });

  it('renders the Beisen dashboard, compact filters, and conversion management actions', () => {
    renderPage();

    expect(screen.getByText('在岗劳务人员')).toBeInTheDocument();
    expect(screen.getByText('转正式中')).toBeInTheDocument();
    expect(screen.getByText('已转正式')).toBeInTheDocument();
    expect(screen.getByText('已离职')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '筛选人员' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '筛选电子邮箱' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '筛选部门' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /申请劳务转正式/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /导入/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /导出/ })).toBeDisabled();
  });

  it('loads conversion rows with the authoritative in-progress view and exact type', () => {
    useEmploymentConversions.mockReturnValue({
      data: { data: [{ id: 'conversion-1', type: 'LABOR_TO_EMPLOYEE', status: 'PENDING', plannedEffectiveDate: '2026-10-01', employee: { id: 'employee-labor-1', employeeNo: 'L-001', name: '待转正式劳务人员' }, source: { employmentPeriodId: 'period-labor-1', sequenceNo: 1, employmentRelationship: 'LABOR_WORKER', entryDate: '2026-08-01', organization: { id: 'org-source', name: '劳务部门' }, position: null, jobTitle: { id: 'title-source', name: '劳务职务', code: 'TITLE-SOURCE' }, jobLevel: null }, target: { organization: { id: 'org-target', name: '正式部门', code: 'ORG-TARGET' }, position: null, jobTitle: null, jobLevel: null }, approval: null, canActivate: false, canViewEmployeeDetail: true }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }, isLoading: false, isError: false, refetch: vi.fn() });
    renderPage('/employment/labor?view=conversion-pending');

    expect(useEmploymentConversions).toHaveBeenCalledWith(expect.objectContaining({ view: 'in_progress', type: 'LABOR_TO_EMPLOYEE' }));
    expect(screen.getByText('待转正式劳务人员')).toBeInTheDocument();
    expect(screen.queryByText('该视图暂不可用')).not.toBeInTheDocument();
  });

  it('shows conversion detail and the canActivate confirmation action', () => {
    const conversion = { id: 'conversion-1', type: 'LABOR_TO_EMPLOYEE', status: 'PENDING_EFFECTIVE', plannedEffectiveDate: '2026-09-01', employee: { id: 'employee-labor-1', employeeNo: 'L-001', name: '待生效劳务人员' }, source: { employmentPeriodId: 'period-labor-1', sequenceNo: 1, employmentRelationship: 'LABOR_WORKER', entryDate: '2026-08-01', organization: { id: 'org-source', name: '劳务部门' }, position: null, jobTitle: null, jobLevel: null }, target: { organization: { id: 'org-target', name: '正式部门', code: 'ORG-TARGET' }, position: null, jobTitle: null, jobLevel: null }, approval: null, canActivate: true, canViewEmployeeDetail: true, approvalSteps: [] };
    useEmploymentConversions.mockReturnValue({ data: { data: [conversion], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }, isLoading: false, isError: false, refetch: vi.fn() });
    useEmploymentConversion.mockReturnValue({ data: conversion, isLoading: false, isError: false });
    renderPage('/employment/labor?view=conversion-pending');
    fireEvent.click(screen.getByRole('button', { name: /查看转换申请/ }));
    expect(screen.getByRole('dialog', { name: '转换申请详情' })).toHaveTextContent('待生效劳务人员');
    expect(screen.getByRole('button', { name: /确认生效/ })).toBeInTheDocument();
  });

  it('queries the authoritative resigned view for terminated labor workers', () => {
    renderPage('/employment/labor?view=terminated&keyword=L-002&entryDateFrom=2026-08-01&entryDateTo=2026-08-31&page=2&pageSize=20');

    expect(useLaborWorkers).toHaveBeenLastCalledWith({
      view: 'resigned',
      keyword: 'L-002',
      entryDateFrom: '2026-08-01',
      entryDateTo: '2026-08-31',
      page: 2,
      pageSize: 20,
    });
    expect(screen.getByText('虚构劳务人员')).toBeInTheDocument();
    expect(screen.queryByText('该视图暂不可用')).not.toBeInTheDocument();
  });

  it('does not show an unsupported count as zero', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /转正式中/ })).toHaveTextContent('—');
    expect(screen.getByRole('button', { name: /已转正式/ })).toHaveTextContent('—');
    expect(screen.getByRole('button', { name: /已离职/ })).toHaveTextContent('—');
  });

  it('keeps the current total when the terminated history query returns its own total', async () => {
    useLaborWorkers.mockImplementation((query: { view?: string }) => {
      const total = query.view === 'resigned' ? 7 : 2;
      return {
        data: { data: [row], meta: { page: 1, pageSize: 10, total, totalPages: 1 } },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: '在岗劳务人员' })).toHaveTextContent('2'));

    fireEvent.click(screen.getByRole('button', { name: '已离职' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '在岗劳务人员' })).toHaveTextContent('2');
      expect(screen.getByRole('button', { name: '已离职' })).toHaveTextContent('7');
    });
  });

  it('does not expose the detail link when current employee scope denies it', () => {
    useLaborWorkers.mockReturnValue({
      data: {
        data: [{ ...row, canViewEmployeeDetail: false }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.queryByRole('link', { name: /查看/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();
  });

  it('renders -- when the company email has not been entered', () => {
    useLaborWorkers.mockReturnValue({
      data: {
        data: [{ ...row, workEmail: null }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(within(document.querySelector('.labor-worker-table') as HTMLElement).getAllByText('--')).toHaveLength(1);
  });

  it('preserves URL filters and pagination in the API query', () => {
    renderPage('/employment/labor?keyword=L-002&entryDateFrom=2026-08-01&entryDateTo=2026-08-31&page=3&pageSize=20');
    expect(useLaborWorkers).toHaveBeenLastCalledWith({
      keyword: 'L-002',
      entryDateFrom: '2026-08-01',
      entryDateTo: '2026-08-31',
      page: 3,
      pageSize: 20,
    });
  });

  it('writes a submitted keyword to URL-backed API state and resets the page', async () => {
    renderPage('/employment/labor?page=3&pageSize=20');
    const searchbox = screen.getByRole('searchbox', { name: '筛选人员' });
    fireEvent.input(searchbox, { target: { value: '虚构姓名' } });
    await waitFor(() => expect(searchbox).toHaveValue('虚构姓名'));
    fireEvent.click(screen.getByRole('button', { name: 'search' }));
    await waitFor(() => expect(useLaborWorkers).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: '虚构姓名', page: 1, pageSize: 20,
    })));
  });

  it('shows the explicit empty state', () => {
    useLaborWorkers.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('没有符合条件的当前劳务人员任职记录')).toBeInTheDocument();
  });
});
