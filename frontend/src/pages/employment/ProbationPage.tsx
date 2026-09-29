import {
  DownOutlined,
  UploadOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type {
  ProcessStatus,
  ProbationListItem,
  ProbationListQuery,
  ProbationListView,
} from '@hr-demo/shared';
import { PROBATION_EXPORT_FIELDS } from '@hr-demo/shared';
import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { Key } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';
import { downloadTableExport } from '../../features/employees/download';
import { useOrganizations } from '../../features/employees/api';
import { ProbationImportDialog } from '../../features/employment/ProbationImportDialog';
import {
  useApproveProbation,
  useConfirmProbation,
  useProbation,
  useProbationApprovers,
  useRemindProbationApproval,
  useReturnProbationToEvaluation,
  useStartProbationConfirmations,
  useStartProbationEvaluation,
  useStartProbationEvaluations,
  useSubmitProbationConfirmation,
  useTransferProbationApproval,
  useUpdateProbation,
} from '../../features/employment/api';

const statusLabels: Record<ProcessStatus, string> = {
  DRAFT: '待发起',
  PENDING: '待确认',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
  IN_PROGRESS: '考核中',
  COMPLETED: '已转正',
  CANCELLED: '已取消',
};

const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));
const probationMonthOptions = [1, 2, 3, 6].map((value) => ({ value, label: `${value} 个月` }));
const expiringDayOptions = [7, 15, 30, 60].map((value) => ({ value, label: `试用到期天数：${value}` }));

interface ProbationDateFormValues {
  startDate: Dayjs;
  plannedEndDate: Dayjs;
}

interface EvaluationFormValues {
  evaluation: string;
  approverUserId: string;
}

interface ConfirmationFormValues {
  confirmedDate: Dayjs;
}

interface ApproverFormValues {
  approverUserId: string;
}

