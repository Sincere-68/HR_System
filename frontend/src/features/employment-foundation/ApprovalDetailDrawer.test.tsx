import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApprovalDetailDrawer } from './ApprovalDetailDrawer';

const useDetail = vi.fn();
const approve = vi.fn();
const reject = vi.fn();
const returnApproval = vi.fn();
const withdraw = vi.fn();
vi.mock('./api', () => ({
  useEmploymentApprovalDetail: (id: string, enabled: boolean) => useDetail(id, enabled),
  useApproveEmploymentApproval: () => ({ mutateAsync: approve, isPending: false }),
  useRejectEmploymentApproval: () => ({ mutateAsync: reject, isPending: false }),
  useReturnEmploymentApproval: () => ({ mutateAsync: returnApproval, isPending: false }),
  useWithdrawEmploymentApproval: () => ({ mutateAsync: withdraw, isPending: false }),
}));

const detail = {
  id: 'approval-1', businessType: 'INTERN_TO_EMPLOYEE', businessId: 'conversion-1', title: '实习转正式申请',
  applicant: { id: 'applicant-1', displayName: '申请人' }, currentStep: 1, status: 'PENDING' as const,
  employmentStatus: 'PENDING' as const, submittedAt: '2026-09-23T00:00:00.000Z', completedAt: null,
  steps: [{ id: 'step-1', stepOrder: 1, approver: { id: 'u1', displayName: '审批人' }, decision: 'PENDING' as const, comment: null, operatedAt: null }],
  flowVersion: { id: 'version-1', versionNumber: 1, definition: { id: 'flow-1', name: '实习转正式', code: 'intern', } },
  businessSummary: null,
};
function renderDrawer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ApprovalDetailDrawer open approvalId="approval-1" onClose={vi.fn()} /></QueryClientProvider>);
}

describe('ApprovalDetailDrawer', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('shows details and sends approval action with comment', async () => {
    useDetail.mockReturnValue({ data: detail, isLoading: false, isError: false });
    approve.mockResolvedValue({});
    renderDrawer();
    expect(screen.getByRole('dialog', { name: '审批详情' })).toHaveTextContent('实习转正式申请');
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: '审批意见' }), '同意');
    await user.click(screen.getByRole('button', { name: '通过' }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith({ id: 'approval-1', input: { comment: '同意' } }));
  });

  it('requires a comment for reject and return', async () => {
    useDetail.mockReturnValue({ data: detail, isLoading: false, isError: false });
    renderDrawer();
    const drawer = within(screen.getAllByRole('dialog', { name: '审批详情' }).at(-1)!);
    const user = userEvent.setup();
    await user.click(drawer.getByRole('button', { name: '驳回' }));
    expect(reject).not.toHaveBeenCalled();
    expect(drawer.getByText('请输入审批意见')).toBeInTheDocument();
    await user.click(drawer.getByRole('button', { name: '退回修改' }));
    expect(returnApproval).not.toHaveBeenCalled();
  });
});
