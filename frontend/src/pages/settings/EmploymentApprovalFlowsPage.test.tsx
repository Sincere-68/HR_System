import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmploymentApprovalFlowsPage } from './EmploymentApprovalFlowsPage';

const mocks = vi.hoisted(() => ({
  useFlows: vi.fn(),
  useFlow: vi.fn(),
  useOptions: vi.fn(),
  createFlow: vi.fn(),
  createVersion: vi.fn(),
  updateFlow: vi.fn(),
  updateVersion: vi.fn(),
  publishVersion: vi.fn(),
  archiveFlow: vi.fn(),
}));

vi.mock('../../features/employment-foundation/api', () => ({
  useEmploymentApprovalFlows: (query: unknown) => mocks.useFlows(query),
  useEmploymentApprovalFlow: (id: string, enabled?: boolean) => mocks.useFlow(id, enabled),
  useEmploymentApprovalFlowOptions: (enabled?: boolean) => mocks.useOptions(enabled),
  useCreateEmploymentApprovalFlow: () => mocks.createFlow(),
  useCreateEmploymentApprovalFlowVersion: () => mocks.createVersion(),
  useUpdateEmploymentApprovalFlow: () => mocks.updateFlow(),
  useUpdateEmploymentApprovalFlowVersion: () => mocks.updateVersion(),
  usePublishEmploymentApprovalFlowVersion: () => mocks.publishVersion(),
  useArchiveEmploymentApprovalFlow: () => mocks.archiveFlow(),
}));

const flowDraft = {
  id: 'flow-1',
  businessType: 'INTERN_TO_EMPLOYEE',
  code: 'intern-conversion',
  name: '实习转正式审批',
  status: 'DRAFT' as const,
  currentPublishedVersionId: null,
  versions: [{
    id: 'version-1', definitionId: 'flow-1', versionNumber: 1, status: 'DRAFT' as const,
    publishedAt: null, nodes: [{
      id: 'node-1', versionId: 'version-1', stepOrder: 1, assigneeKind: 'USER' as const,
      assigneeUserId: 'user-1', assigneeRoleId: null, assigneeRule: null,
    }],
  }],
};

const flowPublished = {
  id: 'flow-2',
  businessType: 'PART_TIME_RECORD',
  code: 'part-time-record',
  name: '兼职职责审批',
  status: 'PUBLISHED' as const,
  currentPublishedVersionId: 'version-2',
  versions: [{
    id: 'version-2', definitionId: 'flow-2', versionNumber: 3, status: 'PUBLISHED' as const,
    publishedAt: '2026-09-20T00:00:00.000Z', nodes: [{
      id: 'node-2', versionId: 'version-2', stepOrder: 1, assigneeKind: 'ROLE' as const,
      assigneeUserId: null, assigneeRoleId: 'role-1', assigneeRule: null,
    }],
  }],
};

const options = {
  users: [{ id: 'user-1', username: 'mock-user', displayName: '虚构审批人' }],
  roles: [{ id: 'role-1', code: 'HRBP', name: 'HRBP' }],
  jobTitles: [{ id: 'job-title-1', code: 'HR_MANAGER', name: '人力资源经理' }],
};

const mutation = () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) });

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <EmploymentApprovalFlowsPage />
    </QueryClientProvider>,
  );
}

