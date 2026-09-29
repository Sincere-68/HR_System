import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import type { TableProps } from 'antd';
import type {
  ApprovalFlowDefinition,
  ApprovalFlowNode,
  ApprovalFlowNodeAssigneeKind,
  ApprovalFlowVersion,
  EmploymentApprovalFlowNodeInput,
} from '@hr-demo/shared';
import {
  useArchiveEmploymentApprovalFlow,
  useCreateEmploymentApprovalFlow,
  useCreateEmploymentApprovalFlowVersion,
  useEmploymentApprovalFlow,
  useEmploymentApprovalFlowOptions,
  useEmploymentApprovalFlows,
  usePublishEmploymentApprovalFlowVersion,
  useUpdateEmploymentApprovalFlow,
  useUpdateEmploymentApprovalFlowVersion,
} from '../../features/employment-foundation/api';

const BUSINESS_TYPES = [
  { value: 'INTERN_TO_EMPLOYEE', label: '实习转正式' },
  { value: 'LABOR_TO_EMPLOYEE', label: '劳务转正式' },
  { value: 'PART_TIME_RECORD', label: '兼职职责' },
] as const;

const ASSIGNEE_TYPES: Array<{ value: ApprovalFlowNodeAssigneeKind; label: string }> = [
  { value: 'USER', label: '指定用户' },
  { value: 'ROLE', label: '角色' },
  { value: 'DIRECTORY', label: '职务目录' },
];

const STATUS_LABELS: Record<ApprovalFlowDefinition['status'], string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  ARCHIVED: '已归档',
};

const VERSION_STATUS_LABELS: Record<ApprovalFlowVersion['status'], string> = STATUS_LABELS;

type EditableNode = EmploymentApprovalFlowNodeInput & { localId: string };
type FlowFormState = {
  businessType: string;
  code: string;
  name: string;
  nodes: EditableNode[];
};
type ConfirmAction =
  | { type: 'publish'; version: ApprovalFlowVersion }
  | { type: 'archive'; flow: ApprovalFlowDefinition }
  | { type: 'clone'; flow: ApprovalFlowDefinition; version: ApprovalFlowVersion }
  | null;

function businessTypeLabel(value: string) {
  return BUSINESS_TYPES.find((item) => item.value === value)?.label ?? value;
}

function makeLocalId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toEditableNode(node: Partial<ApprovalFlowNode> & EmploymentApprovalFlowNodeInput, index: number): EditableNode {
  return {
    localId: node.id ?? makeLocalId(),
    stepOrder: index + 1,
    assigneeKind: node.assigneeKind,
    assigneeUserId: node.assigneeUserId ?? undefined,
    assigneeRoleId: node.assigneeRoleId ?? undefined,
    assigneeRule: node.assigneeRule ?? undefined,
  };
}

function nodesFromVersion(version: ApprovalFlowVersion | undefined): EditableNode[] {
  return (version?.nodes ?? []).map((node, index) => toEditableNode(node, index));
}

function newestVersion(flow: ApprovalFlowDefinition | undefined) {
  if (!flow?.versions.length) return undefined;
  return [...flow.versions].sort((left, right) => right.versionNumber - left.versionNumber)[0];
}

function draftVersion(flow: ApprovalFlowDefinition | undefined) {
  return flow?.versions.find((version) => version.status === 'DRAFT');
}

function publishedVersion(flow: ApprovalFlowDefinition | undefined) {
  return flow?.versions.find((version) => version.status === 'PUBLISHED')
    ?? flow?.versions.find((version) => version.id === flow.currentPublishedVersionId);
}

function normalizeNodes(nodes: EditableNode[]): EmploymentApprovalFlowNodeInput[] {
  return nodes.map(({ localId: _localId, stepOrder: _stepOrder, ...node }, index) => ({
    ...node,
    stepOrder: index + 1,
  }));
}

