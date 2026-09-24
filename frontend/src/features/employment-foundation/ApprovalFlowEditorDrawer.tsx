import type {
  ApprovalFlowNodeAssigneeKind,
  EmploymentApprovalFlowNodeInput,
  EmploymentApprovalFlowOptions,
} from '@hr-demo/shared';
import { Button, Drawer, Select, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

export interface ApprovalFlowEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  value: EmploymentApprovalFlowNodeInput[];
  onChange: (nodes: EmploymentApprovalFlowNodeInput[]) => void;
  options: EmploymentApprovalFlowOptions;
  title?: string;
  onSave?: (nodes: EmploymentApprovalFlowNodeInput[]) => void | Promise<void>;
  loading?: boolean;
}

const assigneeKindLabels: Record<ApprovalFlowNodeAssigneeKind, string> = {
  USER: '指定用户',
  ROLE: '角色',
  DIRECTORY: '职务目录',
};

function normalizeNodes(nodes: EmploymentApprovalFlowNodeInput[]) {
  return [...nodes]
    .sort((left, right) => left.stepOrder - right.stepOrder)
    .map((node, index) => ({ ...node, stepOrder: index + 1 }));
}

function emptyNode(stepOrder: number): EmploymentApprovalFlowNodeInput {
  return {
    stepOrder,
    assigneeKind: 'USER',
    assigneeUserId: null,
    assigneeRoleId: null,
    assigneeRule: null,
  };
}

export function ApprovalFlowEditorDrawer({
  open,
  onClose,
  value,
  onChange,
  options,
  title = '审批流程节点编辑',
  onSave,
  loading = false,
}: ApprovalFlowEditorDrawerProps) {
  const normalizedValue = useMemo(() => normalizeNodes(value), [value]);
  const [nodes, setNodes] = useState<EmploymentApprovalFlowNodeInput[]>(normalizedValue);

  useEffect(() => setNodes(normalizedValue), [normalizedValue]);

  const update = (next: EmploymentApprovalFlowNodeInput[]) => {
    const normalized = normalizeNodes(next);
    setNodes(normalized);
    onChange(normalized);
  };

  const updateNode = (index: number, patch: Partial<EmploymentApprovalFlowNodeInput>) => {
    update(nodes.map((node, nodeIndex) => nodeIndex === index ? { ...node, ...patch } : node));
  };

  const removeNode = (index: number) => update(nodes.filter((_, nodeIndex) => nodeIndex !== index));
  const addNode = () => update([...nodes, emptyNode(nodes.length + 1)]);

  return (
    <Drawer title={title} open={open} onClose={onClose} width={620} destroyOnClose={false}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {nodes.map((node, index) => {
          const selectedKind = node.assigneeKind;
          const assigneeOptions = selectedKind === 'USER'
            ? options.users.map((user) => ({ value: user.id, label: user.displayName }))
            : selectedKind === 'ROLE'
              ? options.roles.map((role) => ({ value: role.id, label: role.name }))
              : options.jobTitles.map((jobTitle) => ({ value: jobTitle.id, label: jobTitle.name }));
          const selectedValue = selectedKind === 'USER'
            ? node.assigneeUserId ?? undefined
            : selectedKind === 'ROLE'
              ? node.assigneeRoleId ?? undefined
              : typeof node.assigneeRule?.value === 'string' ? node.assigneeRule.value : undefined;
          return (
            <div key={`${node.stepOrder}-${index}`} data-testid="approval-flow-node">
              <Space align="center" wrap>
                <Typography.Text strong>第 {node.stepOrder} 节点</Typography.Text>
                <Tag>{assigneeKindLabels[selectedKind]}</Tag>
                <Select
                  aria-label={`第 ${node.stepOrder} 节点类型`}
                  value={selectedKind}
                  options={Object.entries(assigneeKindLabels).map(([value, label]) => ({ value, label }))}
                  onChange={(kind: ApprovalFlowNodeAssigneeKind) => updateNode(index, {
                    assigneeKind: kind,
                    assigneeUserId: null,
                    assigneeRoleId: null,
                    assigneeRule: null,
                  })}
                />
                <Select
                  aria-label={`第 ${node.stepOrder} 节点审批人`}
                  placeholder="请选择审批人"
                  value={selectedValue}
                  options={assigneeOptions}
                  onChange={(selected: string) => updateNode(index,
                    selectedKind === 'USER'
                      ? { assigneeUserId: selected, assigneeRoleId: null, assigneeRule: null }
                      : selectedKind === 'ROLE'
                        ? { assigneeUserId: null, assigneeRoleId: selected, assigneeRule: null }
                        : { assigneeUserId: null, assigneeRoleId: null, assigneeRule: { directory: 'JOB_TITLE', value: selected } },
                  )}
                />
                <Button danger type="link" onClick={() => removeNode(index)}>删除节点</Button>
              </Space>
            </div>
          );
        })}
        <Space>
          <Button onClick={addNode}>新增节点</Button>
          {onSave ? <Button type="primary" loading={loading} onClick={() => void onSave(nodes)}>保存节点</Button> : null}
        </Space>
      </Space>
    </Drawer>
  );
}
