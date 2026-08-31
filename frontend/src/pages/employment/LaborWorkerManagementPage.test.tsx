import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LaborWorkerManagementPage } from './LaborWorkerManagementPage';

const useLaborWorkers = vi.fn();
vi.mock('../../features/employment/api', () => ({
  useLaborWorkers: (query: unknown) => useLaborWorkers(query),
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
  beforeEach(() => {
    cleanup();
    useLaborWorkers.mockReset();
    useLaborWorkers.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('keeps the exact required column order and renders the company email', () => {
    renderPage();
    const table = screen.getByRole('table');
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

    expect(within(screen.getByRole('table')).getAllByText('--')).toHaveLength(1);
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
    const searchbox = screen.getByRole('searchbox', { name: '搜索劳务人员' });
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
