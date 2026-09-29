import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProbationPage } from './ProbationPage';

const useProbation = vi.fn();
const useOrganizations = vi.fn();
const useUpdateProbation = vi.fn();
const useStartProbationEvaluation = vi.fn();
const useStartProbationEvaluations = vi.fn();
const useStartProbationConfirmations = vi.fn();
const useSubmitProbationConfirmation = vi.fn();
const useConfirmProbation = vi.fn();
const useApproveProbation = vi.fn();
const useReturnProbationToEvaluation = vi.fn();
const useProbationApprovers = vi.fn();
const useRemindProbationApproval = vi.fn();
const useTransferProbationApproval = vi.fn();
const importProbationFile = vi.fn();
const downloadProbationImportTemplate = vi.fn();
const downloadTableExport = vi.fn();
const refetchProbation = vi.fn();

vi.mock('../../features/employment/api', () => ({
  useProbation: (query: unknown) => useProbation(query),
  useUpdateProbation: () => useUpdateProbation(),
  useStartProbationEvaluation: () => useStartProbationEvaluation(),
  useStartProbationEvaluations: () => useStartProbationEvaluations(),
  useStartProbationConfirmations: () => useStartProbationConfirmations(),
  useSubmitProbationConfirmation: () => useSubmitProbationConfirmation(),
  useConfirmProbation: () => useConfirmProbation(),
  useApproveProbation: () => useApproveProbation(),
  useReturnProbationToEvaluation: () => useReturnProbationToEvaluation(),
  useProbationApprovers: (enabled: boolean) => useProbationApprovers(enabled),
  useRemindProbationApproval: () => useRemindProbationApproval(),
  useTransferProbationApproval: () => useTransferProbationApproval(),
  importProbationFile: (...args: unknown[]) => importProbationFile(...args),
  downloadProbationImportTemplate: (...args: unknown[]) => downloadProbationImportTemplate(...args),
}));
vi.mock('../../features/employees/api', () => ({
  useOrganizations: () => useOrganizations(),
}));
vi.mock('../../features/employees/download', () => ({
  downloadTableExport: (...args: unknown[]) => downloadTableExport(...args),
}));

