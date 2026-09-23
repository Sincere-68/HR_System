import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrialPostManagementPage } from './TrialPostManagementPage';

const useTrialPosts = vi.fn();
vi.mock('../../features/employment/api', () => ({
  useTrialPosts: (query: unknown) => useTrialPosts(query),
}));

const row = {
  id: 'trial-1',
  employeeId: 'employee-1',
  canViewEmployeeDetail: true,
  employeeNo: 'F-001',
  employeeName: '虚构员工',
  startDate: '2026-08-01',
  endDate: null,
  movementTypeName: null,
  departmentName: '虚构部门',
  jobTitleName: null,
  result: '通过',
  status: 'COMPLETED',
};

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current search">{location.search}</output>;
}

function renderPage(entry = '/employment/trial-post') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <TrialPostManagementPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('TrialPostManagementPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useTrialPosts.mockReset();
    useTrialPosts.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('renders the direct reference tabs and maps result views to the backend view query', async () => {
    const user = userEvent.setup();
    renderPage('/employment/trial-post?keyword=F-002&page=3&pageSize=20');

    expect(screen.getByRole('button', { name: '试岗中人员' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '考核中' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '试岗不通过' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '试岗通过' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部试岗记录' })).toBeInTheDocument();
    expect(useTrialPosts).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'F-002',
      status: 'DRAFT',
      page: 3,
      pageSize: 20,
    }));

    await user.click(screen.getByRole('button', { name: '试岗通过' }));

    expect(Object.fromEntries(new URLSearchParams(screen.getByLabelText('current search').textContent ?? ''))).toEqual({
      keyword: 'F-002',
      page: '1',
      pageSize: '20',
      view: 'passed',
    });
    expect(useTrialPosts).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'F-002',
      view: 'passed',
      status: undefined,
      page: 1,
      pageSize: 20,
    }));
  });

  it('labels the active result view in the page heading', () => {
    renderPage('/employment/trial-post?view=failed');

    expect(screen.getByRole('region', { name: '试岗不通过' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '试岗不通过' })).toBeInTheDocument();
  });

  it('keeps the reference column order and renders missing API fields as placeholders', () => {
    renderPage();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '工号', '试岗开始日期', '试岗结束日期', '调动类型', '试岗部门', '试岗职务', '考核结果', '试岗状态', '操作',
    ]);
    expect(screen.getByText('虚构员工')).toBeInTheDocument();
    expect(screen.getByText('F-001')).toBeInTheDocument();
    expect(screen.getByText('虚构部门')).toBeInTheDocument();
    expect(screen.getByText('通过')).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('preserves existing URL filters and keeps unavailable process actions disabled', () => {
    renderPage('/employment/trial-post?keyword=F-002&status=APPROVED&startDateFrom=2026-08-01&startDateTo=2026-08-31&endDateFrom=2026-09-01&endDateTo=2026-09-30&page=3&pageSize=20');
    expect(useTrialPosts).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'F-002',
      status: 'APPROVED',
      startDateFrom: '2026-08-01',
      startDateTo: '2026-08-31',
      endDateFrom: '2026-09-01',
      endDateTo: '2026-09-30',
      page: 3,
      pageSize: 20,
    }));
    expect(screen.getByRole('button', { name: '发起考核' })).toBeDisabled();
  });

  it('passes result views to the backend and renders a real empty result as zero rows', () => {
    useTrialPosts.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage('/employment/trial-post?view=failed&keyword=F-002&page=3');

    expect(useTrialPosts).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'F-002',
      view: 'failed',
      status: undefined,
      page: 3,
      pageSize: 10,
    }));
    expect(screen.queryByText('该视图暂不可用：当前接口未支持独立试岗结果筛选')).not.toBeInTheDocument();
    expect(screen.getByText('没有符合条件的试岗记录')).toBeInTheDocument();
    expect(screen.queryByText('虚构员工')).not.toBeInTheDocument();
  });

  it('keeps advanced start-date changes as a draft until confirmed or cancelled', async () => {
    const user = userEvent.setup();
    renderPage('/employment/trial-post?startDateFrom=2026-08-01&startDateTo=2026-08-31');

    await user.click(screen.getByRole('button', { name: /高级筛选/ }));
    const panel = document.querySelector('.employment-reference-advanced-filter');
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByRole('button', { name: /取\s*消/ })).toBeInTheDocument();
    await user.click(within(panel as HTMLElement).getByRole('button', { name: /取\s*消/ }));

    expect(screen.getByLabelText('current search')).toHaveTextContent(
      '?startDateFrom=2026-08-01&startDateTo=2026-08-31',
    );
  });
});
