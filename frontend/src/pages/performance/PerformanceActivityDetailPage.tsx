import { ArrowLeftOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { Alert, Button, Descriptions, Drawer, Empty, Form, Input, InputNumber, message, Modal, Pagination, Select, Skeleton, Space, Table, Tabs, Tag, Timeline, type TableColumnsType } from 'antd';
import type { EmployeeListItem, EmploymentStatus, PerformanceCycleParticipant, PerformanceFlowStepAssignee, PerformanceParticipantAssessmentDetail, PerformanceParticipantFlowStep, ProcessStatus } from '@hr-demo/shared';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';
import { useEmployees, useOrganizations } from '../../features/employees/api';
import { useAddPerformanceCycleParticipants, useCloseCycleParticipants, useCreateCycleParticipantAmountBase, usePerformanceCycle, usePerformanceParticipantAssessmentDetail, usePerformanceParticipantWorkflow, usePerformanceTemplates, useRemovePerformanceCycleParticipant, useRestartPerformanceCycle, useStartPerformanceCycle, useUpdatePerformanceCycleParticipantTemplate } from '../../features/performance/api';

const processStatusLabels: Record<ProcessStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待开始',
  APPROVED: '已批准',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const taskStatusLabels: Record<PerformanceParticipantFlowStep['status'], string> = {
  PENDING: '未开始',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const employmentStatusLabels: Record<EmploymentStatus, string> = {
  PROBATION: '试用',
  REGULAR: '在职',
  PENDING_ENTRY: '待入职',
  TRANSFERRED_OUT: '已调出',
  PENDING_TRANSFER_IN: '待调入',
  RETIRED: '退休',
  RESIGNED: '离职',
  NON_REGULAR: '非正式',
};

function score(value: number | null) {
  return value === null ? '--' : value.toFixed(3);
}

function coefficient(value: number | null) {
  return value === null ? '--' : value.toFixed(3);
}

function formatDateTime(value: string | null) {
  if (!value) return '--';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function deliveryLabel(assignee: PerformanceFlowStepAssignee) {
  if (!assignee.deliveryStatus) return '未送达';
  if (assignee.deliveryStatus === 'DELIVERED') return '已送达';
  if (assignee.deliveryStatus === 'PENDING') return '投递中';
  if (assignee.deliveryStatus === 'SKIPPED') return '未送达';
  return '投递失败';
}

function scoreDisplay(value: number | null | undefined, precision = 4) {
  return value === null || value === undefined ? '--' : value.toFixed(precision);
}

function moneyDisplay(value: number | null | undefined) {
  return value === null || value === undefined ? '--' : value.toFixed(2);
}

type AssessmentDetailRow = PerformanceParticipantAssessmentDetail['modules'][number]['indicators'][number] & {
  assessmentRingName: string;
  assessmentRingWeight: number | null;
  assessmentRingScore: number | null;
  assessmentRingWeightedScore: number | null;
  assessmentRingStatus: PerformanceParticipantAssessmentDetail['modules'][number]['status'];
  assessmentRingScorers: string[];
  isFirstIndicatorInRing: boolean;
  assessmentRingRowSpan: number;
};

function AssessmentDetailContent({ detail }: { detail: PerformanceParticipantAssessmentDetail | undefined }) {
  if (!detail) return <Empty description="暂无考核表详情" />;
  if (detail.modules.length === 0) return <Empty description="活动尚未生成考核模块" />;
  const rows: AssessmentDetailRow[] = detail.modules.flatMap((module) => {
    const indicators = module.indicators.length > 0
      ? module.indicators
      : [{
          id: `module-${module.id}`,
          name: '未配置指标',
          description: '',
          standards: [],
          moduleName: module.name,
          moduleType: module.type,
          scorerNames: module.scorerNames,
          rawScore: null,
          indicatorWeight: null,
          weightedScore: null,
          scoreStatus: module.status,
          scoreSource: 'UNAVAILABLE' as const,
        }];
    return indicators.map((indicator, index) => ({
      ...indicator,
      assessmentRingName: module.name,
      assessmentRingWeight: module.weight,
      assessmentRingScore: module.moduleScore,
      assessmentRingWeightedScore: module.weightedScore,
      assessmentRingStatus: module.status,
      assessmentRingScorers: module.scorerNames,
      isFirstIndicatorInRing: index === 0,
      assessmentRingRowSpan: indicators.length,
    }));
  });
  const ringCell = (row: AssessmentDetailRow) => ({
    rowSpan: row.isFirstIndicatorInRing ? row.assessmentRingRowSpan : 0,
  });
  const columns: TableColumnsType<AssessmentDetailRow> = [
    {
      title: '考核环节',
      key: 'assessmentRing',
      width: 190,
      onCell: ringCell,
      render: (_, row) => row.isFirstIndicatorInRing ? <div className="performance-assessment-ring-cell">
        <strong>{row.assessmentRingName}</strong>
        <span>评分人：{row.assessmentRingScorers.length ? row.assessmentRingScorers.join('、') : '--'}</span>
        <span>环节权重：{row.assessmentRingWeight === null ? '--' : `${scoreDisplay(row.assessmentRingWeight, 2)}%`}</span>
        <span>加权得分：{scoreDisplay(row.assessmentRingWeightedScore)}</span>
      </div> : null,
    },
    {
      title: '指标名称',
      dataIndex: 'name',
      key: 'name',
      width: 184,
      render: (value: string, row) => <div className="performance-assessment-indicator-name">
        <strong>{value || '--'}</strong>
        <span>指标权重：{row.indicatorWeight === null ? '--' : `${scoreDisplay(row.indicatorWeight, 2)}%`}</span>
      </div>,
    },
    {
      title: '衡量标准/评分标准',
      key: 'standards',
      render: (_, row) => row.standards.length
        ? <ul className="performance-assessment-standards">{row.standards.map((standard) => <li key={standard}>{standard}</li>)}</ul>
        : <span className="performance-assessment-description">{row.description || '--'}</span>,
    },
    {
      title: '考核环得分',
      key: 'assessmentRingScore',
      width: 132,
      onCell: ringCell,
      render: (_, row) => row.isFirstIndicatorInRing ? <strong className="performance-assessment-ring-score">{scoreDisplay(row.assessmentRingScore)}</strong> : null,
    },
    {
      title: '状态',
      key: 'status',
      width: 104,
      onCell: ringCell,
      render: (_, row) => row.isFirstIndicatorInRing
        ? <Tag color={row.assessmentRingStatus === 'COMPLETED' ? 'success' : row.assessmentRingStatus === 'IN_PROGRESS' ? 'processing' : 'default'}>{taskStatusLabels[row.assessmentRingStatus]}</Tag>
        : null,
    },
  ];
  return <div className="performance-assessment-detail-content">
    <Table className="performance-assessment-detail-table" rowKey="id" columns={columns} dataSource={rows} pagination={false} tableLayout="fixed" scroll={{ x: 940 }} />
    <Descriptions className="performance-assessment-summary" column={1} bordered size="small" title="得分与最终金额">
      <Descriptions.Item label="最终得分">{scoreDisplay(detail.finalScore)}</Descriptions.Item>
      <Descriptions.Item label="最终系数">{scoreDisplay(detail.finalCoefficient)}</Descriptions.Item>
      <Descriptions.Item label="金额基数">{moneyDisplay(detail.employeeAmountBaseSnapshot)}</Descriptions.Item>
      <Descriptions.Item label="金额基数版本">{detail.employeeAmountBaseVersionNo ?? '--'}</Descriptions.Item>
      <Descriptions.Item label="计算公式">{detail.calculationFormula ?? '--'}</Descriptions.Item>
      <Descriptions.Item label="最终金额">{moneyDisplay(detail.actualAmount)}</Descriptions.Item>
      {detail.emptyReason ? <Descriptions.Item label="计算状态">{detail.emptyReason}</Descriptions.Item> : null}
    </Descriptions>
  </div>;
}

export function PerformanceActivityDetailPage() {
  const { activityId = '' } = useParams();
  const cycle = usePerformanceCycle(activityId);
  const [messageApi, contextHolder] = message.useMessage();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeListItem | null>(null);
  const [participantTemplateVersionId, setParticipantTemplateVersionId] = useState<string>();
  const [templateTarget, setTemplateTarget] = useState<PerformanceCycleParticipant | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PerformanceCycleParticipant | null>(null);
  const [replacementTemplateVersionId, setReplacementTemplateVersionId] = useState<string>();
  const [amountTarget, setAmountTarget] = useState<PerformanceCycleParticipant | null>(null);
  const [amountForm] = Form.useForm<{ amount: number; effectiveAt: string; reason: string }>();
  const [selectedParticipant, setSelectedParticipant] = useState<PerformanceCycleParticipant | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'assessment' | 'workflow'>('assessment');
  const [selectedStepId, setSelectedStepId] = useState<string>();
  const organizations = useOrganizations();
  const employeeQuery = useEmployees({
    organizationId,
    keyword: keyword || undefined,
    page: 1,
    pageSize: 100,
  });
  const addParticipants = useAddPerformanceCycleParticipants();
  const startCycle = useStartPerformanceCycle();
  const restartCycle = useRestartPerformanceCycle();
  const closeCycleParticipants = useCloseCycleParticipants();
  const updateParticipantTemplate = useUpdatePerformanceCycleParticipantTemplate();
  const removeParticipant = useRemovePerformanceCycleParticipant();
  const createParticipantAmountBase = useCreateCycleParticipantAmountBase();
  const templates = usePerformanceTemplates();
  const publishedTemplates = useMemo(() => (templates.data ?? []).filter((template) => template.latestVersion?.status === 'PUBLISHED' && template.latestVersion.id), [templates.data]);
  const assessmentDetail = usePerformanceParticipantAssessmentDetail(activityId, selectedParticipant?.id ?? '', drawerOpen && drawerTab === 'assessment');
  const workflow = usePerformanceParticipantWorkflow(activityId, selectedParticipant?.id ?? '', drawerOpen && drawerTab === 'workflow');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const existingEmployeeIds = useMemo(() => new Set(cycle.data?.instances.map((item) => item.employeeId) ?? []), [cycle.data?.instances]);
  const participantOptions = useMemo(() => {
    const available = (employeeQuery.data?.data ?? []).filter((employee) => !existingEmployeeIds.has(employee.id));
    const retained = selectedEmployee && !existingEmployeeIds.has(selectedEmployee.id) && !available.some((item) => item.id === selectedEmployee.id)
      ? [selectedEmployee]
      : [];
    return [...retained, ...available];
  }, [employeeQuery.data?.data, existingEmployeeIds, selectedEmployee]);
  const canAddParticipants = cycle.data?.status === 'DRAFT' || cycle.data?.status === 'IN_PROGRESS';
  const pagedParticipants = useMemo(() => (cycle.data?.instances ?? []).slice((page - 1) * pageSize, page * pageSize), [cycle.data?.instances, page]);
  const selectedStep = workflow.data?.steps.find((step) => step.id === selectedStepId) ?? workflow.data?.steps[0] ?? null;

  const resetPicker = () => {
    setPickerOpen(false);
    setOrganizationId(undefined);
    setKeyword('');
    setSelectedEmployee(null);
    setParticipantTemplateVersionId(undefined);
  };

  const openAssessmentDetail = (participant: PerformanceCycleParticipant) => {
    setSelectedParticipant(participant);
    setSelectedStepId(undefined);
    setDrawerTab('assessment');
    setDrawerOpen(true);
  };

  const openFlow = (participant: PerformanceCycleParticipant) => {
    setSelectedParticipant(participant);
    setSelectedStepId(undefined);
    setDrawerTab('workflow');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedParticipant(null);
    setSelectedStepId(undefined);
  };

  const startPerformance = async () => {
    try {
      await startCycle.mutateAsync(activityId);
      messageApi.success('绩效已开启，当前节点的飞书个人卡片正在发送');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '开启绩效失败');
    }
  };

  const restartSelected = async () => {
    if (selectedRowKeys.length === 0) return messageApi.error('请选择需要重启的被考核人');
    try { await restartCycle.mutateAsync({ id: activityId, employeeIds: selectedRowKeys }); setSelectedRowKeys([]); messageApi.success('已重启选中人员的绩效'); } catch (error) { messageApi.error(error instanceof Error ? error.message : '重启绩效失败'); }
  };

  const closeSelected = async () => {
    if (selectedRowKeys.length === 0) return messageApi.error('请选择需要关闭的被考核人');
    try { await closeCycleParticipants.mutateAsync({ id: activityId, employeeIds: selectedRowKeys }); setSelectedRowKeys([]); messageApi.success('已关闭并移除选中人员'); } catch (error) { messageApi.error(error instanceof Error ? error.message : '关闭绩效失败'); }
  };

  const saveParticipants = async () => {
    if (!selectedEmployee) {
      messageApi.error('请选择被考核人');
      return;
    }
    if (!participantTemplateVersionId) {
      messageApi.error('请选择绩效模板');
      return;
    }
    try {
      await addParticipants.mutateAsync({ id: activityId, input: { employeeId: selectedEmployee.id, templateVersionId: participantTemplateVersionId } });
      messageApi.success('被考核人已添加');
      resetPicker();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '添加被考核人失败');
    }
  };

  const removeParticipantFromCycle = async () => {
    if (!removeTarget) return;
    try {
      await removeParticipant.mutateAsync({ cycleId: activityId, employeeId: removeTarget.employeeId });
      setSelectedRowKeys((current) => current.filter((employeeId) => employeeId !== removeTarget.employeeId));
      setRemoveTarget(null);
      messageApi.success('当前活动人员已移除');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '移除当前活动人员失败');
    }
  };

  const saveParticipantTemplate = async () => {
    if (!templateTarget || !replacementTemplateVersionId) {
      messageApi.error('请选择绩效模板');
      return;
    }
    try {
      await updateParticipantTemplate.mutateAsync({ cycleId: activityId, employeeId: templateTarget.employeeId, input: { templateVersionId: replacementTemplateVersionId } });
      messageApi.success('被考核人模板已更新');
      setTemplateTarget(null);
      setReplacementTemplateVersionId(undefined);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '更新被考核人模板失败');
    }
  };

  const openAmountEditor = (participant: PerformanceCycleParticipant) => {
    setAmountTarget(participant);
    amountForm.setFieldsValue({ amount: participant.employeeAmountBaseAmount ?? undefined, effectiveAt: new Date().toISOString().slice(0, 10), reason: '' });
  };

  const saveParticipantAmountBase = async (values: { amount: number; effectiveAt: string; reason: string }) => {
    if (!amountTarget) return;
    try {
      await createParticipantAmountBase.mutateAsync({ cycleId: activityId, employeeId: amountTarget.employeeId, input: values });
      messageApi.success('金额基数已保存');
      setAmountTarget(null);
      amountForm.resetFields();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '金额基数保存失败');
    }
  };

  const columns: TableColumnsType<PerformanceCycleParticipant> = [
    {
      title: '工号',
      dataIndex: 'employeeNo',
      key: 'employeeNo',
      width: 112,
      render: (value: string) => value || '--',
    },
    {
      title: '姓名',
      dataIndex: 'employeeName',
      key: 'employeeName',
      width: 130,
      render: (value: string | null, participant) => value
        ? <Button type="link" className="performance-current-executor-link" onClick={() => openAssessmentDetail(participant)}>{value}</Button>
        : '--',
    },
    { title: '部门', dataIndex: 'organizationName', key: 'organization', width: 178, render: (value: string | null) => value ?? '--' },
    { title: '模板', dataIndex: 'templateName', key: 'template', width: 180, render: (value: string) => value || '--' },
    { title: '金额基数', key: 'amountBase', width: 170, render: (_, participant) => <Space size={6}><span>{participant.employeeAmountBaseConfigured ? '已配置' : '未配置'}</span><Button type="link" size="small" onClick={() => openAmountEditor(participant)}>编辑</Button></Space> },
    { title: '指标模板', dataIndex: 'indicatorTemplateName', key: 'indicatorTemplate', width: 150, render: (value: string | null) => value ?? '--' },
    { title: '当前步骤', key: 'currentStep', width: 168, render: (_, participant) => participant.currentStepName ? <Space size={6}>{participant.currentStepName}<Tag>{participant.currentStepKind === 'WORKFLOW' ? '后续流程' : '考核表'}</Tag></Space> : '--' },
    {
      title: '当前执行人',
      dataIndex: 'currentExecutorName',
      key: 'executor',
      width: 154,
      render: (value: string | null, participant) => value ? <Button type="link" className="performance-current-executor-link" onClick={() => openFlow(participant)}>{value}</Button> : '--',
    },
    { title: '考核组', dataIndex: 'assessmentGroupName', key: 'assessmentGroup', width: 130, render: (value: string | null) => value ?? '--' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 112,
      render: (value: ProcessStatus) => <Tag color={value === 'IN_PROGRESS' ? 'processing' : value === 'COMPLETED' ? 'success' : 'default'}>{processStatusLabels[value]}</Tag>,
    },
    { title: '总分', dataIndex: 'finalScore', key: 'score', width: 108, render: score },
    { title: '总等级', dataIndex: 'finalGrade', key: 'grade', width: 108, render: (value: string | null) => value ?? '--' },
    { title: '人员状态', dataIndex: 'employmentStatus', key: 'employmentStatus', width: 126, render: (value: EmploymentStatus | null) => value ? employmentStatusLabels[value] : '--' },
    { title: '最终系数', dataIndex: 'finalCoefficient', key: 'coefficient', width: 126, render: coefficient },
    { title: '实际金额', dataIndex: 'actualAmount', key: 'actualAmount', width: 126, render: (value: number | null | undefined) => value === null || value === undefined ? '--' : value.toFixed(2) },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, participant) => <Space size={0}>
        <Button type="link" onClick={() => { setTemplateTarget(participant); setReplacementTemplateVersionId(undefined); }}>编辑模板</Button>
        <Button type="link" danger loading={removeParticipant.isPending && removeParticipant.variables?.employeeId === participant.employeeId} onClick={() => setRemoveTarget(participant)}>移除</Button>
      </Space>,
    },
  ];

  return (
    <section className="performance-list-page performance-activity-detail-page" aria-labelledby="performance-activity-detail-title">
      {contextHolder}
      <header className="performance-page-heading performance-activity-detail-heading">
        <div className="performance-activity-title-row">
          <span className="performance-activity-title-icon" aria-hidden="true"><TeamOutlined /></span>
          <div>
            <Link className="performance-activity-back-link" to="/performance/activities"><ArrowLeftOutlined /> 员工绩效活动</Link>
            <h1 id="performance-activity-detail-title">{cycle.data?.name ?? '绩效活动详情'}</h1>
          </div>
        </div>
        {cycle.data ? <span className="performance-activity-participant-count">参与人数 {cycle.data.instances.length}</span> : null}
      </header>

      {cycle.isError ? <Alert type="error" showIcon message="无法加载绩效活动详情" description={cycle.error.message} /> : null}
      <div className="performance-activity-surface performance-activity-detail-surface">
        <div className="performance-participant-table-heading">
          <h2>被考核人</h2>
          <div className="performance-participant-table-actions">
            <span>共 {cycle.data?.instances.length ?? 0} 人</span>
            {cycle.data?.status === 'DRAFT' ? <Button type="primary" loading={startCycle.isPending} onClick={() => void startPerformance()}>开启绩效</Button> : null}
            {(cycle.data?.status === 'IN_PROGRESS' || cycle.data?.status === 'COMPLETED') ? <Button onClick={() => void restartSelected()} loading={restartCycle.isPending}>重启绩效</Button> : null}
            {(cycle.data?.status === 'IN_PROGRESS' || cycle.data?.status === 'COMPLETED') ? <Button danger onClick={() => void closeSelected()} loading={closeCycleParticipants.isPending}>关闭绩效</Button> : null}
            <Button type="primary" icon={<PlusOutlined />} disabled={!canAddParticipants} onClick={() => setPickerOpen(true)}>添加被考核人</Button>
          </div>
        </div>
        <div className="performance-table-surface performance-activity-detail-table-surface">
          {cycle.isLoading ? <Skeleton active paragraph={{ rows: 7 }} /> : (
            <Table<PerformanceCycleParticipant>
              className="performance-table performance-participant-table"
              rowKey="employeeId"
              rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as string[]), columnWidth: 44 }}
              columns={columns}
              dataSource={pagedParticipants}
              pagination={false}
              sticky={{ offsetHeader: 0, offsetScroll: 0 }}
              scroll={{ x: 2150 }}
              locale={{ emptyText: <Empty description="这里什么都没有..." /> }}
            />
          )}
        </div>
        {(cycle.data?.instances.length ?? 0) > pageSize ? <Pagination className="performance-participant-pagination" current={page} pageSize={pageSize} total={cycle.data?.instances.length ?? 0} showSizeChanger={false} onChange={setPage} /> : null}
      </div>

      <Modal
        className="performance-activity-modal"
        title="移除当前活动人员"
        open={Boolean(removeTarget)}
        onCancel={() => setRemoveTarget(null)}
        destroyOnHidden
        width={520}
        footer={[
          <Button key="cancel" onClick={() => setRemoveTarget(null)}>取消</Button>,
          <Button key="remove" danger type="primary" loading={removeParticipant.isPending} onClick={() => void removeParticipantFromCycle()}>移除</Button>,
        ]}
      >
        <Alert
          type="warning"
          showIcon
          message="确认移除当前活动人员"
          description={removeTarget ? `确定从当前绩效活动中移除 ${removeTarget.employeeName}（${removeTarget.employeeNo}）吗？该人员的考核任务、流程任务和当前结果将一并从本活动移除，不影响该员工在其他活动中的记录。` : ''}
        />
      </Modal>

      <Modal
        className="performance-activity-modal"
        title="编辑被考核人模板"
        open={Boolean(templateTarget)}
        onCancel={() => { setTemplateTarget(null); setReplacementTemplateVersionId(undefined); }}
        destroyOnHidden
        width={560}
        footer={[
          <Button key="cancel" onClick={() => { setTemplateTarget(null); setReplacementTemplateVersionId(undefined); }}>取消</Button>,
          <Button key="save" type="primary" loading={updateParticipantTemplate.isPending} onClick={() => void saveParticipantTemplate()}>保存</Button>,
        ]}
      >
        <div className="performance-participant-picker-fields">
          <label><span>被考核人</span><Input value={templateTarget ? `${templateTarget.employeeName}（${templateTarget.employeeNo}）` : ''} disabled /></label>
          <label>
            <span><i>*</i> 绩效模板</span>
            <Select
              aria-label="编辑被考核人绩效模板"
              showSearch
              optionFilterProp="label"
              placeholder="请选择已发布的绩效模板"
              value={replacementTemplateVersionId}
              options={publishedTemplates.map((template) => ({ label: template.name, value: template.latestVersion?.id }))}
              onChange={setReplacementTemplateVersionId}
            />
          </label>
        </div>
      </Modal>

      <Modal
        className="performance-activity-modal"
        title="编辑金额基数"
        open={Boolean(amountTarget)}
        onCancel={() => { setAmountTarget(null); amountForm.resetFields(); }}
        destroyOnHidden
        width={520}
        footer={null}
      >
        <Form form={amountForm} layout="vertical" onFinish={(values) => void saveParticipantAmountBase(values)}>
          <Form.Item label="被考核人"><Input value={amountTarget ? `${amountTarget.employeeName}（${amountTarget.employeeNo}）` : ''} disabled /></Form.Item>
          <Form.Item name="amount" label="金额基数" rules={[{ required: true, message: '请输入金额基数' }]}><InputNumber min={0} precision={2} step={0.01} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="effectiveAt" label="生效日期" rules={[{ required: true, message: '请选择生效日期' }]}><Input type="date" /></Form.Item>
          <Form.Item name="reason" label="修改原因" rules={[{ required: true, message: '请输入修改原因' }]}><Input.TextArea rows={3} /></Form.Item>
          <Space>
            <Button onClick={() => { setAmountTarget(null); amountForm.resetFields(); }}>取消</Button>
            <Button type="primary" htmlType="submit" loading={createParticipantAmountBase.isPending}>保存</Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        className="performance-activity-modal performance-participant-picker-modal"
        title="添加被考核人"
        open={pickerOpen}
        onCancel={resetPicker}
        destroyOnHidden
        width={620}
        footer={[
          <Button key="cancel" onClick={resetPicker}>取消</Button>,
          <Button key="save" type="primary" loading={addParticipants.isPending} onClick={() => void saveParticipants()}>保存</Button>,
        ]}
      >
        <div className="performance-participant-picker-fields">
          <label>
            <span>筛选部门</span>
            <OrganizationTreeSelect aria-label="筛选被考核人部门" allowClear organizations={organizations.data ?? []} placeholder="部门" value={organizationId} onChange={setOrganizationId} />
          </label>
          <label>
            <span>姓名或工号</span>
            <Input aria-label="搜索被考核人" allowClear placeholder="输入姓名或工号筛选" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          </label>
          <label>
            <span><i>*</i> 绩效模板</span>
            <Select
              aria-label="被考核人绩效模板"
              showSearch
              optionFilterProp="label"
              placeholder="请选择已发布的绩效模板"
              value={participantTemplateVersionId}
              options={publishedTemplates.map((template) => ({ label: template.name, value: template.latestVersion?.id }))}
              onChange={setParticipantTemplateVersionId}
            />
          </label>
          <label>
            <span><i>*</i> 具体人员</span>
            <Select
              aria-label="具体被考核人"
              showSearch={false}
              placeholder="请按部门筛选后选择人员"
              loading={employeeQuery.isFetching}
              notFoundContent={employeeQuery.isFetching ? '正在加载人员' : '没有可添加的在职人员'}
              value={selectedEmployee?.id}
              options={participantOptions.map((employee) => ({ label: `${employee.name}（${employee.employeeNo}｜${employee.organizationName ?? '--'}）`, value: employee.id }))}
              onChange={(employeeId: string) => setSelectedEmployee(participantOptions.find((employee) => employee.id === employeeId) ?? null)}
            />
          </label>
        </div>
      </Modal>

      <Drawer
        className="performance-flow-drawer performance-assessment-drawer"
        title="人员绩效详情"
        width="min(1120px, 100vw)"
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnHidden
      >
        <Descriptions className="performance-flow-summary" column={1} size="small">
          <Descriptions.Item label="被考核人员">{selectedParticipant?.employeeName ?? '--'}（{selectedParticipant?.employeeNo ?? '--'}）</Descriptions.Item>
          <Descriptions.Item label="所属绩效活动">{cycle.data?.name ?? '--'}</Descriptions.Item>
        </Descriptions>
        <Tabs activeKey={drawerTab} onChange={(key) => setDrawerTab(key as 'workflow' | 'assessment')} items={[
          { key: 'assessment', label: '考核表详情' },
          { key: 'workflow', label: '流程信息' },
        ]} />
        {drawerTab === 'assessment' && assessmentDetail.isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : null}
        {drawerTab === 'assessment' && assessmentDetail.isError ? <Alert type="error" showIcon message="无法加载考核表详情" description={assessmentDetail.error.message} /> : null}
        {drawerTab === 'assessment' && !assessmentDetail.isLoading && !assessmentDetail.isError ? <AssessmentDetailContent detail={assessmentDetail.data} /> : null}
        {drawerTab === 'workflow' && workflow.isLoading ? <Skeleton active paragraph={{ rows: 7 }} /> : null}
        {drawerTab === 'workflow' && workflow.isError ? <Alert type="error" showIcon message="无法加载流程信息" description={workflow.error.message} /> : null}
        {drawerTab === 'workflow' && !workflow.isLoading && !workflow.isError ? <div className="performance-flow-drawer-content">
          {!workflow.data?.steps.length ? <Empty description="暂无已生成的流程步骤" /> : <>
            <Timeline
              className="performance-flow-timeline"
              items={workflow.data.steps.map((step) => ({
                color: step.status === 'COMPLETED' ? 'green' : step.status === 'IN_PROGRESS' ? 'blue' : step.status === 'CANCELLED' ? 'red' : 'gray',
                children: <button type="button" className={`performance-flow-step-button${selectedStep?.id === step.id ? ' is-selected' : ''}`} onClick={() => setSelectedStepId(step.id)}><strong>{step.name}</strong><span>{taskStatusLabels[step.status]}{step.attemptNo > 1 ? ` · 第 ${step.attemptNo} 次` : ''}</span></button>,
              }))}
            />
            {selectedStep ? <section className="performance-flow-step-detail" aria-label="步骤详情">
              <header><div><strong>{selectedStep.name}</strong><span>{selectedStep.source === 'ASSESSMENT' ? '考核表步骤' : '后续流程步骤'}</span></div><Tag color={selectedStep.status === 'COMPLETED' ? 'success' : selectedStep.status === 'IN_PROGRESS' ? 'processing' : 'default'}>{taskStatusLabels[selectedStep.status]}</Tag></header>
              {selectedStep.assignees.map((assignee) => <Descriptions key={assignee.id} column={1} size="small" bordered className="performance-flow-assignee-detail" title={assignee.displayName}>
                <Descriptions.Item label="执行人">{assignee.displayName}</Descriptions.Item>
                <Descriptions.Item label="角色">{assignee.role ?? '--'}</Descriptions.Item>
                <Descriptions.Item label="通知状态">{deliveryLabel(assignee)}</Descriptions.Item>
                <Descriptions.Item label="送达时间">{assignee.deliveredAt ? formatDateTime(assignee.deliveredAt) : '未送达'}</Descriptions.Item>
                <Descriptions.Item label="提交时间">{assignee.submittedAt ? formatDateTime(assignee.submittedAt) : '未提交'}</Descriptions.Item>
                <Descriptions.Item label="是否达标">{assignee.isQualified === null ? '--' : assignee.isQualified ? '是' : '否'}</Descriptions.Item>
                <Descriptions.Item label="步骤状态">{taskStatusLabels[assignee.status]}</Descriptions.Item>
                {assignee.deliveryFailureReason ? <Descriptions.Item label="投递说明">{assignee.deliveryFailureReason}</Descriptions.Item> : null}
              </Descriptions>)}
            </section> : null}
          </>}
        </div> : null}
      </Drawer>
    </section>
  );
}
