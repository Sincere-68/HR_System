import { CheckOutlined, EyeOutlined, RollbackOutlined, StopOutlined } from '@ant-design/icons';
import type {
  ApprovalDecision,
  EmploymentApprovalDetail,
  EmploymentApprovalListItem,
  EmploymentApprovalListQuery,
} from '@hr-demo/shared';
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import {
  useApproveEmploymentApproval,
  useCurrentEmploymentApprovals,
  useEmploymentApprovalDetail,
  useMyEmploymentApprovals,
  useRejectEmploymentApproval,
  useReturnEmploymentApproval,
  useWithdrawEmploymentApproval,
} from '../../features/employment-foundation/api';

const processStatusLabels: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
  IN_PROGRESS: '处理中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  PENDING_EFFECTIVE: '待生效',
};

const decisionLabels: Record<ApprovalDecision, string> = {
  PENDING: '待处理',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  SKIPPED: '已跳过',
};

const businessTypeLabels: Record<string, string> = {
  INTERN_TO_EMPLOYEE: '实习转正式',
  LABOR_TO_EMPLOYEE: '劳务转正式',
  PART_TIME_RECORD: '兼职职责',
};

type ActionKind = 'approve' | 'reject' | 'return';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', { hour12: false });
}

function statusColor(status: string | null | undefined) {
  if (status === 'APPROVED' || status === 'COMPLETED') return 'success';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'error';
  if (status === 'PENDING' || status === 'IN_PROGRESS' || status === 'PENDING_EFFECTIVE') return 'processing';
  return 'default';
}

function StatusCell({ status }: { status: string | null | undefined }) {
  if (!status) return <span>--</span>;
  return <Tag color={statusColor(status)}>{processStatusLabels[status] ?? status}</Tag>;
}

function businessTypeLabel(value: string) {
  return businessTypeLabels[value] ?? value;
}

function isPendingApproval(record: EmploymentApprovalListItem | EmploymentApprovalDetail) {
  return record.status === 'PENDING' && record.employmentStatus === 'PENDING';
}

function currentStep(record: EmploymentApprovalListItem | EmploymentApprovalDetail) {
  return record.steps.find((step) => step.stepOrder === record.currentStep) ?? null;
}

function businessRoute(detail: EmploymentApprovalDetail) {
  if (detail.businessSummary?.kind === 'PART_TIME') return '/employment/part-time';
  if (detail.businessSummary?.kind === 'CONVERSION') {
    return detail.businessType === 'LABOR_TO_EMPLOYEE'
      ? '/employment/labor'
      : '/employment/interns';
  }
  return null;
}

function canApprove(record: EmploymentApprovalDetail, userId: string | undefined) {
  const step = currentStep(record);
  return Boolean(
    userId
      && step
      && step.approver.id === userId
      && step.decision === 'PENDING'
      && isPendingApproval(record),
  );
}

function canWithdraw(record: EmploymentApprovalDetail, userId: string | undefined) {
  return Boolean(
    userId
      && record.applicant.id === userId
      && isPendingApproval(record)
      && record.steps.length > 0
      && record.steps.every((step) => step.decision === 'PENDING'),
  );
}

function businessSummaryRows(detail: EmploymentApprovalDetail) {
  const summary = detail.businessSummary;
  if (!summary) return [];
  if (summary.kind === 'CONVERSION') {
    return [
      ['员工', displayValue(summary.employee.name)],
      ['工号', displayValue(summary.employee.employeeNo)],
      ['来源部门', displayValue(summary.sourceOrganizationName)],
      ['目标部门', displayValue(summary.targetOrganizationName)],
      ['计划生效日期', displayValue(summary.plannedEffectiveDate)],
      ['业务状态', processStatusLabels[summary.status] ?? summary.status],
    ];
  }
  return [
    ['员工', displayValue(summary.employee.name)],
    ['工号', displayValue(summary.employee.employeeNo)],
    ['兼职部门', displayValue(summary.organizationName)],
    ['兼职类型', displayValue(summary.type)],
    ['兼职机构', displayValue(summary.institution)],
    ['开始日期', displayValue(summary.startDate)],
    ['结束日期', displayValue(summary.endDate)],
    ['业务状态', processStatusLabels[summary.status] ?? summary.status],
  ];
}

