import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { PERMISSIONS } from '@hr-demo/shared';
import {
  ApprovalDecision,
  ApprovalFlowDefinitionStatus,
  ApprovalFlowNodeAssigneeKind,
  ApprovalFlowVersionStatus,
  AuditAction,
  EmploymentApplicationStatus,
  PartTimeRecordStatus,
  ProcessStatus,
  RecordStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { EmploymentApprovalRuntimeService } from './employment-approval-runtime.service';

const inScopeOrganizationIds = ['org-source', 'org-target'];

type StoredStep = {
  id: string;
  approvalRequestId: string;
  stepOrder: number;
  approverUserId: string;
  decision: ApprovalDecision;
  comment: string | null;
  operatedAt: Date | null;
};

type StoredRequest = {
  id: string;
  businessType: string;
  businessId: string | null;
  applicantUserId: string;
  flowVersionId: string;
  title: string;
  currentStep: number;
  status: ProcessStatus;
  employmentStatus: EmploymentApplicationStatus;
  submittedAt: Date;
  completedAt: Date | null;
  archivedAt: Date | null;
};

type StoredBusinessRecord = {
  id: string;
  approvalRequestId: string | null;
  status: EmploymentApplicationStatus | PartTimeRecordStatus;
  archivedAt: Date | null;
};

type FlowNodeFixture = {
  id: string;
  flowVersionId: string;
  stepOrder: number;
  assigneeKind: ApprovalFlowNodeAssigneeKind;
  assigneeUserId: string | null;
  assigneeRoleId: string | null;
  assigneeRule: unknown;
};

const applicant: AuthenticatedUser = {
  id: 'user-applicant',
  username: 'mock-applicant',
  displayName: '虚构申请人',
  role: 'VIEWER',
  roleName: '员工',
  permissions: [],
  organizationIds: [],
};
const approverOne: AuthenticatedUser = {
  ...applicant,
  id: 'user-approver-1',
  username: 'mock-approver-1',
  displayName: '虚构审批人一',
};
const approverTwo: AuthenticatedUser = {
  ...applicant,
  id: 'user-approver-2',
  username: 'mock-approver-2',
  displayName: '虚构审批人二',
};

function userRecord(id: string, roleId = 'role-employee') {
  return {
    id,
    username: id,
    displayName: id,
    roleId,
    employeeId: null,
    status: RecordStatus.ACTIVE,
    archivedAt: null,
  };
}

function userNode(stepOrder: number, userId: string): FlowNodeFixture {
  return {
    id: `node-${stepOrder}`,
    flowVersionId: 'flow-version-1',
    stepOrder,
    assigneeKind: ApprovalFlowNodeAssigneeKind.USER,
    assigneeUserId: userId,
    assigneeRoleId: null,
    assigneeRule: null,
  };
}

function createHarness(options: {
  nodes?: FlowNodeFixture[];
  definitions?: unknown[];
  users?: ReturnType<typeof userRecord>[];
  directoryUserIds?: Record<string, string[]>;
  businessType?: string;
  employmentConversions?: StoredBusinessRecord[];
  partTimeRecords?: StoredBusinessRecord[];
} = {}) {
  const businessType = options.businessType ?? 'MOCK_EMPLOYMENT_CHANGE';
  const nodes = options.nodes ?? [
    userNode(1, approverOne.id),
    userNode(2, approverTwo.id),
  ];
  const version = {
    id: 'flow-version-1',
    definitionId: 'flow-definition-1',
    versionNumber: 1,
    status: ApprovalFlowVersionStatus.PUBLISHED,
    publishedAt: new Date('2026-09-18T00:00:00.000Z'),
    definition: {
      id: 'flow-definition-1',
      businessType,
      status: ApprovalFlowDefinitionStatus.PUBLISHED,
      archivedAt: null,
    },
    nodes,
  };
  const definitions = options.definitions ?? [{
    ...version.definition,
    versions: [version],
  }];
  const users = options.users ?? [
    userRecord(applicant.id),
    userRecord(approverOne.id),
    userRecord(approverTwo.id),
  ];
  const requests: StoredRequest[] = [];
  const steps: StoredStep[] = [];
  const employmentConversions: StoredBusinessRecord[] = options.employmentConversions ?? [];
  const partTimeRecords: StoredBusinessRecord[] = options.partTimeRecords ?? [];
  const auditEvents: Array<{
    context: { userId: string };
    action: AuditAction;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    resourceType?: string;
  }> = [];
  let requestSequence = 0;
  let stepSequence = 0;

  const matches = (record: Record<string, unknown>, where: Record<string, unknown> | undefined) => {
    if (!where) return true;
    return Object.entries(where).every(([key, wanted]) => {
      if (wanted === undefined) return true;
      const actual = record[key];
      if (wanted && typeof wanted === 'object' && !Array.isArray(wanted)) {
        if ('not' in wanted) return actual !== (wanted as { not: unknown }).not;
        if ('in' in wanted) return (wanted as { in: unknown[] }).in.includes(actual);
      }
      return actual === wanted;
    });
  };

  const withSteps = (request: StoredRequest) => ({
    ...request,
    steps: steps
      .filter((step) => step.approvalRequestId === request.id)
      .sort((left, right) => left.stepOrder - right.stepOrder),
  });

  const updateBusinessRecords = (
    records: StoredBusinessRecord[],
    where: Record<string, unknown>,
    data: Partial<StoredBusinessRecord>,
  ) => {
    const matched = records.filter((record) => matches(record as unknown as Record<string, unknown>, where));
    matched.forEach((record) => Object.assign(record, data));
    return { count: matched.length };
  };

  const tx = {
    approvalFlowDefinition: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve(definitions)),
    },
    approvalFlowVersion: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) => (
        Promise.resolve(where.id === version.id ? version : null)
      )),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => (
        Promise.resolve(where.id === version.id ? version : null)
      )),
    },
    user: {
      findFirst: jest.fn().mockImplementation(({ where, orderBy }: {
        where: { id?: string; roleId?: string; status?: RecordStatus; archivedAt?: null };
        orderBy?: { id: 'asc' };
      }) => {
        const matchesUser = users
          .filter((user) => (!where.id || user.id === where.id)
            && (!where.roleId || user.roleId === where.roleId)
            && (!where.status || user.status === where.status)
            && (where.archivedAt !== null || user.archivedAt === null))
          .sort((left, right) => orderBy ? left.id.localeCompare(right.id) : 0);
        return Promise.resolve(matchesUser[0] ?? null);
      }),
      findMany: jest.fn().mockImplementation(({ where }: {
        where: { employee?: { is?: { assignments?: { some?: { jobTitleId?: string } } } } };
      }) => {
        const jobTitleId = where.employee?.is?.assignments?.some?.jobTitleId;
        const ids = jobTitleId ? options.directoryUserIds?.[jobTitleId] ?? [] : [];
        return Promise.resolve(users
          .filter((user) => ids.includes(user.id) && user.status === RecordStatus.ACTIVE && user.archivedAt === null)
          .sort((left, right) => left.id.localeCompare(right.id)));
      }),
    },
    approvalRequest: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, any> }) => {
        const id = `approval-request-${++requestSequence}`;
        const request: StoredRequest = {
          id,
          businessType: data.businessType,
          businessId: data.businessId ?? null,
          applicantUserId: data.applicantUserId,
          flowVersionId: data.flowVersionId,
          title: data.title,
          currentStep: data.currentStep,
          status: data.status,
          employmentStatus: data.employmentStatus,
          submittedAt: data.submittedAt,
          completedAt: data.completedAt ?? null,
          archivedAt: null,
        };
        requests.push(request);
        for (const input of data.steps.create) {
          steps.push({
            id: `approval-step-${++stepSequence}`,
            approvalRequestId: id,
            stepOrder: input.stepOrder,
            approverUserId: input.approverUserId,
            decision: input.decision ?? ApprovalDecision.PENDING,
            comment: null,
            operatedAt: null,
          });
        }
        return Promise.resolve(withSteps(request));
      }),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) => {
        const request = requests.find((candidate) => !where.id || candidate.id === where.id);
        return Promise.resolve(request ? withSteps(request) : null);
      }),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(requests.map(withSteps))),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        const request = requests.find((candidate) => candidate.id === where.id);
        return Promise.resolve(request ? withSteps(request) : null);
      }),
      count: jest.fn().mockImplementation(() => Promise.resolve(requests.length)),
      updateMany: jest.fn().mockImplementation(({ where, data }: {
        where: Record<string, unknown>;
        data: Partial<StoredRequest>;
      }) => {
        const matched = requests.filter((request) => matches(request as unknown as Record<string, unknown>, where));
        matched.forEach((request) => Object.assign(request, data));
        return Promise.resolve({ count: matched.length });
      }),
    },
    approvalStep: {
      updateMany: jest.fn().mockImplementation(({ where, data }: {
        where: Record<string, unknown>;
        data: Partial<StoredStep>;
      }) => {
        const matched = steps.filter((step) => matches(step as unknown as Record<string, unknown>, where));
        matched.forEach((step) => Object.assign(step, data));
        return Promise.resolve({ count: matched.length });
      }),
    },
    employmentConversion: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockImplementation(({ where, data }: {
        where: Record<string, unknown>;
        data: Partial<StoredBusinessRecord>;
      }) => Promise.resolve(updateBusinessRecords(employmentConversions, where, data))),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    partTimeRecord: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockImplementation(({ where, data }: {
        where: Record<string, unknown>;
        data: Partial<StoredBusinessRecord>;
      }) => Promise.resolve(updateBusinessRecords(partTimeRecords, where, data))),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    employeeAssignment: { update: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (input: ((client: typeof tx) => unknown) | Promise<unknown>[]) => {
      if (Array.isArray(input)) return Promise.all(input);
      const requestSnapshot = requests.map((request) => ({ ...request }));
      const stepSnapshot = steps.map((step) => ({ ...step }));
      const conversionSnapshot = employmentConversions.map((record) => ({ ...record }));
      const partTimeSnapshot = partTimeRecords.map((record) => ({ ...record }));
      try {
        return await input(tx);
      } catch (error) {
        requests.splice(0, requests.length, ...requestSnapshot);
        steps.splice(0, steps.length, ...stepSnapshot);
        employmentConversions.splice(0, employmentConversions.length, ...conversionSnapshot);
        partTimeRecords.splice(0, partTimeRecords.length, ...partTimeSnapshot);
        throw error;
      }
    }),
  };
  const access = {
    hasAllEmployeeData: jest.fn((user: AuthenticatedUser) => (
      user.permissions.includes(PERMISSIONS.EMPLOYEE_DATA_ALL)
    )),
    getAccessibleOrganizationIds: jest.fn((user: AuthenticatedUser) => Promise.resolve(
      user.organizationIds.includes('org-source') ? inScopeOrganizationIds : user.organizationIds,
    )),
    getEmployeeWhere: jest.fn((user: AuthenticatedUser) => Promise.resolve({
      id: { in: user.organizationIds.includes('org-source') ? ['employee-in-scope'] : [] },
    })),
  };
  const audit = {
    create: jest.fn().mockImplementation((
      context: { userId: string },
      action: AuditAction,
      resourceId: string | undefined,
      metadata: Record<string, unknown> | undefined,
      _client: unknown,
      resourceType: string | undefined,
    ) => {
      auditEvents.push({ context, action, resourceId, metadata, resourceType });
      return Promise.resolve();
    }),
  };
  const service = new EmploymentApprovalRuntimeService(prisma as never, audit as never, access as never);

  return {
    service,
    prisma,
    tx,
    requests,
    steps,
    auditEvents,
    access,
    employmentConversions,
    partTimeRecords,
    version,
  };
}