function makeInitialForm(flow?: ApprovalFlowDefinition, version?: ApprovalFlowVersion): FlowFormState {
  const sourceVersion = version ?? draftVersion(flow) ?? newestVersion(flow);
  return {
    businessType: flow?.businessType ?? 'INTERN_TO_EMPLOYEE',
    code: flow?.code ?? '',
    name: flow?.name ?? '',
    nodes: nodesFromVersion(sourceVersion),
  };
}

function nodeAssigneeSummary(node: ApprovalFlowNode) {
  if (node.assigneeKind === 'DIRECTORY') {
    const value = node.assigneeRule && typeof node.assigneeRule.value === 'string' ? node.assigneeRule.value : '--';
    return `职务目录：${value}`;
  }
  return node.assigneeKind === 'USER' ? '指定用户' : '角色';
}

function FlowEditor({
  title,
  initialState,
  options,
  onCancel,
  onSubmit,
  submitLabel,
  submitting,
  isNew,
}: {
  title: string;
  initialState: FlowFormState;
  options: ReturnType<typeof useEmploymentApprovalFlowOptions>['data'];
  onCancel: () => void;
  onSubmit: (state: FlowFormState) => Promise<void>;
  submitLabel: string;
  submitting: boolean;
  isNew: boolean;
}) {
  const [state, setState] = useState<FlowFormState>(() => ({
    ...initialState,
    nodes: initialState.nodes.length ? initialState.nodes : [{ localId: makeLocalId(), stepOrder: 1, assigneeKind: 'USER' }],
  }));

  const updateNode = (index: number, patch: Partial<EditableNode>) => {
    setState((current) => ({
      ...current,
      nodes: current.nodes.map((node, nodeIndex) => nodeIndex === index ? { ...node, ...patch } : node),
    }));
  };

  const changeAssigneeKind = (index: number, assigneeKind: ApprovalFlowNodeAssigneeKind) => {
    updateNode(index, {
      assigneeKind,
      assigneeUserId: undefined,
      assigneeRoleId: undefined,
      assigneeRule: assigneeKind === 'DIRECTORY' ? { directory: 'JOB_TITLE', value: '' } : undefined,
    });
  };

  const addNode = () => {
    setState((current) => ({
      ...current,
      nodes: [...current.nodes, { localId: makeLocalId(), stepOrder: current.nodes.length + 1, assigneeKind: 'USER' }],
    }));
  };

  const removeNode = (index: number) => {
    if (state.nodes.length === 1) return;
    setState((current) => ({
      ...current,
      nodes: current.nodes.filter((_, nodeIndex) => nodeIndex !== index).map((node, nodeIndex) => ({ ...node, stepOrder: nodeIndex + 1 })),
    }));
  };

  const moveNode = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= state.nodes.length) return;
    setState((current) => {
      const nodes = [...current.nodes];
      [nodes[index], nodes[target]] = [nodes[target]!, nodes[index]!];
      return { ...current, nodes: nodes.map((node, nodeIndex) => ({ ...node, stepOrder: nodeIndex + 1 })) };
    });
  };

  const submit = async () => {
    if (!state.code.trim() && isNew) {
      message.error('请输入流程编码');
      return;
    }
    if (!state.name.trim()) {
      message.error('请输入流程名称');
      return;
    }
    const invalidNode = state.nodes.some((node) => (
      (node.assigneeKind === 'USER' && !node.assigneeUserId)
      || (node.assigneeKind === 'ROLE' && !node.assigneeRoleId)
      || (node.assigneeKind === 'DIRECTORY' && !(node.assigneeRule && typeof node.assigneeRule.value === 'string' && node.assigneeRule.value))
    ));
    if (invalidNode) {
      message.error('请完整配置每个审批节点');
      return;
    }
    await onSubmit(state);
  };

  return (
    <Modal
      open
      title={title}
      onCancel={onCancel}
      width={760}
      destroyOnHidden
      footer={(
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" loading={submitting} onClick={submit}>{submitLabel}</Button>
        </Space>
      )}
    >
      <Form layout="vertical">
        {isNew && (
          <Space align="start" style={{ display: 'flex' }}>
            <Form.Item label="流程编码" required style={{ flex: 1 }}>
              <Input
                aria-label="流程编码"
                value={state.code}
                onChange={(event) => setState((current) => ({ ...current, code: event.target.value }))}
                placeholder="例如 intern-conversion"
              />
            </Form.Item>
            <Form.Item label="业务类型" required style={{ flex: 1 }}>
              <Select
                aria-label="业务类型"
                value={state.businessType}
                options={BUSINESS_TYPES.map(({ value, label }) => ({ value, label }))}
                onChange={(businessType) => setState((current) => ({ ...current, businessType }))}
              />
            </Form.Item>
          </Space>
        )}
        <Form.Item label="流程名称" required>
          <Input
            aria-label="流程名称"
            value={state.name}
            onChange={(event) => setState((current) => ({ ...current, name: event.target.value }))}
          />
        </Form.Item>
        <div aria-label="审批节点列表">
          {state.nodes.map((node, index) => (
            <Card
              key={node.localId}
              data-testid="approval-flow-node"
              size="small"
              title={`第 ${index + 1} 级`}
              style={{ marginBottom: 12 }}
              extra={(
                <Space size="small">
                  <Button
                    type="text"
                    size="small"
                    aria-label={`第 ${index + 1} 级上移`}
                    disabled={index === 0}
                    onClick={() => moveNode(index, -1)}
                  >上移</Button>
                  <Button
                    type="text"
                    size="small"
                    aria-label={`第 ${index + 1} 级下移`}
                    disabled={index === state.nodes.length - 1}
                    onClick={() => moveNode(index, 1)}
                  >下移</Button>
                  <Button
                    type="text"
                    danger
                    size="small"
                    aria-label={`删除第 ${index + 1} 级`}
                    disabled={state.nodes.length === 1}
                    onClick={() => removeNode(index)}
                  >删除</Button>
                </Space>
              )}
            >
              <Space align="start" style={{ display: 'flex' }}>
                <Form.Item label="审批人类型" style={{ flex: 1, minWidth: 160 }}>
                  <Select
                    aria-label="审批人类型"
                    value={node.assigneeKind}
                    options={ASSIGNEE_TYPES}
                    onChange={(kind) => changeAssigneeKind(index, kind)}
                  />
                </Form.Item>
                {node.assigneeKind === 'USER' && (
                  <Form.Item label="审批人" style={{ flex: 1, minWidth: 220 }}>
                    <Select
                      aria-label="审批人"
                      value={node.assigneeUserId}
                      placeholder="请选择审批人"
                      options={(options?.users ?? []).map((option) => ({ value: option.id, label: option.displayName }))}
                      onChange={(assigneeUserId) => updateNode(index, { assigneeUserId })}
                    />
                  </Form.Item>
                )}
                {node.assigneeKind === 'ROLE' && (
                  <Form.Item label="审批角色" style={{ flex: 1, minWidth: 220 }}>
                    <Select
                      aria-label="审批角色"
                      value={node.assigneeRoleId}
                      placeholder="请选择角色"
                      options={(options?.roles ?? []).map((option) => ({ value: option.id, label: option.name }))}
                      onChange={(assigneeRoleId) => updateNode(index, { assigneeRoleId })}
                    />
                  </Form.Item>
                )}
                {node.assigneeKind === 'DIRECTORY' && (
                  <Form.Item label="职务" style={{ flex: 1, minWidth: 220 }}>
                    <Select
                      aria-label="职务"
                      value={typeof node.assigneeRule?.value === 'string' ? node.assigneeRule.value : undefined}
                      placeholder="请选择职务"
                      options={(options?.jobTitles ?? []).map((option) => ({ value: option.id, label: option.name }))}
                      onChange={(value) => updateNode(index, { assigneeRule: { directory: 'JOB_TITLE', value } })}
                    />
                  </Form.Item>
                )}
              </Space>
            </Card>
          ))}
        </div>
        <Button block onClick={addNode}>新增审批节点</Button>
      </Form>
    </Modal>
  );
}

