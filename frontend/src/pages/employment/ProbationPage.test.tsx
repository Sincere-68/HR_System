import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProbationPage } from './ProbationPage';

const useProbation = vi.fn();
vi.mock('../../features/employment/api', () => ({ useProbation: (query: unknown) => useProbation(query) }));

const row = {
  id: 'probation-1', employeeId: 'employee-1', canViewEmployeeDetail: true,
  employeeNo: 'F-001', employeeName: '虚构员工', departmentName: '虚构部门', positionName: null,
  startDate: '2026-08-01', plannedEndDate: '2026-11-01',
};

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current search">{location.search}</output>;
}

function renderPage(entry = '/employment/probation') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ProbationPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('ProbationPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useProbation.mockReset();
    useProbation.mockReturnValue({ data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }, isLoading: false, isError: false, refetch: vi.fn() });
  });

  it('keeps the required business column order and renders placeholders and detail link', () => {
    renderPage();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '工号', '姓名', '部门', '职位', '试用开始日期', '预计试用结束日期', '操作',
    ]);
    expect(screen.getByText('F-001')).toBeInTheDocument();
    expect(screen.getByText('虚构部门')).toBeInTheDocument();
    expect(within(table).getByText('--')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute('href', '/personnel/employees/employee-1');
  });

  it('preserves URL pagination and keyword query state', () => {
    renderPage('/employment/probation?keyword=F-002&page=3&pageSize=20');
    expect(useProbation).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: 'F-002', page: 3, pageSize: 20 }));
    expect(screen.getByRole('searchbox', { name: '搜索试用记录' })).toHaveValue('F-002');
  });

  it('syncs submitted keyword to the URL and API query', async () => {
    const user = userEvent.setup();
    renderPage('/employment/probation?view=all&page=3');

    const search = screen.getByRole('searchbox', { name: '搜索试用记录' });
    await user.type(search, '  F-003  {Enter}');

    const nextSearch = new URLSearchParams(screen.getByLabelText('current search').textContent ?? '');
    expect(Object.fromEntries(nextSearch)).toEqual({ view: 'all', page: '1', keyword: 'F-003' });
    expect(useProbation).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'all', keyword: 'F-003', page: 1,
    }));
  });

  it('keeps other URL filters while changing view and removes conflicting status', async () => {
    const user = userEvent.setup();
    renderPage('/employment/probation?view=all&keyword=F-002&status=PENDING&page=4&pageSize=20');

    await user.click(screen.getByRole('button', { name: '已转正' }));

    expect(screen.getByLabelText('current search')).toHaveTextContent('?view=completed&keyword=F-002&page=1&pageSize=20');
    expect(useProbation).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'completed', keyword: 'F-002', status: undefined, page: 1, pageSize: 20,
    }));
  });

  it('does not expose a detail link when the API cannot guarantee current access', () => {
    useProbation.mockReturnValue({
      data: { data: [{ ...row, canViewEmployeeDetail: false }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.queryByRole('link', { name: /查看/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();
  });
});
