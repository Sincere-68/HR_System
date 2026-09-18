import {
  CalendarOutlined,
  CloseOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Radio,
  Select,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  type TableColumnsType,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EmployeeListItem, PerformanceCycleListItem, PerformanceCreateCycleInput, PerformanceCyclePeriodType, PerformanceExceptionHandlerType } from '@hr-demo/shared';
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';
import { useEmployees, useOrganizations } from '../../features/employees/api';
import {
  useArchivePerformanceCycle,
  useCreatePerformanceCycle,
  usePerformanceCycles,
  usePerformanceTemplates,
  useStartPerformanceCycle,
} from '../../features/performance/api';

type ActivityFormValues = {
  name: string;
  organizationId: string;
  isPublic: 'yes' | 'no';
  linkedLevel: 'yes' | 'no';
  templateVersionId: string;
  year: string;
  period: '月度' | '季度' | '半年度' | '年度';
  periodStart: Dayjs;
  periodEnd: Dayjs;
  exceptionType: '指定人' | '直属经理';
  exceptionEmployeeId?: string;
  lockRelation: 'yes' | 'no';
};

const periodTypeByLabel: Record<ActivityFormValues['period'], PerformanceCyclePeriodType> = {
  月度: 'MONTHLY',
  季度: 'QUARTERLY',
  半年度: 'SEMIANNUAL',
  年度: 'ANNUAL',
};

const exceptionHandlerTypeByLabel: Record<ActivityFormValues['exceptionType'], PerformanceExceptionHandlerType> = {
  指定人: 'SPECIFIED_USER',
  直属经理: 'DIRECT_MANAGER',
};

