import {
  APPROVAL_FLOW_DEFINITION_STATUSES,
  APPROVAL_FLOW_NODE_ASSIGNEE_KINDS,
  APPROVAL_FLOW_VERSION_STATUSES,
  APPROVAL_DECISIONS,
  EMPLOYMENT_APPLICATION_STATUSES,
  EMPLOYMENT_BUSINESS_PERMISSIONS,
  EMPLOYMENT_CONVERSION_STATUSES,
  EMPLOYMENT_CONVERSION_TYPES,
  EMPLOYMENT_CONVERSION_VIEWS,
  PART_TIME_RECORD_STATUSES,
  PART_TIME_RECORD_VIEWS,
  type ApprovalFlowDefinition,
  type ApprovalFlowNode,
  type ApprovalFlowVersion,
  type CreateEmploymentApprovalFlowDefinitionInput,
  type CreateEmploymentConversionInput,
  type CreatePartTimeRecordInput,
  type EmploymentApplicationStatus,
  type EmploymentApprovalDetail,
  type EmploymentApprovalFlowOptions,
  type EmploymentConversionListItem,
  type EmploymentConversionStatus,
  type EmploymentConversionType,
  type EmploymentViewCountsResponse,
  type PartTimeRecordItem,
  type PartTimeRecordStatus,
} from './index';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertExactValues<T extends readonly string[]>(actual: T, expected: T, label: string) {
  assert(actual.length === expected.length, `${label} length mismatch`);
  expected.forEach((value, index) => assert(actual[index] === value, `${label} value mismatch at ${index}`));
}