interface ApprovalListProps {
  query: EmploymentApprovalListQuery;
  onOpenDetail: (record: EmploymentApprovalListItem) => void;
  patchSearch: (changes: Record<string, string | number | undefined>) => void;
}

type ApprovalListResult = ReturnType<typeof useCurrentEmploymentApprovals>;

function approvalColumns(onOpenDetail: (record: EmploymentApprovalListItem) => void): ColumnsType<EmploymentApprovalListItem> {
  return [
    {
      title: '申请事项',
      dataIndex: 'title',
      width: 220,
      render: (value: string, record) => displayValue(value || record.title),
    },
    {
      title: '业务类型',
      dataIndex: 'businessType',
      width: 140,
      render: (value: string) => businessTypeLabel(value),
    },
    {
      title: '发起人',
      dataIndex: ['applicant', 'displayName'],
      width: 140,
      render: (_value, record) => displayValue(record.applicant?.displayName),
    },
    {
      title: '当前步骤',
      dataIndex: 'currentStep',
      width: 110,
      render: (value: number) => value > 0 ? `第 ${value} 步` : '--',
    },
    {
      title: '审批状态',
      dataIndex: 'status',
      width: 120,
      render: (_value, record) => <StatusCell status={record.employmentStatus || record.status} />,
    },
    {
      title: '发起时间',
      dataIndex: 'submittedAt',
      width: 180,
      render: formatDateTime,
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 130,
      render: (_value, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          aria-label={`查看${record.title}`}
          onClick={() => onOpenDetail(record)}
        >
          查看
        </Button>
      ),
    },
  ];
}

function ApprovalListTable({ approvals, onOpenDetail, patchSearch, query }: ApprovalListProps & { approvals: ApprovalListResult }) {
  return (
    <>
      {approvals.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="任职审批加载失败"
          description={approvals.error instanceof Error ? approvals.error.message : '暂时无法加载审批列表。'}
          action={<Button size="small" onClick={() => approvals.refetch()}>重试</Button>}
        />
      ) : null}
      <div className="employee-table-surface">
        <Table<EmploymentApprovalListItem>
          className="employee-table employment-approvals-table"
          rowKey="id"
          loading={approvals.isLoading}
          columns={approvalColumns(onOpenDetail)}
          dataSource={approvals.isError ? [] : (approvals.data?.data ?? [])}
          scroll={{ x: 1_050 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的审批记录" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: approvals.data?.meta.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
          }}
          onChange={(pagination: TablePaginationConfig) => patchSearch({
            page: pagination.current ?? 1,
            pageSize: pagination.pageSize ?? 10,
          })}
        />
      </div>
    </>
  );
}

function CurrentApprovalList(props: ApprovalListProps) {
  const approvals = useCurrentEmploymentApprovals(props.query);
  return <ApprovalListTable {...props} approvals={approvals} />;
}

function MyApprovalList(props: ApprovalListProps) {
  const approvals = useMyEmploymentApprovals(props.query);
  return <ApprovalListTable {...props} approvals={approvals} />;
}

function ApprovalListContent({ view, ...props }: ApprovalListProps & { view: 'current' | 'my' }) {
  return view === 'current'
    ? <CurrentApprovalList {...props} />
    : <MyApprovalList {...props} />;
}

interface ActionModalState {
  kind: ActionKind | 'withdraw';
  comment: string;
}