const statusLabels: Record<PerformanceCycleListItem['status'], string> = {
  DRAFT: '草稿',
  PENDING: '待开始',
  APPROVED: '已批准',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

function formatDate(value: string) {
  return value ? dayjs(value).format('YYYY-MM-DD') : '--';
}

export function PerformanceActivitiesPage() {
  const [form] = Form.useForm<ActivityFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState<string>();
  const [organizationFilter, setOrganizationFilter] = useState<string>();
  const [yearFilter, setYearFilter] = useState<string>();
  const [periodFilter, setPeriodFilter] = useState<string>();
  const [activityOrganizationId, setActivityOrganizationId] = useState<string>();
  const [exceptionOrganizationId, setExceptionOrganizationId] = useState<string>();
  const [exceptionKeyword, setExceptionKeyword] = useState('');
  const [selectedExceptionEmployee, setSelectedExceptionEmployee] = useState<EmployeeListItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<PerformanceCycleListItem | null>(null);
  const watchedExceptionType = Form.useWatch('exceptionType', form);

  const cycles = usePerformanceCycles({ page: 1, pageSize: 100 });
  const organizations = useOrganizations();
  const templates = usePerformanceTemplates();
  const exceptionEmployees = useEmployees({
    keyword: exceptionKeyword || undefined,
    organizationId: exceptionOrganizationId,
    page: 1,
    pageSize: 100,
  });
  const createCycle = useCreatePerformanceCycle();
  const startCycle = useStartPerformanceCycle();
  const archiveCycle = useArchivePerformanceCycle();

  const publishedTemplates = useMemo(
    () => (templates.data ?? []).filter((template) => template.latestVersion?.status === 'PUBLISHED' && template.latestVersion.id),
    [templates.data],
  );
  const activityOrganizationName = useMemo(
    () => (organizations.data ?? []).find((organization) => organization.id === activityOrganizationId)?.name ?? null,
    [activityOrganizationId, organizations.data],
  );
  const exceptionEmployeeOptions = useMemo(() => {
    const visible = exceptionEmployees.data?.data ?? [];
    return selectedExceptionEmployee && !visible.some((employee) => employee.id === selectedExceptionEmployee.id)
      ? [...visible, selectedExceptionEmployee]
      : visible;
  }, [exceptionEmployees.data?.data, selectedExceptionEmployee]);
  const rows = useMemo(() => {
    const allRows = cycles.data?.data ?? [];
    return allRows
      .filter((row) => activeTab === 'completed' ? row.status === 'COMPLETED' : row.status !== 'COMPLETED')
      .filter((row) => !nameFilter || row.name.toLowerCase().includes(nameFilter.toLowerCase()))
      .filter((row) => !yearFilter || row.periodStart.startsWith(`${yearFilter}-`))
      .filter((row) => !periodFilter || (periodFilter === '年度' && dayjs(row.periodEnd).diff(dayjs(row.periodStart), 'month') >= 11)
        || (periodFilter === '半年度' && dayjs(row.periodEnd).diff(dayjs(row.periodStart), 'month') >= 5 && dayjs(row.periodEnd).diff(dayjs(row.periodStart), 'month') < 11)
        || (periodFilter === '季度' && dayjs(row.periodEnd).diff(dayjs(row.periodStart), 'month') >= 2 && dayjs(row.periodEnd).diff(dayjs(row.periodStart), 'month') < 5)
        || (periodFilter === '月度' && dayjs(row.periodEnd).diff(dayjs(row.periodStart), 'month') < 2))
      .filter((row) => !organizationFilter || row.organizationId === organizationFilter);
  }, [activeTab, cycles.data?.data, nameFilter, organizationFilter, periodFilter, yearFilter]);

  const resetModal = () => {
    form.resetFields();
    setActivityOrganizationId(undefined);
    setExceptionOrganizationId(undefined);
    setExceptionKeyword('');
    setSelectedExceptionEmployee(null);
    setModalOpen(false);
  };

  const submit = async (values: ActivityFormValues) => {
    const templateVersionId = values.templateVersionId;
    if (values.exceptionType === '指定人' && !values.exceptionEmployeeId) {
      messageApi.error('请选择异常处理人');
      return;
    }
    const input: PerformanceCreateCycleInput = {
      name: values.name.trim(),
      organizationId: values.organizationId,
      isPublic: values.isPublic === 'yes',
      linkedLevel: values.linkedLevel === 'yes',
      ...(templateVersionId ? { templateVersionId } : {}),
      year: Number(values.year),
      periodType: periodTypeByLabel[values.period],
      periodStart: values.periodStart.format('YYYY-MM-DD'),
      periodEnd: values.periodEnd.format('YYYY-MM-DD'),
      exceptionHandlerType: exceptionHandlerTypeByLabel[values.exceptionType],
      ...(values.exceptionType === '指定人' ? { exceptionHandlerEmployeeId: values.exceptionEmployeeId } : {}),
      lockRelation: values.lockRelation === 'yes',
    };
    try {
      await createCycle.mutateAsync(input);
      messageApi.success('绩效活动已创建');
      resetModal();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建绩效活动失败';
      if (/组织|部门|数据范围|权限/.test(errorMessage)) {
        form.setFields([{ name: 'organizationId', errors: [errorMessage] }]);
      }
      messageApi.error(errorMessage);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await startCycle.mutateAsync(id);
      messageApi.success('绩效活动已启动');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '启动绩效活动失败');
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archiveCycle.mutateAsync({ id: archiveTarget.id, input: { reason: '用户从绩效活动列表归档' } });
      messageApi.success('绩效活动已归档');
      setArchiveTarget(null);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '归档绩效活动失败');
    }
  };

  const columns: TableColumnsType<PerformanceCycleListItem> = [
    { title: '活动名称', dataIndex: 'name', key: 'name', width: 240, render: (value: string, row) => <Link className="performance-activity-name" to={`/performance/activities/${row.id}`}>{value}</Link> },
    { title: '组织', dataIndex: 'organizationName', key: 'organization', width: 170, render: (value: string | null) => value ?? '--' },
    { title: '是否公开', dataIndex: 'isPublic', key: 'isPublic', width: 110, render: (value: boolean) => value ? '是' : '否' },
    { title: '参与人数', key: 'participants', width: 110, render: (_, row) => row.instanceCount },
    { title: '创建人', dataIndex: 'createdByName', key: 'creator', width: 130, render: (value: string | null) => value ?? '--' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170, render: (value: string) => formatDate(value) },
    { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: (value: PerformanceCycleListItem['status']) => <Tag color={value === 'IN_PROGRESS' ? 'processing' : value === 'COMPLETED' ? 'success' : 'default'}>{statusLabels[value]}</Tag> },
    { title: '操作', key: 'actions', width: 220, render: (_, row) => <Space size={0}>{row.status === 'DRAFT' ? <Button type="link" loading={startCycle.isPending && startCycle.variables === row.id} onClick={() => void handleStart(row.id)}>启动</Button> : <Link to={`/performance/activities/${row.id}`}>查看</Link>}<Button danger type="link" loading={archiveCycle.isPending && archiveCycle.variables?.id === row.id} onClick={() => setArchiveTarget(row)}>删除</Button></Space> },
  ];

  return (
    <section className="performance-list-page performance-activities-page" aria-labelledby="performance-activities-title">
      {contextHolder}
      <header className="performance-page-heading performance-activities-heading">
        <div className="performance-activity-title-row">
          <span className="performance-activity-title-icon" aria-hidden="true"><TeamOutlined /></span>
          <div><span>绩效管理</span><h1 id="performance-activities-title">员工绩效活动</h1></div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增</Button>
      </header>

      <div className="performance-activity-surface">
        <Tabs
          className="performance-activity-tabs"
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as typeof activeTab)}
          items={[{ key: 'active', label: '进行中绩效活动' }, { key: 'completed', label: '已完成绩效活动' }]}
        />
        <div className="performance-activity-filters" aria-label="绩效活动筛选">
          <Select allowClear placeholder="年度" value={yearFilter} onChange={setYearFilter} options={['2026', '2025', '2024'].map((year) => ({ label: year, value: year }))} />
          <Select allowClear placeholder="周期" value={periodFilter} onChange={setPeriodFilter} options={['月度', '季度', '半年度', '年度'].map((period) => ({ label: period, value: period }))} />
          <Select allowClear placeholder="所属组织" value={organizationFilter} onChange={setOrganizationFilter} options={(organizations.data ?? []).map((organization) => ({ label: organization.name, value: organization.id }))} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="名称" value={nameFilter} onChange={setNameFilter} options={(cycles.data?.data ?? []).map((row) => ({ label: row.name, value: row.name }))} />
          <Button type="text" icon={<CloseOutlined />} onClick={() => { setYearFilter(undefined); setPeriodFilter(undefined); setOrganizationFilter(undefined); setNameFilter(undefined); }}>清除</Button>
        </div>
        {cycles.isError ? <Alert type="error" showIcon message="无法加载绩效活动" description={cycles.error.message} /> : null}
        <div className="performance-table-surface performance-activity-table-surface">
          {cycles.isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : <Table<PerformanceCycleListItem> className="performance-table" rowKey="id" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 1120 }} locale={{ emptyText: <Empty description="这里什么都没有..." /> }} />}
        </div>
      </div>

      <Modal
        title="删除绩效活动"
        open={Boolean(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
        destroyOnHidden
        okText="归档删除"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: archiveCycle.isPending }}
        onOk={() => void handleArchive()}
      >
        <p>“{archiveTarget?.name}”将被归档；活动实例、任务、结果和审计记录会保留。</p>
      </Modal>

      <Modal
        className="performance-activity-modal"
        title="新增"
        open={modalOpen}
        onCancel={resetModal}
        footer={null}
        destroyOnHidden
        width={740}
      >
        <Form<ActivityFormValues> form={form} layout="horizontal" labelCol={{ flex: '108px' }} wrapperCol={{ flex: '1' }} colon={false} onFinish={(values) => void submit(values)} initialValues={{ isPublic: 'no', linkedLevel: 'yes', lockRelation: 'no', exceptionType: '指定人', year: String(dayjs().year()), period: '季度' }}>
          <Form.Item label="活动名称" name="name" rules={[{ required: true, message: '请输入活动名称' }]}><Input placeholder="请输入" /></Form.Item>
          <Form.Item label="所属组织" name="organizationId" rules={[{ required: true, message: '请选择所属组织' }]} extra={activityOrganizationName ? `已选择：${activityOrganizationName}。将自动纳入所选组织及下级组织在活动开始日的全部有效员工。` : '将自动纳入所选组织及下级组织在活动开始日的全部有效员工。'}><OrganizationTreeSelect aria-label="活动所属组织" organizations={organizations.data ?? []} placeholder="请选择" value={activityOrganizationId} onChange={(organizationId) => { form.setFieldValue('organizationId', organizationId); form.setFields([{ name: 'organizationId', errors: [] }]); setActivityOrganizationId(organizationId); }} /></Form.Item>
          <Form.Item label="向下公开" name="isPublic"><Radio.Group><Radio value="yes">是</Radio><Radio value="no">否</Radio></Radio.Group></Form.Item>
          <Form.Item label="是否关联等级" name="linkedLevel"><Radio.Group><Radio value="yes">是</Radio><Radio value="no">否</Radio></Radio.Group></Form.Item>
          <Form.Item label="绩效模板" name="templateVersionId"><Select allowClear showSearch optionFilterProp="label" placeholder="可暂不选择，添加被考核人时指定模板" notFoundContent={templates.isLoading ? '正在加载模板' : '暂无已发布的绩效模板'} options={publishedTemplates.map((template) => ({ label: `${template.name}（V${template.latestVersion?.versionNo}）`, value: template.latestVersion?.id }))} /></Form.Item>
          <div className="performance-activity-form-grid">
            <Form.Item label="年度" name="year" rules={[{ required: true, message: '请选择年度' }]}><Select options={['2026', '2025', '2024'].map((year) => ({ label: year, value: year }))} /></Form.Item>
            <Form.Item label="周期" name="period" rules={[{ required: true, message: '请选择周期' }]}><Select options={['月度', '季度', '半年度', '年度'].map((period) => ({ label: period, value: period }))} /></Form.Item>
          </div>
          <div className="performance-activity-form-grid">
            <Form.Item label="开始时间" name="periodStart" rules={[{ required: true, message: '请选择开始时间' }]}><DatePicker className="performance-activity-date-picker" placeholder="开始时间" suffixIcon={<CalendarOutlined />} /></Form.Item>
            <Form.Item label="结束时间" name="periodEnd" rules={[{ required: true, message: '请选择结束时间' }]}><DatePicker className="performance-activity-date-picker" placeholder="结束时间" suffixIcon={<CalendarOutlined />} /></Form.Item>
          </div>
          <Form.Item label="异常处理人类型" name="exceptionType"><Select onChange={(value: ActivityFormValues['exceptionType']) => { if (value === '直属经理') { form.setFieldValue('exceptionEmployeeId', undefined); setSelectedExceptionEmployee(null); } }} options={[{ label: '指定人', value: '指定人' }, { label: '直属经理', value: '直属经理' }]} /></Form.Item>
          {watchedExceptionType === '指定人' ? <>
            <Form.Item label="筛选部门"><OrganizationTreeSelect organizations={organizations.data ?? []} allowClear placeholder="部门" value={exceptionOrganizationId} onChange={setExceptionOrganizationId} /></Form.Item>
            <Form.Item label="姓名或工号"><Input aria-label="搜索异常处理人" allowClear placeholder="输入姓名或工号筛选" value={exceptionKeyword} onChange={(event) => setExceptionKeyword(event.target.value)} /></Form.Item>
            <Form.Item label="异常处理人" name="exceptionEmployeeId" rules={[{ required: true, message: '请选择异常处理人' }]}><Select showSearch={false} loading={exceptionEmployees.isFetching} notFoundContent={exceptionEmployees.isFetching ? '正在加载人员' : '没有匹配的在职人员'} placeholder="请选择" options={exceptionEmployeeOptions.map((employee) => ({ label: `${employee.name}（${employee.employeeNo}｜${employee.organizationName}）`, value: employee.id }))} onChange={(employeeId: string) => setSelectedExceptionEmployee(exceptionEmployeeOptions.find((employee) => employee.id === employeeId) ?? null)} /></Form.Item>
          </> : <Form.Item label="异常处理人"><Input value="活动启动后按被评员工的当前主要行政直属经理处理" disabled /></Form.Item>}
          <Form.Item label="锁定考核关系" name="lockRelation"><Radio.Group><Radio value="yes">是</Radio><Radio value="no">否</Radio></Radio.Group></Form.Item>
          <div className="performance-activity-modal-footer"><Space><Button onClick={resetModal}>取消</Button><Button type="primary" htmlType="submit" loading={createCycle.isPending}>保存</Button></Space></div>
        </Form>
      </Modal>
    </section>
  );
}