const editableProbationStatuses: ProcessStatus[] = [
  'DRAFT',
  'IN_PROGRESS',
  'PENDING',
  'APPROVED',
];

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function optionalPositiveInt(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function isView(value: string | null): value is ProbationListView {
  return value === 'expiring'
    || value === 'reviewing'
    || value === 'approval'
    || value === 'all'
    || value === 'completed';
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function StatusCell({ status }: { status: ProcessStatus }) {
  const color = status === 'COMPLETED' || status === 'APPROVED'
    ? 'success'
    : status === 'PENDING' || status === 'IN_PROGRESS'
      ? 'processing'
      : status === 'REJECTED' || status === 'CANCELLED'
        ? 'error'
        : 'default';
  return <Tag color={color}>{statusLabels[status]}</Tag>;
}

function ExpiringDaysCell({ days }: { days: number }) {
  if (days < 0) return <Tag color="error">逾期 {Math.abs(days)} 天</Tag>;
  if (days === 0) return <Tag color="warning">今日到期</Tag>;
  return <Tag color={days <= 7 ? 'warning' : 'processing'}>剩余 {days} 天</Tag>;
}

function resultLabel(result: string | null) {
  if (result === '建议转正') return '建议转正';
  if (result === '已转正') return '已转正';
  return displayValue(result);
}

export function ProbationPage() {
  const [messageApi, messageContext] = message.useMessage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editForm] = Form.useForm<ProbationDateFormValues>();
  const [evaluationForm] = Form.useForm<EvaluationFormValues>();
  const [confirmationForm] = Form.useForm<ConfirmationFormValues>();
  const [batchConfirmationForm] = Form.useForm<ApproverFormValues>();
  const [transferForm] = Form.useForm<ApproverFormValues>();
  const [keywordInput, setKeywordInput] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [editTarget, setEditTarget] = useState<ProbationListItem | null>(null);
  const [evaluationTarget, setEvaluationTarget] = useState<ProbationListItem | null>(null);
  const [confirmationTarget, setConfirmationTarget] = useState<ProbationListItem | null>(null);
  const [approveTarget, setApproveTarget] = useState<ProbationListItem | null>(null);
  const [batchConfirmationOpen, setBatchConfirmationOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<ProbationListItem | null>(null);
  const [exportingScope, setExportingScope] = useState<'selected' | 'all' | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedDraft, setAdvancedDraft] = useState<{ startDateFrom?: string; startDateTo?: string }>({});
  const [importOpen, setImportOpen] = useState(false);

  const probationView = isView(searchParams.get('view')) ? searchParams.get('view') as ProbationListView : 'expiring';
  const query = useMemo<ProbationListQuery>(() => ({
    view: probationView,
    keyword: searchParams.get('keyword') || undefined,
    organizationId: searchParams.get('organizationId') || undefined,
    probationMonths: optionalPositiveInt(searchParams.get('probationMonths')),
    expiresWithinDays: probationView === 'expiring'
      ? positiveInt(searchParams.get('expiresWithinDays'), 30)
      : undefined,
    status: probationView === 'all'
      ? (searchParams.get('status') as ProcessStatus | null) ?? undefined
      : undefined,
    startDateFrom: searchParams.get('startDateFrom') || undefined,
    startDateTo: searchParams.get('startDateTo') || undefined,
    plannedEndDateFrom: searchParams.get('plannedEndDateFrom') || undefined,
    plannedEndDateTo: searchParams.get('plannedEndDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [probationView, searchParams]);

  const probation = useProbation(query);
  const organizations = useOrganizations();
  const updateProbation = useUpdateProbation();
  const startEvaluation = useStartProbationEvaluation();
  const startEvaluations = useStartProbationEvaluations();
  const startConfirmations = useStartProbationConfirmations();
  const submitConfirmation = useSubmitProbationConfirmation();
  const confirmProbation = useConfirmProbation();
  const approveProbation = useApproveProbation();
  const returnToEvaluation = useReturnProbationToEvaluation();
  const remindApproval = useRemindProbationApproval();
  const transferApproval = useTransferProbationApproval();
  const approvers = useProbationApprovers(
    Boolean(evaluationTarget || batchConfirmationOpen || transferTarget),
  );
  const searchKey = searchParams.toString();

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [searchKey]);

  useEffect(() => {
    setKeywordInput(query.keyword ?? '');
  }, [query.keyword]);

  const patchSearch = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const changeView = (view: ProbationListView) => {
    patchSearch({
      view,
      status: undefined,
      expiresWithinDays: view === 'expiring' ? query.expiresWithinDays ?? 30 : undefined,
      page: 1,
    });
  };

  const clearFilters = () => {
    patchSearch({
      keyword: undefined,
      organizationId: undefined,
      probationMonths: undefined,
      plannedEndDateFrom: undefined,
      plannedEndDateTo: undefined,
      startDateFrom: undefined,
      startDateTo: undefined,
      expiresWithinDays: probationView === 'expiring' ? 30 : undefined,
      status: undefined,
      page: 1,
    });
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    patchSearch({ page: pagination.current ?? 1, pageSize: pagination.pageSize ?? 10 });
  };

  const openEdit = (record: ProbationListItem) => {
    editForm.setFieldsValue({
      startDate: dayjs(record.startDate),
      plannedEndDate: dayjs(record.plannedEndDate),
    });
    setEditTarget(record);
  };

  const openAdvancedFilters = () => {
    setAdvancedDraft({
      startDateFrom: query.startDateFrom,
      startDateTo: query.startDateTo,
    });
    setAdvancedOpen(true);
  };

  const cancelAdvancedFilters = () => {
    setAdvancedOpen(false);
    setAdvancedDraft({});
  };

  const applyAdvancedFilters = () => {
    patchSearch({ ...advancedDraft, page: 1 });
    setAdvancedOpen(false);
  };

  const openConfirmation = (record: ProbationListItem) => {
    confirmationForm.setFieldsValue({ confirmedDate: dayjs() });
    setConfirmationTarget(record);
  };

  const selectedRecords = (probation.data?.data ?? []).filter((record) => (
    selectedRowKeys.includes(record.id)
  ));

  const selectedRecordsWithStatus = (
    statuses: ProcessStatus[],
    emptyMessage: string,
    invalidMessage: string,
  ) => {
    if (selectedRecords.length === 0) {
      messageApi.warning(emptyMessage);
      return [];
    }
    if (selectedRecords.some((record) => !statuses.includes(record.status))) {
      messageApi.warning(invalidMessage);
      return [];
    }
    return selectedRecords;
  };

  const handleStartEvaluation = async (record: ProbationListItem) => {
    try {
      await startEvaluation.mutateAsync(record.id);
      messageApi.success(`已为 ${record.employeeName} 发起转正考核`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '发起考核失败');
    }
  };

  const handleBatchStartEvaluation = async (evaluationType: 'IN_PROBATION' | 'REGULARIZATION') => {
    const records = selectedRecordsWithStatus(
      ['DRAFT'],
      '请先选择待发起的试用员工',
      '只能对待发起的试用员工发起考核',
    );
    if (records.length === 0) return;
    try {
      const result = await startEvaluations.mutateAsync({
        probationIds: records.map(({ id }) => id),
        evaluationType,
      });
      setSelectedRowKeys([]);
      messageApi.success(`已发起 ${result.updated} 条${evaluationType === 'IN_PROBATION' ? '试用中' : '转正'}考核`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '批量发起考核失败');
    }
  };

  const openBatchConfirmation = () => {
    const records = selectedRecordsWithStatus(
      ['DRAFT', 'IN_PROGRESS'],
      '请先选择待转正的试用员工',
      '只能对待发起或考核中的试用员工发起转正申请',
    );
    if (records.length === 0) return;
    batchConfirmationForm.resetFields();
    setBatchConfirmationOpen(true);
  };

  const openSubmitConfirmation = (record: ProbationListItem) => {
    evaluationForm.setFieldsValue({
      evaluation: record.evaluation ?? '',
      approverUserId: undefined,
    });
    setEvaluationTarget(record);
  };

  const openTransfer = (record: ProbationListItem) => {
    transferForm.resetFields();
    setTransferTarget(record);
  };

  const handleRemindApproval = async (record: ProbationListItem) => {
    try {
      await remindApproval.mutateAsync(record.id);
      messageApi.success('已记录催办，不代表已送达');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '催办失败');
    }
  };

  const handleExport = async (scope: 'selected' | 'all') => {
    if (scope === 'selected' && selectedRowKeys.length === 0) return;
    setExportingScope(scope);
    try {
      await downloadTableExport('/employment/probation/export', {
        format: 'XLSX',
        fields: PROBATION_EXPORT_FIELDS.map(({ key }) => key),
        ...(scope === 'selected' ? { probationIds: selectedRowKeys.map(String) } : {}),
        query: {
          view: query.view,
          keyword: query.keyword,
          organizationId: query.organizationId,
          probationMonths: query.probationMonths,
          expiresWithinDays: query.expiresWithinDays,
          status: query.status,
          startDateFrom: query.startDateFrom,
          startDateTo: query.startDateTo,
          plannedEndDateFrom: query.plannedEndDateFrom,
          plannedEndDateTo: query.plannedEndDateTo,
        },
      }, '试用管理导出');
      messageApi.success(scope === 'selected' ? '已开始导出已选记录' : '已开始导出全部记录');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '导出失败');
    } finally {
      setExportingScope(null);
    }
  };

  const handleReturnToEvaluation = (record: ProbationListItem) => {
    Modal.confirm({
      title: '退回考核',
      content: `将“${record.employeeName}”的转正确认退回考核阶段？已填写的考核评价会保留。`,
      okText: '退回考核',
      cancelText: '取消',
      onOk: async () => {
        try {
          await returnToEvaluation.mutateAsync(record.id);
          messageApi.success('已退回考核');
        } catch (error) {
          messageApi.error(error instanceof Error ? error.message : '退回考核失败');
          throw error;
        }
      },
    });
  };

  const openFaq = () => {
    Modal.info({
      title: '试用管理常见问题',
      content: '可在“即将试用到期”中选择员工并发起转正流程；试用日期可从员工行操作中维护。',
      okText: '知道了',
    });
  };

  const employeeNameCell = (value: string, record: ProbationListItem) => (
    record.canViewEmployeeDetail ? (
      <Link to={`/personnel/employees/${record.employeeId}`}>{displayValue(value)}</Link>
    ) : displayValue(value)
  );

  const actions = (record: ProbationListItem) => {
    const menuItems: Array<{ key: string; label: string }> = [];
    if (record.canManage && record.status === 'DRAFT') {
      menuItems.push({ key: 'start', label: '发起转正考核' });
    }
    if (record.canManage && record.status === 'IN_PROGRESS') {
      menuItems.push({ key: 'submit', label: '提交转正申请' });
    }
    if (record.canManage && record.status === 'PENDING') {
      if (record.canRemindApproval) menuItems.push({ key: 'remind', label: '催办' });
      if (record.canTransferApproval) {
        menuItems.push({ key: 'approve', label: '审批通过' });
        menuItems.push({ key: 'transfer', label: '转交' });
        menuItems.push({ key: 'return', label: '退回考核' });
      }
    }
    if (record.canManage && record.status === 'APPROVED') {
      menuItems.push({ key: 'confirm', label: '转正生效' });
    }

    return (
      <Space size={2} className="probation-row-actions">
        {record.canManage && editableProbationStatuses.includes(record.status) ? (
          <Button type="link" size="small" onClick={() => openEdit(record)}>编辑试用期</Button>
        ) : null}
        {menuItems.length > 0 ? (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key }) => {
                if (key === 'start') {
                  void handleStartEvaluation(record);
                  return;
                }
                if (key === 'submit') {
                  openSubmitConfirmation(record);
                  return;
                }
                if (key === 'confirm') {
                  openConfirmation(record);
                  return;
                }
                if (key === 'approve') {
                  setApproveTarget(record);
                  return;
                }
                if (key === 'remind') {
                  void handleRemindApproval(record);
                  return;
                }
                if (key === 'transfer') {
                  openTransfer(record);
                  return;
                }
                if (key === 'return') handleReturnToEvaluation(record);
              },
            }}
            trigger={['click']}
          >
            <Button
              type="link"
              size="small"
              className="probation-row-more"
              aria-label={`${record.employeeName}的更多操作`}
              loading={startEvaluation.isPending && startEvaluation.variables === record.id}
            >
              <DownOutlined />
            </Button>
          </Dropdown>
        ) : null}
      </Space>
    );
  };

  const basicIdentityColumns: ColumnsType<ProbationListItem> = [
    { title: '工号', dataIndex: 'employeeNo', width: 120, fixed: 'left', render: displayValue },
    { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: employeeNameCell },
    { title: '部门', dataIndex: 'departmentName', width: 180, render: displayValue },
    { title: '职位', dataIndex: 'positionName', width: 160, render: displayValue },
    { title: '试用开始日期', dataIndex: 'startDate', width: 140, render: displayValue },
    { title: '预计试用结束日期', dataIndex: 'plannedEndDate', width: 160, render: displayValue },
  ];
  const actionColumn: ColumnsType<ProbationListItem>[number] = {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 150,
    render: (_, record) => actions(record),
  };
  const columns: ColumnsType<ProbationListItem> = probationView === 'reviewing'
    ? [
        { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: employeeNameCell },
        { title: '工号', dataIndex: 'employeeNo', width: 120, fixed: 'left', render: displayValue },
        { title: '部门', dataIndex: 'departmentName', width: 180, render: displayValue },
        { title: '机构', dataIndex: 'organizationName', width: 180, render: displayValue },
        { title: '职务', dataIndex: 'jobTitleName', width: 160, render: displayValue },
        { title: '试用开始日期', dataIndex: 'startDate', width: 140, render: displayValue },
        { title: '预计试用结束日期', dataIndex: 'plannedEndDate', width: 160, render: displayValue },
        { title: '考核名称', dataIndex: 'evaluationName', width: 180, render: displayValue },
        { title: '考核评价', dataIndex: 'evaluation', width: 260, ellipsis: true, render: displayValue },
        { title: '转正意见', dataIndex: 'result', width: 130, render: resultLabel },
        {
          title: '审批状态',
          dataIndex: 'evaluationApprovalStatus',
          width: 120,
          render: (status: ProcessStatus | null) => status ? <StatusCell status={status} /> : '--',
        },
        actionColumn,
      ]
    : probationView === 'approval'
      ? [
          ...basicIdentityColumns,
          {
            title: '转正审批状态',
            dataIndex: 'approvalStatus',
            width: 130,
            render: (status: ProcessStatus | null) => status ? <StatusCell status={status} /> : '--',
          },
          { title: '当前审批人', dataIndex: 'currentApproverName', width: 220, render: displayValue },
          actionColumn,
        ]
      : probationView === 'completed'
        ? [
            { title: '工号', dataIndex: 'employeeNo', width: 120, fixed: 'left', render: displayValue },
            { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: employeeNameCell },
            { title: '部门', dataIndex: 'departmentName', width: 180, render: displayValue },
            { title: '职位', dataIndex: 'positionName', width: 160, render: displayValue },
            { title: '试用开始日期', dataIndex: 'startDate', width: 140, render: displayValue },
            { title: '转正日期', dataIndex: 'confirmedDate', width: 130, render: displayValue },
            {
              title: '转正审批状态',
              dataIndex: 'approvalStatus',
              width: 140,
              render: (status: ProcessStatus | null) => status ? <StatusCell status={status} /> : '--',
            },
          ]
        : probationView === 'all'
          ? [
              { title: '姓名', dataIndex: 'employeeName', width: 120, fixed: 'left', render: employeeNameCell },
              { title: '工号', dataIndex: 'employeeNo', width: 120, fixed: 'left', render: displayValue },
              { title: '机构', dataIndex: 'organizationName', width: 180, render: displayValue },
              { title: '部门', dataIndex: 'departmentName', width: 180, render: displayValue },
              { title: '职位', dataIndex: 'positionName', width: 160, render: displayValue },
              { title: '试用开始日期', dataIndex: 'startDate', width: 140, render: displayValue },
              { title: '预计试用结束日期', dataIndex: 'plannedEndDate', width: 160, render: displayValue },
              { title: '转正意见', dataIndex: 'result', width: 130, render: resultLabel },
              {
                title: '转正审批状态',
                dataIndex: 'approvalStatus',
                width: 140,
                render: (status: ProcessStatus | null) => status ? <StatusCell status={status} /> : '--',
              },
              { title: '当前审批人', dataIndex: 'currentApproverName', width: 220, render: displayValue },
              actionColumn,
            ]
          : [...basicIdentityColumns, actionColumn];

  const probationTotal = probation.data?.meta.total ?? 0;
  const probationPageSize = query.pageSize ?? 10;
  const hasPagination = probationTotal > probationPageSize;
  const plannedEndDateLabel = query.plannedEndDateFrom || query.plannedEndDateTo
    ? `${query.plannedEndDateFrom ?? '开始日期'} 至 ${query.plannedEndDateTo ?? '结束日期'}`
    : '预计试用结束日期';
  const approverOptions = (approvers.data ?? []).map((approver) => ({
    value: approver.id,
    label: approver.workEmail
      ? `${approver.displayName}(${approver.workEmail})`
      : approver.displayName,
  }));

  return (
    <section className="employee-list-page employment-probation-page" aria-labelledby="probation-heading">
      {messageContext}
      <header className="employee-page-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><UserSwitchOutlined /></span>
          <nav className="blacklist-heading-tabs" aria-label="试用管理功能">
            <button
              className={`blacklist-heading-tab${probationView === 'expiring' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('expiring')}
            >
              <h1 id="probation-heading">即将试用到期</h1>
            </button>
            <button
              className={`blacklist-heading-tab${probationView === 'reviewing' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('reviewing')}
            >
              考核中
            </button>
            <button
              className={`blacklist-heading-tab${probationView === 'approval' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('approval')}
            >
              转正审批中
            </button>
            <button
              className={`blacklist-heading-tab${probationView === 'all' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('all')}
            >
              全部试用员工
            </button>
            <button
              className={`blacklist-heading-tab${probationView === 'completed' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('completed')}
            >
              已转正
            </button>
          </nav>
        </div>
      </header>

      {probationView === 'expiring' ? (
        <Alert
          className="probation-info-banner"
          type="info"
          showIcon
          closable
          message={(
            <>
              在此页面可查看试用期即将到期且未发起转正考核/申请的人员，可在此页面发起人员的转正业务
              <Button type="link" size="small" onClick={openFaq}>更多常见问题及解答</Button>
            </>
          )}
        />
      ) : null}

      {probation.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="试用管理加载失败"
          description={probation.error.message}
          action={<Button size="small" onClick={() => probation.refetch()}>重试</Button>}
        />
      ) : null}
      {organizations.isError ? (
        <Alert
          className="content-alert"
          type="warning"
          showIcon
          message="部门筛选加载失败"
          description={organizations.error instanceof Error ? organizations.error.message : '暂时无法加载部门选项，列表仍可正常使用。'}
          action={<Button size="small" onClick={() => organizations.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-toolbar probation-filter-toolbar">
          <div className="probation-filter-controls">
            <Popover
              trigger="click"
              placement="bottomLeft"
              content={(
                <Input.Search
                  className="probation-filter-popup-search"
                  allowClear
                  value={keywordInput}
                  aria-label="搜索人员"
                  placeholder="搜索姓名或工号"
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
                />
              )}
            >
              <Button type="text" className="probation-filter-trigger" aria-label="筛选人员">
                {query.keyword ? `人员：${query.keyword}` : '人员'} <DownOutlined />
              </Button>
            </Popover>
            <Select
              allowClear
              aria-label="筛选试用期月数"
              placeholder="试用期(月)"
              className="probation-filter-select"
              variant="borderless"
              style={{ width: 116 }}
              options={probationMonthOptions}
              value={query.probationMonths}
              onChange={(probationMonths) => patchSearch({ probationMonths, page: 1 })}
            />
            <Popover
              trigger="click"
              placement="bottomLeft"
              content={(
                <DatePicker.RangePicker
                  aria-label="筛选预计试用结束日期"
                  value={query.plannedEndDateFrom && query.plannedEndDateTo
                    ? [dayjs(query.plannedEndDateFrom), dayjs(query.plannedEndDateTo)]
                    : null}
                  onChange={(_, dates) => patchSearch({
                    plannedEndDateFrom: dates[0] || undefined,
                    plannedEndDateTo: dates[1] || undefined,
                    page: 1,
                  })}
                />
              )}
            >
              <Button type="text" className="probation-filter-trigger probation-date-filter" aria-label="筛选预计试用结束日期">
                {plannedEndDateLabel} <DownOutlined />
              </Button>
            </Popover>
            <OrganizationTreeSelect
              allowClear
              aria-label="筛选试用部门"
              className="department-filter-tree-select"
              variant="borderless"
              placeholder="部门"
              loading={organizations.isLoading}
              value={query.organizationId}
              organizations={organizations.data ?? []}
              onChange={(organizationId) => patchSearch({ organizationId, page: 1 })}
              style={{ width: 92 }}
            />
            {probationView === 'expiring' ? (
              <Select
                aria-label="筛选试用到期天数"
                className="probation-expiry-select"
                variant="borderless"
                style={{ width: 142 }}
                options={expiringDayOptions}
                value={query.expiresWithinDays}
                onChange={(expiresWithinDays) => patchSearch({ expiresWithinDays, page: 1 })}
              />
            ) : null}
            {probationView === 'all' ? (
              <Select
                allowClear
                aria-label="筛选试用流程状态"
                placeholder="审批状态"
                className="probation-filter-select"
                variant="borderless"
                style={{ width: 110 }}
                options={statusOptions}
                value={query.status}
                onChange={(status) => patchSearch({ status, page: 1 })}
              />
            ) : null}
            <Button type="link" size="small" onClick={openAdvancedFilters}>高级筛选</Button>
            <Button type="link" size="small" onClick={clearFilters}>清空已选</Button>
          </div>
          <Space size={12} className="probation-toolbar-actions">
            <Button aria-label="导入试用记录" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>导入</Button>
            {probationView === 'expiring' ? (
              <Button
                type="primary"
                className="probation-primary-action"
                disabled={selectedRowKeys.length === 0}
                loading={startConfirmations.isPending}
                onClick={openBatchConfirmation}
              >
                批量转正
              </Button>
            ) : null}
            {probationView === 'all' ? (
              <>
                <Button
                  type="primary"
                  className="probation-primary-action"
                  disabled={selectedRowKeys.length === 0}
                  loading={startConfirmations.isPending}
                  onClick={openBatchConfirmation}
                >
                  批量转正申请
                </Button>
                <Button
                  disabled={selectedRowKeys.length === 0}
                  loading={startEvaluations.isPending}
                  onClick={() => void handleBatchStartEvaluation('IN_PROBATION')}
                >
                  发起试用中考核
                </Button>
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'regularization-evaluation',
                        label: '发起转正考核',
                        disabled: selectedRowKeys.length === 0,
                      },
                      {
                        key: 'export',
                        label: '导出',
                        children: [
                          {
                            key: 'export-selected',
                            label: `导出已选（${selectedRowKeys.length}条）`,
                            disabled: selectedRowKeys.length === 0,
                          },
                          { key: 'export-all', label: `导出全部（${probationTotal}条）` },
                        ],
                      },
                    ],
                    onClick: ({ key }) => {
                      if (key === 'regularization-evaluation') {
                        void handleBatchStartEvaluation('REGULARIZATION');
                        return;
                      }
                      if (key === 'export-selected') {
                        void handleExport('selected');
                        return;
                      }
                      if (key === 'export-all') void handleExport('all');
                    },
                  }}
                  trigger={['click']}
                >
                  <Button className="probation-export-button" loading={exportingScope !== null}>
                    更多操作 <DownOutlined />
                  </Button>
                </Dropdown>
              </>
            ) : (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'selected',
                      label: `导出已选（${selectedRowKeys.length}条）`,
                      disabled: selectedRowKeys.length === 0,
                    },
                    {
                      key: 'all',
                      label: `导出全部（${probationTotal}条）`,
                    },
                  ],
                  onClick: ({ key }) => void handleExport(key === 'selected' ? 'selected' : 'all'),
                }}
                trigger={['click']}
              >
                <Button type="primary" className="probation-export-button" loading={exportingScope !== null}>
                  导出 <DownOutlined />
                </Button>
              </Dropdown>
            )}
          </Space>
        </div>

        <Table<ProbationListItem>
          className="employee-table probation-table"
          rowKey="id"
          rowSelection={{
            columnWidth: 38,
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          loading={probation.isLoading}
          columns={columns}
          dataSource={probation.data?.data ?? []}
          scroll={{ x: 'max-content' }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的试用记录" /> }}
          pagination={hasPagination ? {
            current: query.page,
            pageSize: probationPageSize,
            total: probationTotal,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total) => `共${total}条`,
          } : false}
          onChange={handleTableChange}
        />
        {!hasPagination ? <div className="probation-table-total">共{probationTotal}条</div> : null}
      </div>

      <ProbationImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setSelectedRowKeys([]);
          void probation.refetch();
        }}
      />

      <Drawer
        title="高级筛选"
        open={advancedOpen}
        onClose={cancelAdvancedFilters}
        width={360}
      >
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Typography.Text strong>试用开始日期</Typography.Text>
            <DatePicker.RangePicker
              style={{ width: '100%', marginTop: 8 }}
              value={advancedDraft.startDateFrom && advancedDraft.startDateTo
                ? [dayjs(advancedDraft.startDateFrom), dayjs(advancedDraft.startDateTo)]
                : null}
              onChange={(_, dates) => setAdvancedDraft({
                startDateFrom: dates[0] || undefined,
                startDateTo: dates[1] || undefined,
              })}
            />
          </div>
          <Button onClick={() => setAdvancedDraft({})}>清空全部筛选</Button>
          <div className="probation-advanced-filter-actions">
            <Button onClick={cancelAdvancedFilters}>取消</Button>
            <Button type="primary" onClick={applyAdvancedFilters}>确定</Button>
          </div>
        </Space>
      </Drawer>

      <Modal
        title="编辑试用期"
        open={Boolean(editTarget)}
        okText="保存"
        cancelText="取消"
        confirmLoading={updateProbation.isPending}
        onCancel={() => setEditTarget(null)}
        onOk={() => editForm.submit()}
      >
        <Form<ProbationDateFormValues>
          form={editForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!editTarget) return;
            try {
              await updateProbation.mutateAsync({
                id: editTarget.id,
                input: {
                  plannedEndDate: values.plannedEndDate.format('YYYY-MM-DD'),
                },
              });
              messageApi.success('试用期信息已更新');
              setEditTarget(null);
            } catch (error) {
              messageApi.error(error instanceof Error ? error.message : '更新试用期失败');
            }
          }}
        >
          <Form.Item label="试用开始日期" name="startDate" rules={[{ required: true, message: '请选择试用开始日期' }]}>
            <DatePicker style={{ width: '100%' }} disabled />
          </Form.Item>
          <Form.Item
            label="预计试用结束日期"
            name="plannedEndDate"
            dependencies={['startDate']}
            rules={[
              { required: true, message: '请选择预计试用结束日期' },
              ({ getFieldValue }) => ({
                validator(_, value: Dayjs) {
                  const startDate = getFieldValue('startDate') as Dayjs | undefined;
                  return !value || !startDate || !value.isBefore(startDate, 'day')
                    ? Promise.resolve()
                    : Promise.reject(new Error('预计结束日期不得早于试用开始日期'));
                },
              }),
            ]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="提交转正申请"
        open={Boolean(evaluationTarget)}
        okText="提交确认"
        cancelText="取消"
        confirmLoading={submitConfirmation.isPending}
        onCancel={() => setEvaluationTarget(null)}
        onOk={() => evaluationForm.submit()}
      >
        <Form<EvaluationFormValues>
          form={evaluationForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!evaluationTarget) return;
            try {
              await submitConfirmation.mutateAsync({
                id: evaluationTarget.id,
                input: {
                  evaluation: values.evaluation.trim(),
                  approverUserId: values.approverUserId,
                },
              });
              messageApi.success('已提交转正确认');
              setEvaluationTarget(null);
            } catch (error) {
              messageApi.error(error instanceof Error ? error.message : '提交转正确认失败');
            }
          }}
        >
          <Form.Item
            label="考核评价"
            name="evaluation"
            rules={[{ required: true, whitespace: true, message: '请填写考核评价' }]}
          >
            <Input.TextArea rows={5} maxLength={2000} showCount placeholder="填写试用期考核结论和转正依据" />
          </Form.Item>
          <Form.Item
            label="转正审批人"
            name="approverUserId"
            rules={[{ required: true, message: '请选择转正审批人' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择审批人"
              loading={approvers.isLoading}
              options={approverOptions}
              notFoundContent={approvers.isError ? '审批人加载失败，请关闭后重试' : undefined}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量转正申请"
        open={batchConfirmationOpen}
        okText="发起申请"
        cancelText="取消"
        confirmLoading={startConfirmations.isPending}
        onCancel={() => setBatchConfirmationOpen(false)}
        onOk={() => batchConfirmationForm.submit()}
      >
        <Form<ApproverFormValues>
          form={batchConfirmationForm}
          layout="vertical"
          onFinish={async (values) => {
            const records = selectedRecordsWithStatus(
              ['DRAFT', 'IN_PROGRESS'],
              '请先选择待转正的试用员工',
              '只能对待发起或考核中的试用员工发起转正申请',
            );
            if (records.length === 0) return;
            try {
              const result = await startConfirmations.mutateAsync({
                probationIds: records.map(({ id }) => id),
                approverUserId: values.approverUserId,
              });
              setSelectedRowKeys([]);
              setBatchConfirmationOpen(false);
              messageApi.success(`已发起 ${result.updated} 条转正申请`);
            } catch (error) {
              messageApi.error(error instanceof Error ? error.message : '发起转正申请失败');
            }
          }}
        >
          <Form.Item
            label="转正审批人"
            name="approverUserId"
            rules={[{ required: true, message: '请选择转正审批人' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择审批人"
              loading={approvers.isLoading}
              options={approverOptions}
              notFoundContent={approvers.isError ? '审批人加载失败，请关闭后重试' : undefined}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="转交审批"
        open={Boolean(transferTarget)}
        okText="转交"
        cancelText="取消"
        confirmLoading={transferApproval.isPending}
        onCancel={() => setTransferTarget(null)}
        onOk={() => transferForm.submit()}
      >
        <Form<ApproverFormValues>
          form={transferForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!transferTarget) return;
            try {
              await transferApproval.mutateAsync({
                id: transferTarget.id,
                input: { approverUserId: values.approverUserId },
              });
              messageApi.success('审批人已转交');
              setTransferTarget(null);
            } catch (error) {
              messageApi.error(error instanceof Error ? error.message : '转交失败');
            }
          }}
        >
          <Form.Item
            label="新的审批人"
            name="approverUserId"
            rules={[{ required: true, message: '请选择新的审批人' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择新的审批人"
              loading={approvers.isLoading}
              options={approverOptions}
              notFoundContent={approvers.isError ? '审批人加载失败，请关闭后重试' : undefined}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="确认转正"
        open={Boolean(confirmationTarget)}
        okText="确认转正"
        cancelText="取消"
        confirmLoading={confirmProbation.isPending}
        onCancel={() => setConfirmationTarget(null)}
        onOk={() => confirmationForm.submit()}
      >
        <Form<ConfirmationFormValues>
          form={confirmationForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!confirmationTarget) return;
            try {
              await confirmProbation.mutateAsync({
                id: confirmationTarget.id,
                input: { confirmedDate: values.confirmedDate.format('YYYY-MM-DD') },
              });
              messageApi.success('已完成转正并同步任职状态');
              setConfirmationTarget(null);
            } catch (error) {
              messageApi.error(error instanceof Error ? error.message : '确认转正失败');
            }
          }}
        >
          <Form.Item label="转正日期" name="confirmedDate" rules={[{ required: true, message: '请选择转正日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="审批通过"
        open={Boolean(approveTarget)}
        okText="确认通过"
        cancelText="取消"
        confirmLoading={approveProbation.isPending}
        onCancel={() => setApproveTarget(null)}
        onOk={async () => {
          if (!approveTarget) return;
          try {
            await approveProbation.mutateAsync(approveTarget.id);
            messageApi.success('转正申请已审批通过');
            setApproveTarget(null);
          } catch (error) {
            messageApi.error(error instanceof Error ? error.message : '审批通过失败');
          }
        }}
      >
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          确认通过“{approveTarget?.employeeName}”的转正申请？通过后可继续办理转正生效。
        </Typography.Paragraph>
      </Modal>
    </section>
  );
}
