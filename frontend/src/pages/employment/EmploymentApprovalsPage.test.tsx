import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmploymentApprovalsPage } from './EmploymentApprovalsPage';

const useCurrentEmploymentApprovals = vi.fn();
const useMyEmploymentApprovals = vi.fn();
const useEmploymentApprovalDetail = vi.fn();
const useApproveEmploymentApproval = vi.fn();
const useRejectEmploymentApproval = vi.fn();
const useReturnEmploymentApproval = vi.fn();
const useWithdrawEmploymentApproval = vi.fn();
const useAuth = vi.fn();

vi.mock('../../features/employment-foundation/api', () => ({
  useCurrentEmploymentApprovals: (query: unknown) => useCurrentEmploymentApprovals(query),
  useMyEmploymentApprovals: (query: unknown) => useMyEmploymentApprovals(query),
  useEmploymentApprovalDetail: (id: string, enabled?: boolean) => useEmploymentApprovalDetail(id, enabled),
  useApproveEmploymentApproval: () => useApproveEmploymentApproval(),
  useRejectEmploymentApproval: () => useRejectEmploymentApproval(),
  useReturnEmploymentApproval: () => useReturnEmploymentApproval(),
  useWithdrawEmploymentApproval: () => useWithdrawEmploymentApproval(),
}));

vi.mock('../../features/auth/auth-context', () => ({
  useAuth: () => useAuth(),
}));

const currentUser = {
  id: 'user-current',
  username: 'approver',
  displayName: '当前用户',
  role: 'ADMIN',
  roleName: '管理员',
  permissions: [],
  organizationIds: [],
};

const pendingSteps = [
  {
    id: 'step-1',
    stepOrder: 1,
    approver: { id: 'user-current', displayName: '当前审批人' },
    decision: 'PENDING' as const,
    comment: null,
    operatedAt: null,
  },
  {
    id: 'step-2',
    stepOrder: 2,
    approver: { id: 'user-next', displayName: '下一审批人' },
    decision: 'PENDING' as const,
    comment: null,
    operatedAt: null,
  },
];

const approval = {
  id: 'approval-1',
  businessType: 'INTERN_TO_EMPLOYEE',
  businessId: 'conversion-1',
  title: '虚构员工实习转正式',
  applicant: { id: 'applicant-1', displayName: '虚构申请人' },
  currentStep: 1,
  status: 'PENDING' as const,
  employmentStatus: 'PENDING' as const,
  submittedAt: '2026-09-20T08:30:00.000Z',
  completedAt: null,
  steps: pendingSteps,
};

const detail = {
  ...approval,
  flowVersion: {
    id: 'flow-version-1',
    versionNumber: 2,
    definition: { id: 'flow-1', code: 'intern-conversion', name: '实习转正式审批' },
  },
  businessSummary: {
    kind: 'CONVERSION' as const,
    conversionId: 'conversion-1',
    employee: { id: 'employee-1', employeeNo: 'F-001', name: '虚构员工' },
    sourceOrganizationName: '虚构实习部门',
    targetOrganizationName: '虚构正式部门',
    plannedEffectiveDate: '2026-10-01',
    status: 'PENDING' as const,
  },
};

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="current search">{location.search}</output>;
}

function renderPage(entry = '/employment/approvals') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <EmploymentApprovalsPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function mutation() {
  return { mutateAsync: vi.fn().mockResolvedValue({ id: 'approval-1' }), isPending: false };
}

