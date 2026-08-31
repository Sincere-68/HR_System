import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlacklistPage } from './BlacklistPage';

const useBlacklist = vi.fn();

vi.mock('../../features/employees/api', () => ({
  useBlacklist: (query: unknown) => useBlacklist(query),
}));

const linkedRecord = {
  id: 'blacklist-1',
  employeeId: 'employee-1',
  canViewEmployeeDetail: true,
  name: '虚构黑名单人员',
  documentNumber: '110101199901015001',
  mobile: '13800005001',
  reason: '虚构测试原因',
  effectiveDate: '2026-08-01',
  expiryDate: '2027-08-01',
  workEmail: 'fictional.employee@example.invalid',
};

function renderPage(entry = '/personnel/blacklist') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <BlacklistPage />
    </MemoryRouter>,
  );
}

describe('BlacklistPage', () => {
  beforeEach(() => {
    useBlacklist.mockReset();
    useBlacklist.mockReturnValue({
      data: { data: [linkedRecord], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('keeps the required column order and renders API values as returned', () => {
    renderPage();

    const table = screen.getByRole('table');
    const headings = within(table).getAllByRole('columnheader')
      .map((heading) => heading.textContent?.trim());
    expect(headings.filter(Boolean)).toEqual([
      '姓名', '证件号码', '手机号', '加黑原因', '加黑日期', '有效截止日期', '邮箱', '操作',
    ]);
    expect(screen.getByText('110101199901015001')).toBeInTheDocument();
    expect(screen.getByText('13800005001')).toBeInTheDocument();
    expect(screen.getByText('fictional.employee@example.invalid')).toBeInTheDocument();
    expect(screen.getByText(/邮箱为关联员工的公司邮箱/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看/ }).closest('a')).toHaveAttribute(
      'href',
      '/personnel/employees/employee-1',
    );
  });

  it('shows an unavailable operation when no employee detail can exist', () => {
    useBlacklist.mockReturnValue({
      data: {
        data: [{
          ...linkedRecord,
          id: 'blacklist-2',
          employeeId: null,
          canViewEmployeeDetail: false,
          workEmail: null,
        }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage('/personnel/blacklist?page=2&pageSize=20');

    expect(useBlacklist).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 20 }));
    expect(screen.getByRole('button', { name: '暂无详情' })).toBeDisabled();
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });
});