async function createTwoStepRequest(harness: ReturnType<typeof createHarness>) {
  return harness.service.createRequest({
    businessType: 'MOCK_EMPLOYMENT_CHANGE',
    businessId: 'mock-business-1',
    applicantUserId: applicant.id,
    title: '虚构任职变更申请',
  });
}

async function createBusinessRequest(
  harness: ReturnType<typeof createHarness>,
  businessType: string,
  businessId: string,
) {
  return harness.service.createRequest({
    businessType,
    businessId,
    applicantUserId: applicant.id,
    title: '虚构业务申请',
  });
}

describe('EmploymentApprovalRuntimeService', () => {
  describe('createRequest', () => {
    it('binds the sole published flow and creates ordered pending steps without mutating formal business data', async () => {
      const harness = createHarness();

      const result = await createTwoStepRequest(harness);

      expect(result).toEqual(expect.objectContaining({
        businessType: 'MOCK_EMPLOYMENT_CHANGE',
        businessId: 'mock-business-1',
        applicantUserId: applicant.id,
        flowVersionId: 'flow-version-1',
        currentStep: 1,
        status: ProcessStatus.PENDING,
        employmentStatus: EmploymentApplicationStatus.PENDING,
      }));
      expect(harness.steps.map((step) => ({
        stepOrder: step.stepOrder,
        approverUserId: step.approverUserId,
        decision: step.decision,
      }))).toEqual([
        { stepOrder: 1, approverUserId: approverOne.id, decision: ApprovalDecision.PENDING },
        { stepOrder: 2, approverUserId: approverTwo.id, decision: ApprovalDecision.PENDING },
      ]);
      expect(harness.tx.employmentConversion.updateMany).not.toHaveBeenCalled();
      expect(harness.tx.partTimeRecord.updateMany).not.toHaveBeenCalled();
      expect(harness.tx.employeeAssignment.updateMany).not.toHaveBeenCalled();
      expect(harness.auditEvents).toEqual([
        expect.objectContaining({ action: AuditAction.CREATE, resourceId: 'approval-request-1' }),
      ]);
    });

    it('rejects zero or multiple published definitions instead of guessing a flow', async () => {
      const noFlow = createHarness({ definitions: [] });
      const duplicateFlow = createHarness({ definitions: [
        { id: 'definition-1', versions: [{ id: 'version-1' }] },
        { id: 'definition-2', versions: [{ id: 'version-2' }] },
      ] });

      await expect(createTwoStepRequest(noFlow)).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(createTwoStepRequest(duplicateFlow)).rejects.toBeInstanceOf(ConflictException);
      expect(noFlow.requests).toHaveLength(0);
      expect(duplicateFlow.requests).toHaveLength(0);
    });

    it('resolves a ROLE node to the lowest-id active account', async () => {
      const roleNode: FlowNodeFixture = {
        ...userNode(1, approverOne.id),
        assigneeKind: ApprovalFlowNodeAssigneeKind.ROLE,
        assigneeUserId: null,
        assigneeRoleId: 'role-hr',
      };
      const harness = createHarness({
        nodes: [roleNode],
        users: [
          userRecord(applicant.id),
          userRecord('user-role-z', 'role-hr'),
          userRecord('user-role-a', 'role-hr'),
          { ...userRecord('user-role-archived', 'role-hr'), archivedAt: new Date() as never },
        ],
      });

      await createTwoStepRequest(harness);

      expect(harness.steps[0]?.approverUserId).toBe('user-role-a');
    });

    it('resolves a JOB_TITLE directory node through one active employee account', async () => {
      const directoryNode: FlowNodeFixture = {
        ...userNode(1, approverOne.id),
        assigneeKind: ApprovalFlowNodeAssigneeKind.DIRECTORY,
        assigneeUserId: null,
        assigneeRule: { directory: 'JOB_TITLE', value: 'job-title-hr-director' },
      };
      const harness = createHarness({
        nodes: [directoryNode],
        users: [userRecord(applicant.id), userRecord('user-directory-match')],
        directoryUserIds: { 'job-title-hr-director': ['user-directory-match'] },
      });

      await createTwoStepRequest(harness);

      expect(harness.steps[0]?.approverUserId).toBe('user-directory-match');
    });

    it('rejects malformed, unresolved, or ambiguous directory rules', async () => {
      const malformed = createHarness({
        nodes: [{
          ...userNode(1, approverOne.id),
          assigneeKind: ApprovalFlowNodeAssigneeKind.DIRECTORY,
          assigneeUserId: null,
          assigneeRule: { directory: 'POSITION', value: 'position-1' },
        }],
      });
      const unresolved = createHarness({
        nodes: [{
          ...userNode(1, approverOne.id),
          assigneeKind: ApprovalFlowNodeAssigneeKind.DIRECTORY,
          assigneeUserId: null,
          assigneeRule: { directory: 'JOB_TITLE', value: 'job-title-missing' },
        }],
      });
      const ambiguous = createHarness({
        nodes: [{
          ...userNode(1, approverOne.id),
          assigneeKind: ApprovalFlowNodeAssigneeKind.DIRECTORY,
          assigneeUserId: null,
          assigneeRule: { directory: 'JOB_TITLE', value: 'job-title-shared' },
        }],
        users: [userRecord(applicant.id), userRecord('user-directory-a'), userRecord('user-directory-b')],
        directoryUserIds: { 'job-title-shared': ['user-directory-a', 'user-directory-b'] },
      });

      await expect(createTwoStepRequest(malformed)).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(createTwoStepRequest(unresolved)).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(createTwoStepRequest(ambiguous)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('sequential decisions', () => {
    it('allows only the current pending approver', async () => {
      const harness = createHarness();
      const request = await createTwoStepRequest(harness);

      await expect(harness.service.approveCurrentStep(approverTwo, request.id))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(harness.steps.every((step) => step.decision === ApprovalDecision.PENDING)).toBe(true);
      expect(harness.requests[0]?.currentStep).toBe(1);
    });

    it('advances one step at a time, preserves the first decision, then enters pending-effective', async () => {
      const harness = createHarness();
      const request = await createTwoStepRequest(harness);

      await harness.service.approveCurrentStep(approverOne, request.id, '第一层同意');
      const firstOperatedAt = harness.steps[0]?.operatedAt;
      expect(harness.requests[0]).toEqual(expect.objectContaining({
        currentStep: 2,
        status: ProcessStatus.PENDING,
        employmentStatus: EmploymentApplicationStatus.PENDING,
        completedAt: null,
      }));
      expect(harness.steps[0]).toEqual(expect.objectContaining({
        decision: ApprovalDecision.APPROVED,
        comment: '第一层同意',
      }));
      expect(harness.steps[1]?.decision).toBe(ApprovalDecision.PENDING);

      await harness.service.approveCurrentStep(approverTwo, request.id, '第二层同意');

      expect(harness.requests[0]).toEqual(expect.objectContaining({
        currentStep: 2,
        status: ProcessStatus.APPROVED,
        employmentStatus: EmploymentApplicationStatus.PENDING_EFFECTIVE,
      }));
      expect(harness.steps[0]).toEqual(expect.objectContaining({
        decision: ApprovalDecision.APPROVED,
        comment: '第一层同意',
        operatedAt: firstOperatedAt,
      }));
      expect(harness.steps[1]).toEqual(expect.objectContaining({
        decision: ApprovalDecision.APPROVED,
        comment: '第二层同意',
      }));
      expect(harness.tx.employmentConversion.updateMany).not.toHaveBeenCalled();
      expect(harness.tx.partTimeRecord.updateMany).not.toHaveBeenCalled();
    });

    it('synchronizes final conversion approval to pending-effective only at the last node', async () => {
      const conversion: StoredBusinessRecord = {
        id: 'conversion-1',
        approvalRequestId: null,
        status: EmploymentApplicationStatus.PENDING,
        archivedAt: null,
      };
      const harness = createHarness({
        businessType: 'INTERN_TO_EMPLOYEE',
        employmentConversions: [conversion],
      });
      const request = await createBusinessRequest(harness, 'INTERN_TO_EMPLOYEE', conversion.id);
      conversion.approvalRequestId = request.id;

      await harness.service.approveCurrentStep(approverOne, request.id);
      expect(conversion.status).toBe(EmploymentApplicationStatus.PENDING);
      expect(harness.tx.employmentConversion.updateMany).not.toHaveBeenCalled();
      expect(harness.tx.employeeAssignment.updateMany).not.toHaveBeenCalled();

      await harness.service.approveCurrentStep(approverTwo, request.id);

      expect(conversion.status).toBe(EmploymentApplicationStatus.PENDING_EFFECTIVE);
      expect(harness.tx.employmentConversion.updateMany).toHaveBeenCalledWith({
        where: {
          id: conversion.id,
          approvalRequestId: request.id,
          status: EmploymentApplicationStatus.PENDING,
          archivedAt: null,
        },
        data: { status: EmploymentApplicationStatus.PENDING_EFFECTIVE },
      });
    });

    it('synchronizes final part-time approval to pending-effective only at the last node', async () => {
      const partTimeRecord: StoredBusinessRecord = {
        id: 'part-time-1',
        approvalRequestId: null,
        status: PartTimeRecordStatus.PENDING,
        archivedAt: null,
      };
      const harness = createHarness({
        businessType: 'PART_TIME_RECORD',
        partTimeRecords: [partTimeRecord],
      });
      const request = await createBusinessRequest(harness, 'PART_TIME_RECORD', partTimeRecord.id);
      partTimeRecord.approvalRequestId = request.id;

      await harness.service.approveCurrentStep(approverOne, request.id);
      expect(partTimeRecord.status).toBe(PartTimeRecordStatus.PENDING);
      expect(harness.tx.partTimeRecord.updateMany).not.toHaveBeenCalled();

      await harness.service.approveCurrentStep(approverTwo, request.id);

      expect(partTimeRecord.status).toBe(PartTimeRecordStatus.PENDING_EFFECTIVE);
      expect(harness.tx.partTimeRecord.updateMany).toHaveBeenCalledWith({
        where: {
          id: partTimeRecord.id,
          approvalRequestId: request.id,
          status: PartTimeRecordStatus.PENDING,
          archivedAt: null,
        },
        data: { status: PartTimeRecordStatus.PENDING_EFFECTIVE },
      });
      expect(harness.tx.employeeAssignment.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      ['employment conversion', 'INTERN_TO_EMPLOYEE', EmploymentApplicationStatus.REJECTED],
      ['part-time record', 'PART_TIME_RECORD', PartTimeRecordStatus.REJECTED],
    ] as const)('synchronizes a rejected %s application', async (_label, businessType, expectedStatus) => {
      const record: StoredBusinessRecord = {
        id: businessType === 'PART_TIME_RECORD' ? 'part-time-1' : 'conversion-1',
        approvalRequestId: null,
        status: businessType === 'PART_TIME_RECORD'
          ? PartTimeRecordStatus.PENDING
          : EmploymentApplicationStatus.PENDING,
        archivedAt: null,
      };
      const harness = createHarness({
        businessType,
        ...(businessType === 'PART_TIME_RECORD'
          ? { partTimeRecords: [record] }
          : { employmentConversions: [record] }),
      });
      const request = await createBusinessRequest(harness, businessType, record.id);
      record.approvalRequestId = request.id;

      await harness.service.reject(approverOne, request.id, '拒绝理由');

      expect(record.status).toBe(expectedStatus);
    });

    it.each([
      ['employment conversion', 'INTERN_TO_EMPLOYEE', EmploymentApplicationStatus.WITHDRAWN],
      ['part-time record', 'PART_TIME_RECORD', PartTimeRecordStatus.WITHDRAWN],
    ] as const)('synchronizes a withdrawn %s application', async (_label, businessType, expectedStatus) => {
      const record: StoredBusinessRecord = {
        id: businessType === 'PART_TIME_RECORD' ? 'part-time-1' : 'conversion-1',
        approvalRequestId: null,
        status: businessType === 'PART_TIME_RECORD'
          ? PartTimeRecordStatus.PENDING
          : EmploymentApplicationStatus.PENDING,
        archivedAt: null,
      };
      const harness = createHarness({
        businessType,
        ...(businessType === 'PART_TIME_RECORD'
          ? { partTimeRecords: [record] }
          : { employmentConversions: [record] }),
      });
      const request = await createBusinessRequest(harness, businessType, record.id);
      record.approvalRequestId = request.id;

      await harness.service.withdraw(applicant, request.id);

      expect(record.status).toBe(expectedStatus);
    });

    it('rolls back the approval step when final conversion synchronization conflicts', async () => {
      const conversion: StoredBusinessRecord = {
        id: 'conversion-1',
        approvalRequestId: null,
        status: EmploymentApplicationStatus.PENDING,
        archivedAt: null,
      };
      const harness = createHarness({
        nodes: [userNode(1, approverOne.id)],
        businessType: 'INTERN_TO_EMPLOYEE',
        employmentConversions: [conversion],
      });
      const request = await createBusinessRequest(harness, 'INTERN_TO_EMPLOYEE', conversion.id);
      conversion.approvalRequestId = request.id;
      harness.tx.employmentConversion.updateMany.mockResolvedValue({ count: 0 });

      await expect(harness.service.approveCurrentStep(approverOne, request.id))
        .rejects.toBeInstanceOf(ConflictException);

      expect(harness.requests[0]).toEqual(expect.objectContaining({
        status: ProcessStatus.PENDING,
        employmentStatus: EmploymentApplicationStatus.PENDING,
      }));
      expect(harness.steps[0]).toEqual(expect.objectContaining({
        decision: ApprovalDecision.PENDING,
        comment: null,
        operatedAt: null,
      }));
      expect(conversion.status).toBe(EmploymentApplicationStatus.PENDING);
    });

    it('synchronizes return-for-revision to draft on the linked conversion', async () => {
      const conversion: StoredBusinessRecord = {
        id: 'conversion-1',
        approvalRequestId: null,
        status: EmploymentApplicationStatus.PENDING,
        archivedAt: null,
      };
      const harness = createHarness({
        businessType: 'INTERN_TO_EMPLOYEE',
        employmentConversions: [conversion],
      });
      const request = await createBusinessRequest(harness, 'INTERN_TO_EMPLOYEE', conversion.id);
      conversion.approvalRequestId = request.id;
      await harness.service.approveCurrentStep(approverOne, request.id);

      await harness.service.returnForRevision(approverTwo, request.id, '请修订后新建申请');

      expect(conversion.status).toBe(EmploymentApplicationStatus.DRAFT);
    });

    it('returns by skipping only the current step and closes this request for immutable resubmission history', async () => {
      const harness = createHarness();
      const request = await createTwoStepRequest(harness);
      await harness.service.approveCurrentStep(approverOne, request.id, '已完成的一层');
      const firstStepSnapshot = { ...harness.steps[0] };

      await harness.service.returnForRevision(approverTwo, request.id, '请修订后新建申请');

      expect(harness.requests[0]).toEqual(expect.objectContaining({
        status: ProcessStatus.WITHDRAWN,
        employmentStatus: EmploymentApplicationStatus.DRAFT,
      }));
      expect(harness.steps[0]).toEqual(firstStepSnapshot);
      expect(harness.steps[1]).toEqual(expect.objectContaining({
        decision: ApprovalDecision.SKIPPED,
        comment: '请修订后新建申请',
      }));
    });

    it('rejects the entire request from the current step', async () => {
      const harness = createHarness();
      const request = await createTwoStepRequest(harness);

      await harness.service.reject(approverOne, request.id, '不符合任职规则');

      expect(harness.requests[0]).toEqual(expect.objectContaining({
        status: ProcessStatus.REJECTED,
        employmentStatus: EmploymentApplicationStatus.REJECTED,
      }));
      expect(harness.steps[0]).toEqual(expect.objectContaining({
        decision: ApprovalDecision.REJECTED,
        comment: '不符合任职规则',
      }));
      expect(harness.steps[1]?.decision).toBe(ApprovalDecision.PENDING);
    });
  });

  describe('participant and HR reads', () => {
    it('lists only the authenticated user own and current approval requests', async () => {
      const harness = createHarness();
      await createTwoStepRequest(harness);

      await harness.service.findMine(applicant, { page: 1, pageSize: 20 });
      await harness.service.findCurrent(approverOne, { page: 1, pageSize: 20 });

      expect(harness.tx.approvalRequest.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
        where: expect.objectContaining({ applicantUserId: applicant.id }),
      }));
      expect(harness.tx.approvalRequest.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
        where: expect.objectContaining({
          status: ProcessStatus.PENDING,
          employmentStatus: EmploymentApplicationStatus.PENDING,
          steps: { some: expect.objectContaining({ approverUserId: approverOne.id }) },
        }),
        orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
      }));
    });

    it('returns a sanitized conversion business summary for authorized detail readers', async () => {
      const harness = createHarness({ businessType: 'INTERN_TO_EMPLOYEE' });
      const request = await createBusinessRequest(harness, 'INTERN_TO_EMPLOYEE', 'conversion-1');
      harness.tx.employmentConversion.findUnique = jest.fn().mockResolvedValue({
        id: 'conversion-1',
        employeeId: 'employee-1',
        status: EmploymentApplicationStatus.PENDING,
        plannedEffectiveDate: new Date('2026-09-23T00:00:00.000Z'),
        targetOrganization: { id: 'org-target', name: '目标组织' },
        sourceSnapshot: { assignment: { organizationId: 'org-source' } },
        employee: { id: 'employee-1', employeeNo: 'E-001', name: '虚构员工' },
      });
      harness.tx.approvalRequest.findUnique.mockResolvedValue({
        ...harness.requests[0],
        applicant: { id: applicant.id, displayName: applicant.displayName },
        flowVersion: { id: 'flow-version-1', versionNumber: 1, definition: { id: 'flow-definition-1', code: 'FLOW', name: '虚构流程' } },
        steps: harness.steps,
      });

      const result = await harness.service.findDetail(applicant, request.id);

      expect(result.businessSummary).toEqual({
        kind: 'CONVERSION',
        conversionId: 'conversion-1',
        employee: { id: 'employee-1', employeeNo: 'E-001', name: '虚构员工' },
        sourceOrganizationName: null,
        targetOrganizationName: '目标组织',
        plannedEffectiveDate: '2026-09-23',
        status: EmploymentApplicationStatus.PENDING,
      });
      expect(result).not.toHaveProperty('sourceSnapshot');
    });

    it('returns a sanitized part-time business summary for authorized detail readers', async () => {
      const harness = createHarness({ businessType: 'PART_TIME_RECORD' });
      const request = await createBusinessRequest(harness, 'PART_TIME_RECORD', 'part-time-1');
      harness.tx.partTimeRecord.findUnique = jest.fn().mockResolvedValue({
        id: 'part-time-1',
        employee: { id: 'employee-1', employeeNo: 'E-001', name: '虚构员工' },
        organization: { id: 'org-source', name: '职责部门' },
        type: '项目顾问',
        institution: null,
        startDate: new Date('2026-09-23T00:00:00.000Z'),
        endDate: null,
        status: PartTimeRecordStatus.PENDING,
      });
      harness.tx.approvalRequest.findUnique.mockResolvedValue({
        ...harness.requests[0],
        applicant: { id: applicant.id, displayName: applicant.displayName },
        flowVersion: { id: 'flow-version-1', versionNumber: 1, definition: { id: 'flow-definition-1', code: 'FLOW', name: '虚构流程' } },
        steps: harness.steps,
      });

      const result = await harness.service.findDetail(applicant, request.id);

      expect(result.businessSummary).toEqual({
        kind: 'PART_TIME',
        partTimeRecordId: 'part-time-1',
        employee: { id: 'employee-1', employeeNo: 'E-001', name: '虚构员工' },
        organizationName: '职责部门',
        type: '项目顾问',
        institution: null,
        startDate: '2026-09-23',
        endDate: null,
        status: PartTimeRecordStatus.PENDING,
      });
    });

    it('allows detail to participants or HR with global employee data access', async () => {
      const harness = createHarness();
      const request = await createTwoStepRequest(harness);
      const outsider: AuthenticatedUser = { ...applicant, id: 'user-outsider' };
      const globalHr: AuthenticatedUser = {
        ...outsider,
        id: 'user-global-hr',
        permissions: [PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.EMPLOYEE_DATA_ALL],
      };

      await expect(harness.service.findDetail(applicant, request.id)).resolves.toEqual(
        expect.objectContaining({ id: request.id }),
      );
      await expect(harness.service.findDetail(approverTwo, request.id)).resolves.toEqual(
        expect.objectContaining({ id: request.id }),
      );
      await expect(harness.service.findDetail(globalHr, request.id)).resolves.toEqual(
        expect.objectContaining({ id: request.id }),
      );
      await expect(harness.service.findDetail(outsider, request.id)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows department HR to read an employment conversion only when both source and target are in scope', async () => {
      const harness = createHarness({ businessType: 'INTERN_TO_EMPLOYEE' });
      const request = await createBusinessRequest(harness, 'INTERN_TO_EMPLOYEE', 'conversion-1');
      const departmentHr: AuthenticatedUser = {
        ...applicant,
        id: 'user-department-hr',
        permissions: [PERMISSIONS.EMPLOYEE_READ],
        organizationIds: ['org-source'],
      };
      harness.tx.employmentConversion.findFirst.mockResolvedValueOnce({
        id: 'conversion-1',
        targetOrganizationId: 'org-target',
        sourceSnapshot: { assignment: { organizationId: 'org-source' } },
      });

      await expect(harness.service.findDetail(departmentHr, request.id)).resolves.toEqual(
        expect.objectContaining({ id: request.id }),
      );
      expect(harness.tx.employmentConversion.findFirst).toHaveBeenCalledWith({
        where: { id: 'conversion-1', archivedAt: null },
        select: { id: true, targetOrganizationId: true, sourceSnapshot: true },
      });
    });

    it('rejects department HR when the immutable conversion source snapshot is out of scope', async () => {
      const harness = createHarness({ businessType: 'INTERN_TO_EMPLOYEE' });
      const request = await createBusinessRequest(harness, 'INTERN_TO_EMPLOYEE', 'conversion-1');
      const departmentHr: AuthenticatedUser = {
        ...applicant,
        id: 'user-department-hr',
        permissions: [PERMISSIONS.EMPLOYEE_READ],
        organizationIds: ['org-source'],
      };
      harness.tx.employmentConversion.findFirst.mockResolvedValueOnce({
        id: 'conversion-1',
        targetOrganizationId: 'org-target',
        sourceSnapshot: { assignment: { organizationId: 'org-outside' } },
      });

      await expect(harness.service.findDetail(departmentHr, request.id)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows department HR to read a part-time request only when employee and target organization are in scope', async () => {
      const harness = createHarness({ businessType: 'PART_TIME_RECORD' });
      const request = await createBusinessRequest(harness, 'PART_TIME_RECORD', 'part-time-1');
      const departmentHr: AuthenticatedUser = {
        ...applicant,
        id: 'user-department-hr',
        permissions: [PERMISSIONS.EMPLOYEE_READ],
        organizationIds: ['org-source'],
      };
      harness.tx.partTimeRecord.findFirst.mockResolvedValueOnce({ id: 'part-time-1' });

      await expect(harness.service.findDetail(departmentHr, request.id)).resolves.toEqual(
        expect.objectContaining({ id: request.id }),
      );
      expect(harness.tx.partTimeRecord.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'part-time-1',
          organizationId: { in: inScopeOrganizationIds },
          employee: { is: expect.any(Object) },
          archivedAt: null,
        },
        select: { id: true },
      });
    });
  });

  describe('withdraw and effective lifecycle', () => {
    it('lets the applicant withdraw only before any step decision', async () => {
      const beforeDecision = createHarness();
      const request = await createTwoStepRequest(beforeDecision);

      await beforeDecision.service.withdraw(applicant, request.id);

      expect(beforeDecision.requests[0]).toEqual(expect.objectContaining({
        status: ProcessStatus.WITHDRAWN,
        employmentStatus: EmploymentApplicationStatus.WITHDRAWN,
      }));
      expect(beforeDecision.steps.every((step) => step.decision === ApprovalDecision.PENDING)).toBe(true);

      const afterDecision = createHarness();
      const decidedRequest = await createTwoStepRequest(afterDecision);
      await afterDecision.service.approveCurrentStep(approverOne, decidedRequest.id);
      await expect(afterDecision.service.withdraw(applicant, decidedRequest.id))
        .rejects.toBeInstanceOf(ConflictException);
      await expect(afterDecision.service.withdraw(approverTwo, decidedRequest.id))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('validates final approval and treats an already pending-effective request idempotently', async () => {
      const harness = createHarness({ nodes: [userNode(1, approverOne.id)] });
      const request = await createTwoStepRequest(harness);

      await expect(harness.service.markPendingEffective(request.id))
        .rejects.toBeInstanceOf(ConflictException);
      await harness.service.approveCurrentStep(approverOne, request.id);
      const updateCount = harness.tx.approvalRequest.updateMany.mock.calls.length;

      await harness.service.markPendingEffective(request.id);

      expect(harness.requests[0]?.employmentStatus).toBe(EmploymentApplicationStatus.PENDING_EFFECTIVE);
      expect(harness.tx.approvalRequest.updateMany).toHaveBeenCalledTimes(updateCount);
    });

    it('exposes transaction-bound create and completion helpers for business modules', async () => {
      const harness = createHarness({ nodes: [userNode(1, approverOne.id)] });
      const request = await harness.service.createRequestInTransaction(harness.tx as never, {
        businessType: 'MOCK_EMPLOYMENT_CHANGE',
        businessId: 'mock-business-transaction',
        applicantUserId: applicant.id,
        title: '虚构事务内申请',
      });
      expect(harness.prisma.$transaction).not.toHaveBeenCalled();
      await harness.service.approveCurrentStep(approverOne, request.id);
      harness.prisma.$transaction.mockClear();

      await harness.service.completeEffectiveInTransaction(harness.tx as never, request.id);

      expect(harness.prisma.$transaction).not.toHaveBeenCalled();
      expect(harness.requests.find(({ id }) => id === request.id)).toEqual(expect.objectContaining({
        status: ProcessStatus.COMPLETED,
        employmentStatus: EmploymentApplicationStatus.COMPLETED,
      }));
    });

    it('completes only a pending-effective request and keeps formal business records untouched', async () => {
      const harness = createHarness({ nodes: [userNode(1, approverOne.id)] });
      const request = await createTwoStepRequest(harness);
      await expect(harness.service.completeEffective(request.id)).rejects.toBeInstanceOf(ConflictException);
      await harness.service.approveCurrentStep(approverOne, request.id);

      await harness.service.completeEffective(request.id);

      expect(harness.requests[0]).toEqual(expect.objectContaining({
        status: ProcessStatus.COMPLETED,
        employmentStatus: EmploymentApplicationStatus.COMPLETED,
      }));
      expect(harness.tx.employmentConversion.updateMany).not.toHaveBeenCalled();
      expect(harness.tx.partTimeRecord.updateMany).not.toHaveBeenCalled();
      expect(harness.auditEvents.at(-1)).toEqual(expect.objectContaining({
        action: AuditAction.UPDATE,
        metadata: expect.objectContaining({ action: 'complete-effective' }),
      }));
    });
  });
});