describe('EmploymentApprovalsPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useCurrentEmploymentApprovals.mockReset();
    useMyEmploymentApprovals.mockReset();
    useEmploymentApprovalDetail.mockReset();
    useApproveEmploymentApproval.mockReset();
    useRejectEmploymentApproval.mockReset();
    useReturnEmploymentApproval.mockReset();
    useWithdrawEmploymentApproval.mockReset();
    useAuth.mockReset();

    const page = { data: { data: [approval], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }, isLoading: false, isError: false, refetch: vi.fn() };
    useCurrentEmploymentApprovals.mockReturnValue(page);
    useMyEmploymentApprovals.mockReturnValue(page);
    useEmploymentApprovalDetail.mockReturnValue({ data: detail, isLoading: false, isError: false });
    useApproveEmploymentApproval.mockReturnValue(mutation());
    useRejectEmploymentApproval.mockReturnValue(mutation());
    useReturnEmploymentApproval.mockReturnValue(mutation());
    useWithdrawEmploymentApproval.mockReturnValue(mutation());
    useAuth.mockReturnValue({ user: currentUser });
  });

  it('renders current and mine tabs, preserves URL pagination, and queries the selected view', async () => {
    const user = userEvent.setup();
    renderPage('/employment/approvals?view=my&page=2&pageSize=20');

    expect(screen.getByRole('button', { name: '待我审批' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '我发起' })).toBeInTheDocument();
    expect(useMyEmploymentApprovals).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
    expect(useCurrentEmploymentApprovals).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '待我审批' }));

    expect(screen.getByLabelText('current search')).toHaveTextContent('?view=current&page=1&pageSize=20');
    expect(useCurrentEmploymentApprovals).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 });
  });

  it('keeps the approval table columns in business order', () => {
    renderPage();

    const table = screen.getAllByRole('table')[0]!;
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '申请事项', '业务类型', '发起人', '当前步骤', '审批状态', '发起时间', '操作',
    ]);
    expect(screen.getByText('虚构员工实习转正式')).toBeInTheDocument();
    expect(screen.getByText('虚构申请人')).toBeInTheDocument();
    expect(screen.getByText('待审批')).toBeInTheDocument();
  });

  it('opens a drawer with ordered steps and the existing business route', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '查看虚构员工实习转正式' }));

    const drawer = await screen.findByRole('dialog', { name: '虚构员工实习转正式' });
    expect(within(drawer).getByText('第 1 步')).toBeInTheDocument();
    expect(within(drawer).getByText('第 2 步')).toBeInTheDocument();
    expect(within(drawer).getByText('当前审批人')).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: '前往业务' })).toHaveAttribute('href', '/employment/interns');
  });

  it('lets the current approver approve with an optional comment', async () => {
    const user = userEvent.setup();
    const approve = vi.fn().mockResolvedValue({ id: 'approval-1' });
    useApproveEmploymentApproval.mockReturnValue({ mutateAsync: approve, isPending: false });
    renderPage();

    await user.click(screen.getByRole('button', { name: '查看虚构员工实习转正式' }));
    const drawer = await screen.findByRole('dialog', { name: '虚构员工实习转正式' });
    await user.click(within(drawer).getByRole('button', { name: '审批通过' }));
    const modal = await screen.findByRole('dialog', { name: '审批通过' });
    await user.type(within(modal).getByRole('textbox', { name: '审批意见' }), '同意办理');
    await user.click(within(modal).getByRole('button', { name: '确认通过' }));

    await waitFor(() => expect(approve).toHaveBeenCalledWith({ id: 'approval-1', input: { comment: '同意办理' } }));
  });

  it('requires comments for reject and return actions', async () => {
    const user = userEvent.setup();
    const reject = vi.fn().mockResolvedValue({ id: 'approval-1' });
    const returnApproval = vi.fn().mockResolvedValue({ id: 'approval-1' });
    useRejectEmploymentApproval.mockReturnValue({ mutateAsync: reject, isPending: false });
    useReturnEmploymentApproval.mockReturnValue({ mutateAsync: returnApproval, isPending: false });
    renderPage();

    await user.click(screen.getByRole('button', { name: '查看虚构员工实习转正式' }));
    const drawer = await screen.findByRole('dialog', { name: '虚构员工实习转正式' });
    await user.click(within(drawer).getByRole('button', { name: '驳回' }));
    const rejectModal = await screen.findByRole('dialog', { name: '驳回申请' });
    expect(within(rejectModal).getByRole('button', { name: '确认驳回' })).toBeDisabled();
    await user.type(within(rejectModal).getByRole('textbox', { name: '审批意见' }), '资料不完整');
    await user.click(within(rejectModal).getByRole('button', { name: '确认驳回' }));
    await waitFor(() => expect(reject).toHaveBeenCalledWith({ id: 'approval-1', input: { comment: '资料不完整' } }));

    await user.click(screen.getByRole('button', { name: '查看虚构员工实习转正式' }));
    const secondDrawer = await screen.findByRole('dialog', { name: '虚构员工实习转正式' });
    await user.click(within(secondDrawer).getByRole('button', { name: '退回修订' }));
    const returnModal = await screen.findByRole('dialog', { name: '退回修订' });
    await user.type(within(returnModal).getByRole('textbox', { name: '审批意见' }), '请补充材料');
    await user.click(within(returnModal).getByRole('button', { name: '确认退回' }));
    await waitFor(() => expect(returnApproval).toHaveBeenCalledWith({ id: 'approval-1', input: { comment: '请补充材料' } }));
  });

  it('only shows withdraw for the applicant while every step is still pending', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { ...currentUser, id: 'applicant-1' } });
    const withdraw = vi.fn().mockResolvedValue({ id: 'approval-1' });
    useWithdrawEmploymentApproval.mockReturnValue({ mutateAsync: withdraw, isPending: false });
    renderPage('/employment/approvals?view=my');

    await user.click(screen.getByRole('button', { name: '查看虚构员工实习转正式' }));
    const drawer = await screen.findByRole('dialog', { name: '虚构员工实习转正式' });
    await user.click(within(drawer).getByRole('button', { name: '撤回申请' }));
    const modal = await screen.findByRole('dialog', { name: '撤回申请' });
    await user.click(within(modal).getByRole('button', { name: '确认撤回' }));

    await waitFor(() => expect(withdraw).toHaveBeenCalledWith('approval-1'));
  });
});
