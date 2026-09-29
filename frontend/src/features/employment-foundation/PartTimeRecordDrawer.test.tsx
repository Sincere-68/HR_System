import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PartTimeRecordDrawer } from './PartTimeRecordDrawer';

const create = vi.fn();
const activate = vi.fn();
const end = vi.fn();
const getRecord = vi.fn();
vi.mock('./api', () => ({
  useCreatePartTimeRecord: () => ({ mutateAsync: create, isPending: false }),
  useActivatePartTimeRecord: () => ({ mutateAsync: activate, isPending: false }),
  useEndPartTimeRecord: () => ({ mutateAsync: end, isPending: false }),
  usePartTimeRecord: (id: string, enabled: boolean) => getRecord(id, enabled),
}));

const baseProps = {
  open: true, onClose: vi.fn(), employee: { id: 'employee-1', employeeNo: 'F-001', name: '虚构员工' },
  organizations: [{ id: 'org-1', name: '兼职组织' }], jobTitles: [{ id: 'title-1', name: '兼职职务', code: 'TITLE-1' }],
  managers: [{ id: 'manager-1', employeeNo: 'M-001', name: '虚构经理' }],
};
function renderDrawer(props: typeof baseProps & { recordId?: string } = baseProps) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PartTimeRecordDrawer {...props} /></QueryClientProvider>);
}

describe('PartTimeRecordDrawer', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
  it('rejects an end date before the start date and posts exact IDs', async () => {
    create.mockResolvedValue({});
    getRecord.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderDrawer();
    const drawer = within(screen.getByRole('dialog', { name: '新增兼职记录' }));
    const user = userEvent.setup();
    await user.type(drawer.getByLabelText('兼职类型'), '项目顾问');
    const organizationSelect = drawer.getAllByLabelText('兼职组织')[0]!
      .querySelector('.ant-select-selector')!;
    fireEvent.mouseDown(organizationSelect);
    await waitFor(() => expect(document.querySelector('.ant-select-dropdown')).toBeInTheDocument());
    fireEvent.click(document.querySelector('.ant-select-item-option')!);
    fireEvent.change(drawer.getAllByLabelText('开始日期')[0]!, {
      target: { value: '2026-10-10' },
    });
    fireEvent.change(drawer.getAllByLabelText('结束日期')[0]!, {
      target: { value: '2026-10-01' },
    });
    await user.click(drawer.getByRole('button', { name: '保 存' }));
    expect(create).not.toHaveBeenCalled();
    expect(drawer.getByText('结束日期不能早于开始日期')).toBeInTheDocument();
  });
  it('offers activate and end actions in detail mode', async () => {
    getRecord.mockReturnValue({ data: { id: 'part-time-1', employee: baseProps.employee, type: '顾问', institution: null, organization: { id: 'org-1', name: '兼职组织' }, jobTitle: null, managerEmployee: null, startDate: '2026-09-01', endDate: null, status: 'PENDING', approval: null, canActivate: true, canEnd: false }, isLoading: false, isError: false });
    renderDrawer({ ...baseProps, recordId: 'part-time-1' });
    expect(screen.getByRole('button', { name: '生效' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '结束兼职' })).not.toBeInTheDocument();
  });
});