export function EmploymentApprovalFlowsPage() {
  const [keyword, setKeyword] = useState('');
  const [businessType, setBusinessType] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{ mode: 'new' | 'edit'; flow?: ApprovalFlowDefinition; version?: ApprovalFlowVersion } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [apiMessage, messageContextHolder] = message.useMessage();

  const flowsQuery = useEmploymentApprovalFlows({ keyword: keyword || undefined, businessType, page, pageSize: 20 });
  const selectedFlowQuery = useEmploymentApprovalFlow(selectedFlowId, Boolean(selectedFlowId));
  const optionsQuery = useEmploymentApprovalFlowOptions(Boolean(editor));
  const createFlow = useCreateEmploymentApprovalFlow();
  const createVersion = useCreateEmploymentApprovalFlowVersion();
  const updateFlow = useUpdateEmploymentApprovalFlow();
  const updateVersion = useUpdateEmploymentApprovalFlowVersion();
  const publishVersion = usePublishEmploymentApprovalFlowVersion();
  const archiveFlow = useArchiveEmploymentApprovalFlow();

  const rows = flowsQuery.data?.data ?? [];
  const total = flowsQuery.data?.meta.total ?? 0;
  const selectedFlow = selectedFlowQuery.data ?? editor?.flow;

  const openEdit = (flow: ApprovalFlowDefinition) => {
    setSelectedFlowId(flow.id);
    setEditor({ mode: 'edit', flow, version: draftVersion(flow) });
  };

  const openNew = () => {
    setSelectedFlowId('');
    setEditor({ mode: 'new' });
  };

  const submitEditor = async (state: FlowFormState) => {
    try {
      const nodes = normalizeNodes(state.nodes);
      if (editor?.mode === 'new') {
        await createFlow.mutateAsync({ businessType: state.businessType, code: state.code.trim(), name: state.name.trim(), nodes });
      } else if (editor?.version && editor.flow?.status === 'PUBLISHED') {
        await updateVersion.mutateAsync({ id: editor.version.id, input: { nodes } });
      } else if (editor?.flow) {
        await updateFlow.mutateAsync({ id: editor.flow.id, input: { name: state.name.trim(), nodes } });
      }
      setEditor(null);
      apiMessage.success('已保存流程草稿');
    } catch {
      apiMessage.error('保存失败，请稍后重试');
    }
  };

  const confirm = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.type === 'publish') {
        await publishVersion.mutateAsync(confirmAction.version.id);
        apiMessage.success('流程已发布');
      } else if (confirmAction.type === 'archive') {
        await archiveFlow.mutateAsync(confirmAction.flow.id);
        apiMessage.success('流程已归档');
      } else {
        await createVersion.mutateAsync({
          id: confirmAction.flow.id,
          input: { nodes: normalizeNodes(nodesFromVersion(confirmAction.version)) },
        });
        apiMessage.success('已创建新的草稿版本');
      }
      setConfirmAction(null);
    } catch {
      apiMessage.error('操作失败，请稍后重试');
    }
  };

  const columns = useMemo<TableProps<ApprovalFlowDefinition>['columns']>(() => [
    { title: '流程编码', dataIndex: 'code', key: 'code' },
    { title: '流程名称', dataIndex: 'name', key: 'name' },
    { title: '业务类型', dataIndex: 'businessType', key: 'businessType', render: (value: string) => businessTypeLabel(value) },
    { title: '状态', dataIndex: 'status', key: 'status', render: (value: ApprovalFlowDefinition['status']) => <Tag color={value === 'PUBLISHED' ? 'green' : value === 'ARCHIVED' ? 'default' : 'gold'}>{STATUS_LABELS[value]}</Tag> },
    {
      title: '当前版本', key: 'version', render: (_value, flow) => {
        const version = publishedVersion(flow) ?? newestVersion(flow);
        return version ? `v${version.versionNumber} · ${VERSION_STATUS_LABELS[version.status]}` : '--';
      },
    },
    {
      title: '审批节点', key: 'nodes', render: (_value, flow) => {
        const version = draftVersion(flow) ?? publishedVersion(flow) ?? newestVersion(flow);
        return version ? `${version.nodes.length} 级` : '--';
      },
    },
    {
      title: '操作', key: 'actions', render: (_value, flow) => {
        const draft = draftVersion(flow);
        const published = publishedVersion(flow);
        return (
          <Space size="small" wrap>
            {flow.status !== 'ARCHIVED' && draft && (
              <Button type="link" size="small" onClick={() => openEdit(flow)}>编辑草稿</Button>
            )}
            {flow.status !== 'ARCHIVED' && !draft && published && (
              <Button type="link" size="small" onClick={() => setConfirmAction({ type: 'clone', flow, version: published })}>新建草稿版本</Button>
            )}
            {flow.status !== 'ARCHIVED' && draft && (
              <Button type="link" size="small" onClick={() => setConfirmAction({ type: 'publish', version: draft })}>发布流程</Button>
            )}
            {flow.status !== 'ARCHIVED' && (
              <Button type="link" danger size="small" onClick={() => setConfirmAction({ type: 'archive', flow })}>归档流程</Button>
            )}
          </Space>
        );
      },
    },
  ], []);

  return (
    <div className="employment-approval-flows-page">
      {messageContextHolder}
      <Card
        title="任职审批流程"
        extra={<Button type="primary" onClick={openNew}>新建流程</Button>}
        size="small"
      >
        <Space style={{ marginBottom: 12 }} wrap>
          <Input.Search
            aria-label="搜索流程"
            placeholder="搜索流程编码或名称"
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => setPage(1)}
            style={{ width: 260 }}
          />
          <Select
            aria-label="筛选业务类型"
            allowClear
            placeholder="全部业务类型"
            value={businessType}
            options={BUSINESS_TYPES.map(({ value, label }) => ({ value, label }))}
            onChange={(value) => { setBusinessType(value); setPage(1); }}
            style={{ width: 160 }}
          />
        </Space>
        <Table<ApprovalFlowDefinition>
          rowKey="id"
          size="small"
          loading={flowsQuery.isLoading}
          columns={columns}
          dataSource={rows}
          pagination={{ current: page, pageSize: 20, total, showSizeChanger: false, onChange: setPage }}
          locale={{ emptyText: '暂无任职审批流程' }}
        />
      </Card>

      {editor && (
        <FlowEditor
          title={editor.mode === 'new' ? '新建任职审批流程' : '编辑任职审批流程'}
          initialState={editor.mode === 'new' ? makeInitialForm() : makeInitialForm(selectedFlow ?? editor.flow, editor.version ?? draftVersion(selectedFlow ?? editor.flow))}
          options={optionsQuery.data}
          onCancel={() => setEditor(null)}
          onSubmit={submitEditor}
          submitLabel={editor.mode === 'new' ? '创建流程' : '保存草稿'}
          submitting={createFlow.isPending || updateFlow.isPending || updateVersion.isPending}
          isNew={editor.mode === 'new'}
        />
      )}

      <Modal
        open={Boolean(confirmAction)}
        title={confirmAction?.type === 'publish' ? '发布任职审批流程' : confirmAction?.type === 'archive' ? '归档任职审批流程' : '新建草稿版本'}
        onCancel={() => setConfirmAction(null)}
        onOk={confirm}
        okText={confirmAction?.type === 'publish' ? '确认发布' : confirmAction?.type === 'archive' ? '确认归档' : '确认新建'}
        cancelText="取消"
        confirmLoading={publishVersion.isPending || archiveFlow.isPending || createVersion.isPending}
      >
        {confirmAction?.type === 'publish' && <p>发布后将作为当前生效版本，旧版本将自动归档。</p>}
        {confirmAction?.type === 'archive' && <p>归档后不可再用于新申请，历史版本仍会保留。</p>}
        {confirmAction?.type === 'clone' && <p>将从“{confirmAction.flow.name}”的已发布节点复制为新的草稿版本。</p>}
      </Modal>
    </div>
  );
}
