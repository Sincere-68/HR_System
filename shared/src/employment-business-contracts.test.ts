import {
  APPROVAL_FLOW_DEFINITION_STATUSES,
  APPROVAL_FLOW_NODE_ASSIGNEE_KINDS,
  APPROVAL_FLOW_VERSION_STATUSES,
  EMPLOYMENT_APPLICATION_STATUSES,
  EMPLOYMENT_BUSINESS_PERMISSIONS,
  EMPLOYMENT_CONVERSION_STATUSES,
  EMPLOYMENT_CONVERSION_TYPES,
  PART_TIME_RECORD_STATUSES,
  type ApprovalFlowDefinition,
  type ApprovalFlowNode,
  type ApprovalFlowVersion,
  type EmploymentApplicationStatus,
  type EmploymentConversionStatus,
  type EmploymentConversionType,
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
  assertExactValues(EMPLOYMENT_CONVERSION_TYPES, ['INTERN_TO_EMPLOYEE', 'LABOR_TO_EMPLOYEE'] as const, 'conversion types');
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
}

verifyEmploymentBusinessContracts();