const row = {
  id: 'probation-1', employeeId: 'employee-1', canViewEmployeeDetail: true, canManage: true,
  employeeNo: 'F-001', employeeName: '虚构员工', organizationName: '虚构机构',
  departmentName: '虚构部门', positionName: null, jobTitleName: null,
  startDate: '2026-08-01', plannedEndDate: '2026-11-01',
  probationMonths: 3, actualEndDate: null, evaluationType: null, evaluationName: null,
  result: null, evaluation: null, evaluationApprovalStatus: null, approvalStatus: null,
  currentApproverName: null, confirmedDate: null, extensionCount: 0, status: 'DRAFT',
  daysUntilPlannedEnd: 45, canRemindApproval: false, canTransferApproval: false,
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
    useOrganizations.mockReset();
    useUpdateProbation.mockReset();
    useStartProbationEvaluation.mockReset();
    useStartProbationEvaluations.mockReset();
    useStartProbationConfirmations.mockReset();
    useSubmitProbationConfirmation.mockReset();
    useConfirmProbation.mockReset();
    useApproveProbation.mockReset();
    useReturnProbationToEvaluation.mockReset();
    useProbationApprovers.mockReset();
    useRemindProbationApproval.mockReset();
    useTransferProbationApproval.mockReset();
    importProbationFile.mockReset();
    downloadProbationImportTemplate.mockReset();
    downloadTableExport.mockReset();
    refetchProbation.mockReset();
    refetchProbation.mockResolvedValue(undefined);
    useProbation.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: refetchProbation,
    });
    useOrganizations.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    const mutation = { isPending: false, mutateAsync: vi.fn(), mutate: vi.fn(), variables: undefined };
    useUpdateProbation.mockReturnValue(mutation);
    useStartProbationEvaluation.mockReturnValue(mutation);
    useStartProbationEvaluations.mockReturnValue(mutation);
    useStartProbationConfirmations.mockReturnValue(mutation);
    useSubmitProbationConfirmation.mockReturnValue(mutation);
    useConfirmProbation.mockReturnValue(mutation);
    useApproveProbation.mockReturnValue(mutation);
    useReturnProbationToEvaluation.mockReturnValue(mutation);
    useRemindProbationApproval.mockReturnValue(mutation);
    useTransferProbationApproval.mockReturnValue(mutation);
    useProbationApprovers.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
  });

  it('keeps the required business column order and uses the employee name as the detail entry', () => {
    renderPage();
    const table = [...document.querySelectorAll<HTMLTableElement>('.probation-table table')]
      .find((candidate) => candidate.textContent?.includes('工号')) as HTMLTableElement;
    expect(table).not.toBeNull();
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '工号', '姓名', '部门', '职位', '试用开始日期', '预计试用结束日期', '操作',
    ]);
    expect(screen.getByText('F-001')).toBeInTheDocument();
    expect(screen.getByText('虚构部门')).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '虚构员工' })).toHaveAttribute('href', '/personnel/employees/employee-1');
    expect(screen.getByRole('button', { name: /编辑试用期/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '虚构员工的更多操作' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /发起考核/ })).not.toBeInTheDocument();
  });

  it('uses the Beisen reviewing queue column structure', () => {
    renderPage('/employment/probation?view=reviewing');
    const table = [...document.querySelectorAll<HTMLTableElement>('.probation-table table')]
      .find((candidate) => candidate.textContent?.includes('考核名称')) as HTMLTableElement;

    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '工号', '部门', '机构', '职务', '试用开始日期', '预计试用结束日期',
      '考核名称', '考核评价', '转正意见', '审批状态', '操作',
    ]);
  });

  it('uses the Beisen approval queue column structure without inventing an approver', () => {
    renderPage('/employment/probation?view=approval');
    const table = [...document.querySelectorAll<HTMLTableElement>('.probation-table table')]
      .find((candidate) => candidate.textContent?.includes('转正审批状态')) as HTMLTableElement;

    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '工号', '姓名', '部门', '职位', '试用开始日期', '预计试用结束日期',
      '转正审批状态', '当前审批人', '操作',
    ]);
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });

  it('only offers approval decisions to the current approver and sends approval through the dedicated endpoint', async () => {
    const user = userEvent.setup();
    const approve = vi.fn().mockResolvedValue({ id: 'probation-1' });
    useApproveProbation.mockReturnValue({
      isPending: false,
      mutateAsync: approve,
      variables: undefined,
    });
    useProbation.mockReturnValue({
      data: {
        data: [{
          ...row,
          status: 'PENDING',
          approvalStatus: 'PENDING',
          currentApproverName: '虚构审批人',
          canRemindApproval: true,
          canTransferApproval: true,
        }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: refetchProbation,
    });
    renderPage('/employment/probation?view=approval');

    await user.click(screen.getByRole('button', { name: '虚构员工的更多操作' }));
    await user.click(await screen.findByText('审批通过'));
    expect(await screen.findByRole('dialog', { name: '审批通过' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '确认通过' }));

    await waitFor(() => expect(approve).toHaveBeenCalledWith('probation-1'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '审批通过' })).not.toBeInTheDocument());

    cleanup();
    useProbation.mockReturnValue({
      data: {
        data: [{
          ...row,
          status: 'PENDING',
          approvalStatus: 'PENDING',
          canRemindApproval: true,
          canTransferApproval: false,
        }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: refetchProbation,
    });
    renderPage('/employment/probation?view=approval');
    await user.click(screen.getByRole('button', { name: '虚构员工的更多操作' }));

    expect(screen.getByText('催办')).toBeInTheDocument();
    expect(screen.queryByText('审批通过')).not.toBeInTheDocument();
    expect(screen.queryByText('退回考核')).not.toBeInTheDocument();
  });

  it('preserves URL pagination and keyword query state', async () => {
    const user = userEvent.setup();
    renderPage('/employment/probation?keyword=F-002&page=3&pageSize=20');
    expect(useProbation).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: 'F-002', page: 3, pageSize: 20 }));
    await user.click(screen.getByRole('button', { name: '筛选人员' }));
    expect(screen.getByRole('searchbox', { name: '搜索人员' })).toHaveValue('F-002');
  });

  it('syncs submitted keyword to the URL and API query', async () => {
    const user = userEvent.setup();
    renderPage('/employment/probation?view=all&page=3');

    await user.click(screen.getByRole('button', { name: '筛选人员' }));
    const search = screen.getByRole('searchbox', { name: '搜索人员' });
    await user.type(search, '  F-003  {Enter}');

    const nextSearch = new URLSearchParams(screen.getByLabelText('current search').textContent ?? '');
    expect(Object.fromEntries(nextSearch)).toEqual({ view: 'all', page: '1', keyword: 'F-003' });
    expect(useProbation).toHaveBeenLastCalledWith(expect.objectContaining({
      view: 'all', keyword: 'F-003', page: 1,
    }));
  });

  it('keeps other URL filters while changing to the completed queue and removes conflicting status', async () => {
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
      data: { data: [{ ...row, canViewEmployeeDetail: false, canManage: false }], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.queryByRole('link', { name: '虚构员工' })).not.toBeInTheDocument();
    expect(screen.getByText('虚构员工')).toBeInTheDocument();
  });

  it('uses the Beisen all-employees queue column structure', () => {
    renderPage('/employment/probation?view=all');

    const table = [...document.querySelectorAll<HTMLTableElement>('.probation-table table')]
      .find((candidate) => candidate.textContent?.includes('转正审批状态')) as HTMLTableElement;
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '工号', '机构', '部门', '职位', '试用开始日期', '预计试用结束日期',
      '转正意见', '转正审批状态', '当前审批人', '操作',
    ]);
    expect(screen.getByText('虚构机构')).toBeInTheDocument();
  });

  it('provides a visible import entry and Beisen-style export choices', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('button', { name: '导入试用记录' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /导出/ }));

    expect(await screen.findByText('导出已选（0条）')).toBeInTheDocument();
    expect(screen.getByText('导出全部（1条）')).toBeInTheDocument();
  });

  it('opens the import dialog and cancels without retaining dialog state', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '导入试用记录' }));
    expect(screen.getByRole('dialog', { name: '导入试用记录' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消导入' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '导入试用记录' })).not.toBeInTheDocument());
  });

  it('imports a supported file, refreshes the current list, and closes cleanly', async () => {
    const user = userEvent.setup();
    const file = new File(['工号,姓名'], 'probation.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    importProbationFile.mockResolvedValue({
      created: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
      rows: [],
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: '导入试用记录' }));
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    await user.upload(fileInput!, file);

    await waitFor(() => expect(importProbationFile).toHaveBeenCalledWith(file));
    await waitFor(() => expect(refetchProbation).toHaveBeenCalledTimes(1));
    expect(screen.getByText('新增 1 行，更新 0 行，跳过 0 行，失败 0 行')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '关闭导入对话框' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '导入试用记录' })).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '导入试用记录' }));
    expect(screen.queryByText('新增 1 行，更新 0 行，跳过 0 行，失败 0 行')).not.toBeInTheDocument();
  });

  it('keeps the probation start date read-only in the ordinary edit dialog', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /编辑试用期/ }));

    const dialog = screen.getByRole('dialog', { name: '编辑试用期' });
    const dateInputs = within(dialog).getAllByRole('textbox');
    expect(dateInputs[0]).toBeDisabled();
    expect(dateInputs[1]).toBeEnabled();
  });

  it('keeps advanced start-date changes as a draft until confirmed and offers cancellation', async () => {
    const user = userEvent.setup();
    renderPage('/employment/probation?startDateFrom=2026-08-01&startDateTo=2026-08-31');

    await user.click(screen.getByRole('button', { name: '高级筛选' }));
    const advancedDialog = screen.getByRole('dialog', { name: '高级筛选' });
    expect(advancedDialog).toBeInTheDocument();
    await user.click(within(advancedDialog).getByRole('button', { name: 'Close' }));

    expect(screen.getByLabelText('current search')).toHaveTextContent(
      '?startDateFrom=2026-08-01&startDateTo=2026-08-31',
    );
  });

  it('describes approval reminders as an audit record rather than delivery', async () => {
    const user = userEvent.setup();
    const remind = vi.fn().mockResolvedValue({ id: 'probation-1' });
    useRemindProbationApproval.mockReturnValue({ isPending: false, mutateAsync: remind, variables: undefined });
    useProbation.mockReturnValue({
      data: {
        data: [{ ...row, status: 'PENDING', canRemindApproval: true, currentApproverName: '审批人' }],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: refetchProbation,
    });

    renderPage('/employment/probation?view=approval');
    await user.click(screen.getByRole('button', { name: '虚构员工的更多操作' }));
    await user.click(screen.getByText('催办'));

    await waitFor(() => expect(remind).toHaveBeenCalledWith('probation-1'));
    expect(await screen.findByText('已记录催办，不代表已送达')).toBeInTheDocument();
  });
});