export function EmploymentApprovalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null);

  const view = searchParams.get('view') === 'my' ? 'my' : 'current';
  const query = useMemo<EmploymentApprovalListQuery>(() => ({
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);

  const detailQuery = useEmploymentApprovalDetail(selectedId ?? '', Boolean(selectedId));
  const approve = useApproveEmploymentApproval();
  const reject = useRejectEmploymentApproval();
  const returnApproval = useReturnEmploymentApproval();
  const withdraw = useWithdrawEmploymentApproval();

  const selectedDetail = detailQuery.data;
  const selectedActionPending = approve.isPending || reject.isPending || returnApproval.isPending || withdraw.isPending;

  const patchSearch = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const changeView = (nextView: 'current' | 'my') => {
    patchSearch({ view: nextView, page: 1 });
  };

  const openDetail = (record: EmploymentApprovalListItem) => {
    setSelectedId(record.id);
  };

  const closeDetail = () => {
    if (!selectedActionPending) {
      setSelectedId(null);
      setActionModal(null);
    }
  };

  const openAction = (kind: ActionKind | 'withdraw') => {
    setActionModal({ kind, comment: '' });
  };

  const closeAction = () => {
    if (!selectedActionPending) setActionModal(null);
  };

  const submitAction = async () => {
    if (!selectedDetail || !actionModal) return;
    const comment = actionModal.comment.trim();
    if (actionModal.kind === 'approve') {
      await approve.mutateAsync({
        id: selectedDetail.id,
        input: comment ? { comment } : {},
      });
    } else if (actionModal.kind === 'reject') {
      if (!comment) return;
      await reject.mutateAsync({ id: selectedDetail.id, input: { comment } });
    } else if (actionModal.kind === 'return') {
      if (!comment) return;
      await returnApproval.mutateAsync({ id: selectedDetail.id, input: { comment } });
    } else {
      await withdraw.mutateAsync(selectedDetail.id);
    }
    setActionModal(null);
    setSelectedId(null);
  };

  const detailCanApprove = selectedDetail ? canApprove(selectedDetail, user?.id) : false;
  const detailCanWithdraw = selectedDetail ? canWithdraw(selectedDetail, user?.id) : false;
  const detailRoute = selectedDetail ? businessRoute(selectedDetail) : null;
  const actionTitle = actionModal?.kind === 'approve'
    ? '审批通过'
    : actionModal?.kind === 'reject'
      ? '驳回申请'
      : actionModal?.kind === 'return'
        ? '退回修订'
        : '撤回申请';
  const actionConfirmText = actionModal?.kind === 'approve'
    ? '确认通过'
    : actionModal?.kind === 'reject'
      ? '确认驳回'
      : actionModal?.kind === 'return'
        ? '确认退回'
        : '确认撤回';
  const requiresComment = actionModal?.kind === 'reject' || actionModal?.kind === 'return';

  return (
    <section className="employee-list-page employment-approvals-page" aria-labelledby="employment-approvals-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><CheckOutlined /></span>
          <nav className="blacklist-heading-tabs" aria-label="任职审批功能">
            <button
              className={`blacklist-heading-tab${view === 'current' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('current')}
            >
              <h1 id="employment-approvals-heading">待我审批</h1>
            </button>
            <button
              className={`blacklist-heading-tab${view === 'my' ? ' is-active' : ''}`}
              type="button"
              onClick={() => changeView('my')}
            >
              我发起
            </button>
          </nav>
        </div>
      </header>

      <ApprovalListContent
        view={view}
        query={query}
        onOpenDetail={openDetail}
        patchSearch={patchSearch}
      />

      <Drawer
        title={selectedDetail?.title ?? '审批详情'}
        open={Boolean(selectedId)}
        onClose={closeDetail}
        width={560}
        destroyOnHidden
      >
        {detailQuery.isLoading ? <Typography.Text>正在加载审批详情…</Typography.Text> : null}
        {detailQuery.isError ? <Alert type="error" message="审批详情加载失败" /> : null}
        {selectedDetail ? (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <div>
              <Typography.Title level={5}>申请信息</Typography.Title>
              <dl className="employment-approval-detail-list">
                <div><dt>申请事项</dt><dd>{displayValue(selectedDetail.title)}</dd></div>
                <div><dt>业务类型</dt><dd>{businessTypeLabel(selectedDetail.businessType)}</dd></div>
                <div><dt>发起人</dt><dd>{displayValue(selectedDetail.applicant.displayName)}</dd></div>
                <div><dt>发起时间</dt><dd>{formatDateTime(selectedDetail.submittedAt)}</dd></div>
                <div><dt>审批状态</dt><dd><StatusCell status={selectedDetail.employmentStatus || selectedDetail.status} /></dd></div>
                <div><dt>流程版本</dt><dd>V{selectedDetail.flowVersion.versionNumber} · {selectedDetail.flowVersion.definition.name}</dd></div>
              </dl>
            </div>

            <div>
              <Typography.Title level={5}>业务信息</Typography.Title>
              {businessSummaryRows(selectedDetail).length > 0 ? (
                <dl className="employment-approval-detail-list">
                  {businessSummaryRows(selectedDetail).map(([label, value]) => (
                    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                  ))}
                </dl>
              ) : <Typography.Text type="secondary">暂无业务摘要</Typography.Text>}
              {detailRoute ? (
                <Link to={detailRoute} aria-label="前往业务" onClick={closeDetail}>
                  <Button type="link">前往业务</Button>
                </Link>
              ) : null}
            </div>

            <div>
              <Typography.Title level={5}>审批步骤</Typography.Title>
              <ol className="employment-approval-steps">
                {[...selectedDetail.steps].sort((a, b) => a.stepOrder - b.stepOrder).map((step) => (
                  <li key={step.id}>
                    <div className="employment-approval-step-heading">
                      <strong>第 {step.stepOrder} 步</strong>
                      <Tag color={step.decision === 'PENDING' ? 'processing' : statusColor(step.decision)}>
                        {decisionLabels[step.decision]}
                      </Tag>
                    </div>
                    <div><span>审批人：</span><span>{displayValue(step.approver.displayName)}</span></div>
                    <div>审批意见：{displayValue(step.comment)}</div>
                    <div>处理时间：{formatDateTime(step.operatedAt)}</div>
                  </li>
                ))}
              </ol>
            </div>

            {(detailCanApprove || detailCanWithdraw) ? (
              <Space wrap>
                {detailCanApprove ? (
                  <>
                    <Button
                      type="primary"
                      aria-label="审批通过"
                      icon={<CheckOutlined />}
                      onClick={() => openAction('approve')}
                    >
                      审批通过
                    </Button>
                    <Button
                      danger
                      aria-label="驳回"
                      icon={<StopOutlined />}
                      onClick={() => openAction('reject')}
                    >
                      驳回
                    </Button>
                    <Button
                      aria-label="退回修订"
                      icon={<RollbackOutlined />}
                      onClick={() => openAction('return')}
                    >
                      退回修订
                    </Button>
                  </>
                ) : null}
                {detailCanWithdraw ? (
                  <Button onClick={() => openAction('withdraw')}>撤回申请</Button>
                ) : null}
              </Space>
            ) : null}
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title={<span id="employment-approval-action-title">{actionTitle}</span>}
        open={Boolean(actionModal)}
        modalRender={(node) => (
          <div role="dialog" aria-modal="true" aria-labelledby="employment-approval-action-title">
            {node}
          </div>
        )}
        onCancel={closeAction}
        onOk={() => void submitAction()}
        okText={actionConfirmText}
        cancelText="取消"
        confirmLoading={selectedActionPending}
        okButtonProps={{ disabled: Boolean(requiresComment && !actionModal?.comment.trim()) }}
        destroyOnHidden
      >
        {actionModal?.kind === 'withdraw' ? (
          <Typography.Text>确认撤回该任职审批申请？撤回后需要重新发起申请。</Typography.Text>
        ) : (
          <Input.TextArea
            aria-label="审批意见"
            rows={4}
            value={actionModal?.comment ?? ''}
            placeholder={requiresComment ? '请输入审批意见（必填）' : '请输入审批意见（选填）'}
            onChange={(event) => setActionModal((current) => current ? { ...current, comment: event.target.value } : current)}
          />
        )}
      </Modal>
    </section>
  );
}
