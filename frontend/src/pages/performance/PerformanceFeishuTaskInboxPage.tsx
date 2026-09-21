import { Alert, Button, Card, Empty, Form, Input, InputNumber, List, Modal, Skeleton, Space, Tag, Typography, message } from 'antd';
import type { PerformanceTaskListItem, PerformanceWorkflowTaskListItem } from '@hr-demo/shared';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { feishuTaskTokenStorage } from '../../lib/api';
import { performanceApi, useFeishuTaskInbox, useSubmitFeishuAssessmentTask, useSubmitFeishuWorkflowTask } from '../../features/performance/api';

function scoreDisplay(value: number | null | undefined) {
  return value === null || value === undefined ? '--' : value.toFixed(4);
}

function moneyDisplay(value: number | null | undefined) {
  return value === null || value === undefined ? '--' : value.toFixed(2);
}

export function PerformanceFeishuTaskInboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [authorized, setAuthorized] = useState(Boolean(feishuTaskTokenStorage.get()));
  const [loadingAuthorization, setLoadingAuthorization] = useState(false);
  const [authorizationError, setAuthorizationError] = useState<string | null>(null);
  const [assessmentTarget, setAssessmentTarget] = useState<PerformanceTaskListItem | null>(null);
  const [workflowTarget, setWorkflowTarget] = useState<PerformanceWorkflowTaskListItem | null>(null);
  const inbox = useFeishuTaskInbox(authorized);
  const submitAssessment = useSubmitFeishuAssessmentTask();
  const submitWorkflow = useSubmitFeishuWorkflowTask();
  const [assessmentForm] = Form.useForm<{ score: number; adjustment: number; comment?: string }>();
  const [workflowForm] = Form.useForm<{ comment?: string }>();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state || authorized) return;
    setSearchParams({}, { replace: true });
    setLoadingAuthorization(true);
    performanceApi.exchangeFeishuTaskSession(state, code)
      .then((result) => ({ accessToken: result.accessToken }))
      .then((result) => {
        feishuTaskTokenStorage.set(result.accessToken);
        setAuthorized(true);
        setAuthorizationError(null);
      })
      .catch((error) => {
        feishuTaskTokenStorage.clear();
        const text = error instanceof Error ? error.message : '飞书授权失败';
        setAuthorizationError(text);
        messageApi.error(text);
      })
      .finally(() => setLoadingAuthorization(false));
  }, [authorized, messageApi, searchParams, setSearchParams]);

  const submitAssessmentValue = async (values: { score?: number; adjustment?: number; comment?: string }) => {
    if (!assessmentTarget) return;
    try {
      await submitAssessment.mutateAsync({ id: assessmentTarget.id, input: values });
      setAssessmentTarget(null);
      assessmentForm.resetFields();
      messageApi.success('评价已提交');
    } catch (error) { messageApi.error(error instanceof Error ? error.message : '评价提交失败'); }
  };

  const submitWorkflowValue = async (action: 'APPROVE' | 'REJECT' | 'CONFIRM' | 'ARCHIVE') => {
    if (!workflowTarget) return;
    try {
      const values = await workflowForm.validateFields();
      await submitWorkflow.mutateAsync({ id: workflowTarget.id, input: { action, comment: values.comment } });
      setWorkflowTarget(null);
      workflowForm.resetFields();
      messageApi.success('流程处理已提交');
    } catch (error) { if (error instanceof Error) messageApi.error(error.message); }
  };

  const assessmentRows = useMemo(() => inbox.data?.assessmentTasks ?? [], [inbox.data]);
  const workflowRows = useMemo(() => inbox.data?.workflowTasks ?? [], [inbox.data]);

  if (!authorized) {
    return <main className="performance-feishu-inbox-page">{contextHolder}<Card><Skeleton loading={loadingAuthorization} active>{authorizationError ? <Alert type="error" showIcon message="飞书身份授权失败" description={authorizationError} /> : <Empty description="正在等待飞书身份授权，请从飞书个人提醒卡片进入" />}</Skeleton></Card></main>;
  }
  return <main className="performance-feishu-inbox-page">
    {contextHolder}
    {inbox.isError ? <Alert type="error" showIcon message="无法加载飞书绩效待办" description={inbox.error.message} /> : null}
    {inbox.isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : <>
      <header className="performance-feishu-inbox-heading"><div><Typography.Text type="secondary">飞书个人待办</Typography.Text><Typography.Title level={2}>{inbox.data?.cycleName ?? '绩效活动待办'}</Typography.Title><Typography.Text>{inbox.data?.employeeName}（{inbox.data?.employeeNo}）</Typography.Text></div><Tag color={inbox.data?.totalPending ? 'processing' : 'default'}>待处理 {inbox.data?.totalPending ?? 0} 项</Tag></header>
      <Card title="待提交评价" className="performance-feishu-inbox-card">
        {assessmentRows.length === 0 ? <Empty description="暂无待提交评价" /> : <List<PerformanceTaskListItem> dataSource={assessmentRows} renderItem={(task) => <List.Item actions={[<Button key="handle" type="link" onClick={() => setAssessmentTarget(task)}>处理</Button>]}><List.Item.Meta title={task.moduleName} description={`${task.employeeName}（${task.employeeNo}）`} /><Tag>{task.moduleType === 'EVALUATION' ? '人工评估' : '结果调整'}</Tag></List.Item>} />}
      </Card>
      <Card title="待审核 / 流程处理" className="performance-feishu-inbox-card">
        {workflowRows.length === 0 ? <Empty description="暂无待审核事项" /> : <List<PerformanceWorkflowTaskListItem> dataSource={workflowRows} renderItem={(task) => <List.Item actions={[<Button key="handle" type="link" onClick={() => setWorkflowTarget(task)}>处理</Button>]}><List.Item.Meta title={task.stepName} description={<Space direction="vertical" size={0}><span>{task.employeeName}（{task.employeeNo}）</span><span>最终得分：{scoreDisplay(task.finalScore)}　实际金额：{moneyDisplay(task.actualAmount)}</span></Space>} /><Tag>{task.stepType}</Tag></List.Item>} />}
      </Card>
    </>}
    <Modal title={assessmentTarget ? `提交：${assessmentTarget.moduleName}` : ''} open={Boolean(assessmentTarget)} onCancel={() => setAssessmentTarget(null)} footer={null} destroyOnHidden>
      {assessmentTarget ? <Form form={assessmentForm} layout="vertical" onFinish={submitAssessmentValue}><Form.Item name={assessmentTarget.moduleType === 'EVALUATION' ? 'score' : 'adjustment'} label={assessmentTarget.moduleType === 'EVALUATION' ? '评分（0-100）' : '调整分值'} rules={[{ required: true, message: '请输入分值' }]}><InputNumber min={assessmentTarget.moduleType === 'EVALUATION' ? 0 : 0} max={assessmentTarget.moduleType === 'EVALUATION' ? 100 : undefined} style={{ width: '100%' }} /></Form.Item><Form.Item name="comment" label="评语"><Input.TextArea rows={4} /></Form.Item><Button type="primary" htmlType="submit" loading={submitAssessment.isPending}>提交</Button></Form> : null}
    </Modal>
    <Modal title={workflowTarget ? `处理：${workflowTarget.stepName}` : ''} open={Boolean(workflowTarget)} onCancel={() => setWorkflowTarget(null)} footer={null} destroyOnHidden>
      {workflowTarget ? <Form form={workflowForm} layout="vertical"><Alert type="info" showIcon message={`最终得分：${scoreDisplay(workflowTarget.finalScore)}`} description={`实际金额：${moneyDisplay(workflowTarget.actualAmount)}`} /><Form.Item name="comment" label="处理意见"><Input.TextArea rows={4} /></Form.Item><Space wrap><Button type="primary" onClick={() => void submitWorkflowValue(workflowTarget.stepType === 'CONFIRMATION' ? 'CONFIRM' : workflowTarget.stepType === 'HR_ARCHIVE' ? 'ARCHIVE' : 'APPROVE')} loading={submitWorkflow.isPending}>通过 / 确认</Button>{workflowTarget.stepType === 'REVIEW' || workflowTarget.stepType === 'APPROVAL' ? <Button danger onClick={() => void submitWorkflowValue('REJECT')} loading={submitWorkflow.isPending}>驳回</Button> : null}</Space></Form> : null}
    </Modal>
  </main>;
}