export function verifyEmploymentBusinessContracts() {
  assertExactValues(
    EMPLOYMENT_BUSINESS_PERMISSIONS,
    [
      'employment.movement.manage',
      'employment.termination.force',
      'employment.reporting.adjust',
      'employment.approval-flow.manage',
      'employment.export',
    ] as const,
    'employment permissions',
  );
  assertExactValues(APPROVAL_FLOW_DEFINITION_STATUSES, ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const, 'flow definition statuses');
  assertExactValues(APPROVAL_FLOW_VERSION_STATUSES, ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const, 'flow version statuses');
  assertExactValues(APPROVAL_FLOW_NODE_ASSIGNEE_KINDS, ['USER', 'ROLE', 'DIRECTORY'] as const, 'flow assignee kinds');
  assertExactValues(APPROVAL_DECISIONS, ['PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'] as const, 'approval decisions');
  assertExactValues(EMPLOYMENT_CONVERSION_TYPES, ['INTERN_TO_EMPLOYEE', 'LABOR_TO_EMPLOYEE'] as const, 'conversion types');
  assertExactValues(EMPLOYMENT_CONVERSION_VIEWS, ['in_progress', 'completed', 'all'] as const, 'conversion views');
  assertExactValues(PART_TIME_RECORD_VIEWS, ['active', 'expiring', 'not_started', 'ended', 'approval', 'all'] as const, 'part-time record views');
  assertExactValues(
    EMPLOYMENT_CONVERSION_STATUSES,
    ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'PENDING_EFFECTIVE', 'COMPLETED', 'CANCELLED'] as const,
    'conversion statuses',
  );
  assertExactValues(
    PART_TIME_RECORD_STATUSES,
    ['DRAFT', 'PENDING', 'REJECTED', 'WITHDRAWN', 'PENDING_EFFECTIVE', 'ACTIVE', 'ENDED', 'CANCELLED'] as const,
    'part-time statuses',
  );

  const definition: ApprovalFlowDefinition = {
    id: 'MOCK-FLOW',
    businessType: 'INTERN_TO_EMPLOYEE',
    code: 'MOCK-INTERN-CONVERSION',
    name: 'Mock intern conversion',
    status: 'PUBLISHED',
    currentPublishedVersionId: 'MOCK-VERSION',
    versions: [],
  };
  const version: ApprovalFlowVersion = {
    id: 'MOCK-VERSION',
    definitionId: definition.id,
    versionNumber: 1,
    status: 'PUBLISHED',
    publishedAt: '2026-09-20T00:00:00.000Z',
    nodes: [],
  };
  const node: ApprovalFlowNode = {
    id: 'MOCK-NODE',
    versionId: version.id,
    stepOrder: 1,
    assigneeKind: 'USER',
    assigneeUserId: 'MOCK-USER',
    assigneeRoleId: null,
    assigneeRule: null,
  };
  assert(definition.versions.length === 0, 'definition should expose versions');
  assert(version.nodes.length === 0, 'version should expose nodes');
  assert(node.assigneeKind === 'USER', 'node should support user assignees');

  const directoryNode: ApprovalFlowNode = {
    id: 'MOCK-DIRECTORY-NODE',
    versionId: version.id,
    stepOrder: 2,
    assigneeKind: 'DIRECTORY',
    assigneeUserId: null,
    assigneeRoleId: null,
    assigneeRule: { organizationId: 'MOCK-ORGANIZATION' },
  };
  assert(directoryNode.assigneeRule?.organizationId === 'MOCK-ORGANIZATION', 'directory nodes should expose assignee rules');

  const status: EmploymentApplicationStatus = 'PENDING_EFFECTIVE';
  const conversionType: EmploymentConversionType = 'LABOR_TO_EMPLOYEE';
  const conversionStatus: EmploymentConversionStatus = status;
  const partTimeStatus: PartTimeRecordStatus = 'ACTIVE';
  assert(status === conversionStatus, 'application and conversion status contracts should align');
  assert(conversionType === 'LABOR_TO_EMPLOYEE', 'conversion type contract should be assignable');
  assert(partTimeStatus === 'ACTIVE', 'part-time status contract should be assignable');

  const flowInput: CreateEmploymentApprovalFlowDefinitionInput = {
    businessType: 'INTERN_TO_EMPLOYEE',
    code: 'MOCK-INTERN-CONVERSION',
    name: '虚构实习转换流程',
    nodes: [{ stepOrder: 1, assigneeKind: 'USER', assigneeUserId: 'MOCK-USER' }],
  };
  const flowOptions: EmploymentApprovalFlowOptions = {
    users: [{ id: 'MOCK-USER', username: 'mock-user', displayName: '虚构审批人' }],
    roles: [{ id: 'MOCK-ROLE', code: 'MOCK_ROLE', name: '虚构角色' }],
    jobTitles: [{ id: 'MOCK-JOB-TITLE', code: 'MOCK_JOB_TITLE', name: '虚构职务' }],
  };
  const conversionInput: CreateEmploymentConversionInput = {
    type: 'INTERN_TO_EMPLOYEE',
    employeeId: 'MOCK-EMPLOYEE',
    sourceEmploymentPeriodId: 'MOCK-PERIOD',
    targetOrganizationId: 'MOCK-ORG',
    plannedEffectiveDate: '2026-09-23',
  };
  const partTimeInput: CreatePartTimeRecordInput = {
    employeeId: 'MOCK-EMPLOYEE',
    type: '项目顾问',
    organizationId: 'MOCK-ORG',
    startDate: '2026-09-23',
  };
  const approvalDetail: EmploymentApprovalDetail = {
    id: 'MOCK-APPROVAL',
    businessType: 'INTERN_TO_EMPLOYEE',
    businessId: 'MOCK-CONVERSION',
    title: '虚构转换申请',
    applicant: { id: 'MOCK-USER', displayName: '虚构申请人' },
    currentStep: 1,
    status: 'PENDING',
    employmentStatus: 'PENDING',
    submittedAt: '2026-09-23T00:00:00.000Z',
    completedAt: null,
    steps: [{
      id: 'MOCK-STEP',
      stepOrder: 1,
      approver: { id: 'MOCK-APPROVER', displayName: '虚构审批人' },
      decision: 'PENDING',
      comment: null,
      operatedAt: null,
    }],
    flowVersion: {
      id: 'MOCK-VERSION',
      versionNumber: 1,
      definition: { id: 'MOCK-FLOW', code: 'MOCK_FLOW', name: '虚构流程' },
    },
    businessSummary: null,
  };
  const conversionRow: EmploymentConversionListItem = {
    id: 'MOCK-CONVERSION',
    type: 'INTERN_TO_EMPLOYEE',
    status: 'PENDING',
    plannedEffectiveDate: '2026-09-23',
    approvalRequestId: approvalDetail.id,
    employee: { id: 'MOCK-EMPLOYEE', employeeNo: 'MOCK-HR-001', name: '虚构员工' },
    source: {
      employmentPeriodId: 'MOCK-PERIOD',
      sequenceNo: 1,
      employmentRelationship: 'INTERN',
      entryDate: '2026-01-01',
      organization: { id: 'MOCK-ORG-A', name: '虚构来源部门' },
      position: null,
      jobTitle: null,
      jobLevel: null,
    },
    target: {
      organization: { id: 'MOCK-ORG-B', code: 'MOCK_ORG_B', name: '虚构目标部门' },
      position: null,
      jobTitle: null,
      jobLevel: null,
    },
    approval: {
      id: approvalDetail.id,
      status: 'PENDING',
      employmentStatus: 'PENDING',
      currentStep: 1,
      currentApproverName: '虚构审批人',
      submittedAt: approvalDetail.submittedAt,
      completedAt: null,
    },
    canActivate: false,
    canViewEmployeeDetail: true,
  };
  const partTimeRow: PartTimeRecordItem = {
    id: 'MOCK-PART-TIME',
    employee: { id: 'MOCK-EMPLOYEE', employeeNo: 'MOCK-HR-001', name: '虚构员工' },
    type: '项目顾问',
    institution: null,
    organization: { id: 'MOCK-ORG', name: '虚构部门' },
    jobTitle: null,
    managerEmployee: null,
    startDate: '2026-09-23',
    endDate: null,
    status: 'PENDING',
    approval: conversionRow.approval,
    canActivate: false,
    canEnd: false,
  };
  const counts: EmploymentViewCountsResponse = {
    businessDate: '2026-09-23',
    scope: { organizationId: null, organizationMode: 'ALL_DATA' },
    items: [{ key: 'part-time.approval', label: '兼职审批中', supported: true, count: 1, reason: null }],
  };

  assert(flowInput.nodes[0]?.assigneeUserId === 'MOCK-USER', 'flow input should use user IDs');
  assert(flowOptions.jobTitles[0]?.id === 'MOCK-JOB-TITLE', 'flow options should expose job-title IDs');
  assert(conversionInput.sourceEmploymentPeriodId === conversionRow.source.employmentPeriodId, 'conversion input and row should align');
  assert(partTimeInput.type === partTimeRow.type, 'part-time input and row should align');
  assert(counts.items[0]?.count === 1, 'view counts should distinguish a supported nonzero result');
}

verifyEmploymentBusinessContracts();
