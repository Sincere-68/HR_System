import type { ApprovalDecision, EmploymentApprovalStepItem } from '@hr-demo/shared';
import { Descriptions, Steps, Tag, Typography } from 'antd';

const decisionLabels: Record<ApprovalDecision, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  SKIPPED: '已跳过',
};

const decisionColors: Record<ApprovalDecision, string> = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  SKIPPED: 'default',
};

function formatTime(value: string | null) {
  return value ? value.replace('T', ' ').replace(/\.\d{3}Z$/, '') : '未操作';
}

export function ApprovalTimeline({ steps }: { steps: EmploymentApprovalStepItem[] }) {
  const ordered = [...steps].sort((left, right) => left.stepOrder - right.stepOrder);
  return (
    <div data-testid="approval-timeline">
      <Steps direction="vertical" current={-1} items={ordered.map((step) => ({
        title: `第 ${step.stepOrder} 节点 · ${step.approver.displayName}`,
        description: (
          <div data-testid="approval-timeline-node">
            <Typography.Text strong>第 {step.stepOrder} 节点 · {step.approver.displayName}</Typography.Text>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="决定"><Tag color={decisionColors[step.decision]}>{decisionLabels[step.decision]}</Tag></Descriptions.Item>
              <Descriptions.Item label="意见">{step.comment || '暂无意见'}</Descriptions.Item>
              <Descriptions.Item label="时间">{formatTime(step.operatedAt)}</Descriptions.Item>
            </Descriptions>
          </div>
        ),
      }))} />
      {ordered.length === 0 ? <Typography.Text type="secondary">暂无审批节点</Typography.Text> : null}
    </div>
  );
}
