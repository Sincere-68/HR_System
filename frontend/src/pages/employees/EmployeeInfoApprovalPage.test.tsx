import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeInfoApprovalPage } from './EmployeeInfoApprovalPage';

const useEmployeeInfoApprovals = vi.fn();
const useOrganizations = vi.fn();

vi.mock('../../features/employees/api', () => ({
  useEmployeeInfoApprovals: (query: unknown) => useEmployeeInfoApprovals(query),
  useOrganizations: () => useOrganizations(),
}));

const approval = {
  id: 'change-request-1',
  employeeId: 'employee-1',
  canViewEmployeeDetail: true,
  employeeName: '虚构审批员工',
  departmentName: '虚构产品部',
  activityName: null,
  applicantName: '虚构发起人',
  submittedAt: '2026-08-20T08:30:00.000Z',
  status: 'PENDING' as const,
  currentApproverName: '虚构审批人',
};

function renderPage(entry = '/personnel/approval') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <EmployeeInfoApprovalPage />
    </MemoryRouter>,
  );
}

describe('EmployeeInfoApprovalPage', () => {
  beforeEach(() => {
    useEmployeeInfoApprovals.mockReset();
    useOrganizations.mockReset();
    useEmployeeInfoApprovals.mockReturnValue({
      data: { data: [approval], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useOrganizations.mockReturnValue({
      data: [{ id: 'org-1', code: 'FAKE-PRODUCT', name: '虚构产品部', parentId: null }],
    });
  });

  it('keeps the required column order and renders only API-backed values', () => {
    renderPage();

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((heading) => heading.textContent?.trim()).filter(Boolean)).toEqual([
      '人员', '部门', '信息采集活动名称', '发起人', '发起时间', '信息采集状态', '当前审批人', '操作',
    ]);
    expect(screen.getByRole('link', { name: '虚构审批员工' })).toHaveAttribute(
      'href',
      '/personnel/employees/employee-1',
    );
    expect(screen.getByText('虚构发起人')).toBeInTheDocument();
    expect(screen.getByText('虚构审批人')).toBeInTheDocument();
    expect(within(table).getByText('--')).toBeInTheDocument();
  });

  it('uses URL-backed pagination and exposes a real employee view action', () => {
    renderPage('/personnel/approval?page=2&pageSize=20&departmentId=org-1');

    expect(useEmployeeInfoApprovals).toHaveBeenLastCalledWith(expect.objectContaining({
      departmentId: 'org-1',
      page: 2,
      pageSize: 20,
    }));
    expect(screen.getAllByRole('button', { name: /查看/ })[0]?.closest('a')).toHaveAttribute(
      'href',
      '/personnel/employees/employee-1',
    );
  });
});
