import type { EmploymentApprovalDetail, ProcessStatus } from '@hr-demo/shared';
import { Alert, Button, Drawer, Input, Space, Spin, Typography, message } from 'antd';
import { useState } from 'react';
import { ApprovalTimeline } from './ApprovalTimeline';
import {
  useApproveEmploymentApproval,
  useEmploymentApprovalDetail,
  useRejectEmploymentApproval,
  useReturnEmploymentApproval,
  useWithdrawEmploymentApproval,
} from './api';

export interface ApprovalDetailDrawerProps {
  open: boolean;
  approvalId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const activeStatuses: ProcessStatus[] = ['PENDING', 'IN_PROGRESS'];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败';
}

export function ApprovalDetailDrawer({ open, approvalId = '', onClose, onSuccess }: ApprovalDetailDrawerProps) {
  const detail = useEmploymentApprovalDetail(approvalId, open && Boolean(approvalId));
  const approve = useApproveEmploymentApproval();
  const reject = useRejectEmploymentApproval();
  const returnApproval = useReturnEmploymentApproval();
  const withdraw = useWithdrawEmploymentApproval();
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const data = detail.data as EmploymentApprovalDetail | undefined;
  const canAct = Boolean(data && activeStatuses.includes(data.status));
  const run = async (action: 'approve' | 'reject' | 'return' | 'withdraw') => {
    setError('');
    if ((action === 'reject' || action === 'return') && !comment.trim()) {
      setError('请输入审批意见');
      return;
    }
    try {
      if (action === 'approve') await approve.mutateAsync({ id: approvalId, input: { comment: comment.trim() || undefined } });
      if (action === 'reject') await reject.mutateAsync({ id: approvalId, input: { comment: comment.trim() } });
      if (action === 'return') await returnApproval.mutateAsync({ id: approvalId, input: { comment: comment.trim() } });
      if (action === 'withdraw') await withdraw.mutateAsync(approvalId);
      message.success('操作成功');
      onSuccess?.();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <Drawer title="审批详情" open={open} onClose={onClose} width={560} destroyOnClose>
      {detail.isLoading ? <Spin /> : detail.isError ? <Alert type="error" message={errorMessage(detail.error)} /> : data ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Title level={5}>{data.title}</Typography.Title>
          <Typography.Text>申请人：{data.applicant.displayName}</Typography.Text>
          <Typography.Text>审批状态：{data.status}</Typography.Text>
          <ApprovalTimeline steps={data.steps} />
          <Input.TextArea aria-label="审批意见" value={comment} onChange={(event) => setComment(event.target.value)} rows={4} placeholder="审批意见" />
          {error ? <Alert type="error" message={error} /> : null}
          {canAct ? <Space wrap>
            <Button aria-label="通过" type="primary" onClick={() => void run('approve')}>通过</Button>
            <Button aria-label="驳回" danger onClick={() => void run('reject')}>驳回</Button>
            <Button aria-label="退回修改" onClick={() => void run('return')}>退回修改</Button>
            <Button aria-label="撤回" onClick={() => void run('withdraw')}>撤回</Button>
          </Space> : null}
        </Space>
      ) : <Typography.Text type="secondary">暂无审批详情</Typography.Text>}
    </Drawer>
  );
}