describe('EmploymentApprovalFlowsPage', () => {
  beforeEach(() => {
    mocks.useFlows.mockReset();
    mocks.useFlow.mockReset();
    mocks.useOptions.mockReset();
    mocks.createFlow.mockReset();
    mocks.createVersion.mockReset();
    mocks.updateFlow.mockReset();
    mocks.updateVersion.mockReset();
    mocks.publishVersion.mockReset();
    mocks.archiveFlow.mockReset();

    mocks.useFlows.mockReturnValue({
      data: { data: [flowDraft, flowPublished], meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 } },
      isLoading: false,
      isError: false,
    });
    mocks.useFlow.mockReturnValue({ data: undefined, isLoading: false });
    mocks.useOptions.mockReturnValue({ data: options, isLoading: false });
    mocks.createFlow.mockReturnValue(mutation());
    mocks.createVersion.mockReturnValue(mutation());
    mocks.updateFlow.mockReturnValue(mutation());
    mocks.updateVersion.mockReturnValue(mutation());
    mocks.publishVersion.mockReturnValue(mutation());
    mocks.archiveFlow.mockReturnValue(mutation());
  });

  afterEach(cleanup);

  it('renders a compact flow table with the three supported business types', () => {
    renderPage();

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim())).toEqual([
      '流程编码', '流程名称', '业务类型', '状态', '当前版本', '审批节点', '操作',
    ]);
    expect(screen.getByText('实习转正式审批')).toBeInTheDocument();
    expect(screen.getByText('兼职职责审批')).toBeInTheDocument();
    expect(screen.getByText('实习转正式')).toBeInTheDocument();
    expect(screen.getByText('兼职职责')).toBeInTheDocument();
    expect(screen.getByText('草稿')).toBeInTheDocument();
    expect(screen.getByText('已发布')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建流程' })).toBeInTheDocument();
  });

  it('creates a definition with a user node from the new-flow form', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue(flowDraft);
    mocks.createFlow.mockReturnValue({ isPending: false, mutateAsync: create });
    renderPage();

    await user.click(screen.getByRole('button', { name: '新建流程' }));
    const dialog = screen.getByRole('dialog', { name: '新建任职审批流程' });
    await user.type(within(dialog).getByRole('textbox', { name: '流程编码' }), 'labor-conversion');
    await user.type(within(dialog).getByRole('textbox', { name: '流程名称' }), '劳务转正式审批');
    await user.click(within(dialog).getByRole('combobox', { name: '业务类型' }));
    await user.click(await screen.findByText('劳务转正式'));
    await user.click(within(dialog).getByRole('combobox', { name: '审批人' }));
    await user.click(await screen.findByText('虚构审批人'));
    await user.click(within(dialog).getByRole('button', { name: '创建流程' }));

    expect(create).toHaveBeenCalledWith({
      businessType: 'LABOR_TO_EMPLOYEE',
      code: 'labor-conversion',
      name: '劳务转正式审批',
      nodes: [{ stepOrder: 1, assigneeKind: 'USER', assigneeUserId: 'user-1' }],
    });
  });

  it('supports adding, moving, and removing draft nodes before saving', async () => {
    const user = userEvent.setup();
    const update = vi.fn().mockResolvedValue(flowDraft);
    mocks.updateFlow.mockReturnValue({ isPending: false, mutateAsync: update });
    mocks.useFlow.mockReturnValue({ data: flowDraft, isLoading: false });
    renderPage();

    await user.click(screen.getByRole('button', { name: '编辑草稿' }));
    const dialog = screen.getByRole('dialog', { name: '编辑任职审批流程' });
    await user.click(within(dialog).getByRole('button', { name: '新增审批节点' }));
    expect(within(dialog).getByText('第 2 级')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '第 2 级上移' }));
    const nodeCards = within(dialog).getAllByTestId('approval-flow-node');
    expect(within(nodeCards[0]!).getByText('第 1 级')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '删除第 1 级' }));
    await user.click(within(dialog).getByRole('button', { name: '保存草稿' }));

    expect(update).toHaveBeenCalledWith({
      id: 'flow-1',
      input: {
        name: '实习转正式审批',
        nodes: [{ stepOrder: 1, assigneeKind: 'USER', assigneeUserId: 'user-1' }],
      },
    });
  });

  it('supports directory job-title assignees with the exact JOB_TITLE rule', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue(flowDraft);
    mocks.createFlow.mockReturnValue({ isPending: false, mutateAsync: create });
    renderPage();

    await user.click(screen.getByRole('button', { name: '新建流程' }));
    const dialog = screen.getByRole('dialog', { name: '新建任职审批流程' });
    await user.type(within(dialog).getByRole('textbox', { name: '流程编码' }), 'job-title-flow');
    await user.type(within(dialog).getByRole('textbox', { name: '流程名称' }), '职务目录审批');
    await user.click(within(dialog).getByRole('combobox', { name: '审批人类型' }));
    await user.click(await screen.findByText('职务目录'));
    await user.click(within(dialog).getByRole('combobox', { name: '职务' }));
    await user.click(await screen.findByText('人力资源经理'));
    await user.click(within(dialog).getByRole('button', { name: '创建流程' }));

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      nodes: [{
        stepOrder: 1,
        assigneeKind: 'DIRECTORY',
        assigneeRule: { directory: 'JOB_TITLE', value: 'job-title-1' },
      }],
    }));
  });

  it('creates a draft version from the published version nodes', async () => {
    const user = userEvent.setup();
    const createVersion = vi.fn().mockResolvedValue(flowPublished);
    mocks.createVersion.mockReturnValue({ isPending: false, mutateAsync: createVersion });
    renderPage();

    await user.click(screen.getByRole('button', { name: '新建草稿版本' }));
    const confirm = screen.getByRole('dialog', { name: '新建草稿版本' });
    expect(confirm).toHaveTextContent('兼职职责审批');
    await user.click(within(confirm).getByRole('button', { name: '确认新建' }));

    expect(createVersion).toHaveBeenCalledWith({
      id: 'flow-2',
      input: {
        nodes: [{ stepOrder: 1, assigneeKind: 'ROLE', assigneeRoleId: 'role-1' }],
      },
    });
  });

  it('requires confirmation before publishing a draft or archiving a definition', async () => {
    const user = userEvent.setup();
    const publish = vi.fn().mockResolvedValue(flowDraft);
    const archive = vi.fn().mockResolvedValue(flowPublished);
    mocks.publishVersion.mockReturnValue({ isPending: false, mutateAsync: publish });
    mocks.archiveFlow.mockReturnValue({ isPending: false, mutateAsync: archive });
    renderPage();

    await user.click(screen.getByRole('button', { name: '发布流程' }));
    const publishDialog = screen.getByRole('dialog', { name: '发布任职审批流程' });
    expect(publishDialog).toHaveTextContent('发布后将作为当前生效版本');
    await user.click(within(publishDialog).getByRole('button', { name: '确认发布' }));
    expect(publish).toHaveBeenCalledWith('version-1');

    await user.click(screen.getAllByRole('button', { name: '归档流程' })[1]!);
    const archiveDialog = screen.getByRole('dialog', { name: '归档任职审批流程' });
    expect(archiveDialog).toHaveTextContent('归档后不可再用于新申请');
    await user.click(within(archiveDialog).getByRole('button', { name: '确认归档' }));
    expect(archive).toHaveBeenCalledWith('flow-2');
  });
});
