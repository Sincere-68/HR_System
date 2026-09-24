import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversionRequestDrawer } from './ConversionRequestDrawer';

const createConversion = vi.fn();
vi.mock('./api', () => ({ useCreateEmploymentConversion: () => ({ mutateAsync: createConversion, isPending: false }) }));

const props = {
  open: true,
  onClose: vi.fn(),
  employee: { id: 'employee-1', employeeNo: 'F-001', name: '虚构员工' },
  sourceEmploymentPeriodId: 'period-1',
  type: 'INTERN_TO_EMPLOYEE' as const,
  organizations: [{ id: 'org-1', name: '目标组织' }],
  positions: [{ id: 'position-1', name: '目标岗位' }],
  jobTitles: [{ id: 'title-1', name: '目标职务', code: 'TITLE-1' }],
};
function renderDrawer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ConversionRequestDrawer {...props} /></QueryClientProvider>);
}

describe('ConversionRequestDrawer', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('requires target organization and date before submitting', async () => {
    renderDrawer();
    const drawer = within(screen.getByRole('dialog', { name: '提交转换申请' }));
    const user = userEvent.setup();
    await user.click(drawer.getByRole('button', { name: '提交申请' }));
    expect(createConversion).not.toHaveBeenCalled();
    expect(drawer.getAllByText('请选择目标组织').length).toBeGreaterThan(1);
    expect(drawer.getByText('请选择计划生效日期')).toBeInTheDocument();
  });
  it('keeps the draft on 409 and shows the published-flow message on 422', async () => {
    createConversion.mockRejectedValueOnce(Object.assign(new Error('冲突'), { status: 409 }))
      .mockRejectedValueOnce(Object.assign(new Error('未发布'), { status: 422 }));
    renderDrawer();
    const drawer = within(screen.getByRole('dialog', { name: '提交转换申请' }));
    const user = userEvent.setup();
    const organizationSelect = drawer.getAllByLabelText('目标组织')[0]!.querySelector('.ant-select-selector')!;
    fireEvent.mouseDown(organizationSelect);
    await waitFor(() => expect(document.querySelector('.ant-select-dropdown')).toBeInTheDocument());
    fireEvent.click(document.querySelector('.ant-select-item-option')!);
    fireEvent.change(drawer.getByLabelText('计划生效日期'), { target: { value: '2026-10-01' } });
    await user.click(drawer.getByRole('button', { name: '提交申请' }));
    await waitFor(() => expect(createConversion).toHaveBeenCalledTimes(1));
    expect(createConversion).toHaveBeenCalledWith({
      type: 'INTERN_TO_EMPLOYEE',
      employeeId: 'employee-1',
      sourceEmploymentPeriodId: 'period-1',
      targetOrganizationId: 'org-1',
      plannedEffectiveDate: '2026-10-01',
    });
    expect(screen.getByText('冲突')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '提交转换申请' })).toBeInTheDocument();
    await user.click(drawer.getByRole('button', { name: '提交申请' }));
    await waitFor(() => expect(createConversion).toHaveBeenCalledTimes(2));
    expect(screen.getByText('请先发布对应业务审批流程')).toBeInTheDocument();
  });
});
