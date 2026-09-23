import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentStatus,
  EmploymentApplicationStatus,
  EmploymentRelationship,
  EmploymentStatus,
  RecordStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { EmploymentConversionsService } from './employment-conversions.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  username: 'hr-user',
  displayName: '虚构 HR',
  role: 'ADMIN',
  roleName: '管理员',
  permissions: ['employee.update', 'employee.read'] as never,
  organizationIds: ['org-source', 'org-target'],
};

const sourceAssignment = {
  id: 'assignment-source',
  employeeId: 'employee-1',
  employmentPeriodId: 'period-source',
  organizationId: 'org-source',
  positionId: 'position-source',
  jobTitleId: 'job-title-source',
  jobLevel: 'S2',
  workplaceName: '上海',
  personnelPosition: 'FRONT_OFFICE',
  employeeLevel: 'STAFF',
  personnelCategory: 'NON_TALENT_PROGRAM',
  personnelSource: 'SOCIAL_RECRUITMENT',
  employmentRelationship: EmploymentRelationship.INTERN,
  assignmentType: 'PRIMARY',
  workArrangement: 'INTERN',
  confirmationDate: null,
  trialPostEndDate: null,
  isPrimary: true,
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: null,
  status: AssignmentStatus.ACTIVE,
  archivedAt: null,
};

const sourcePeriod = {
  id: 'period-source',
  employeeId: 'employee-1',
  sequenceNo: 1,
  personnelCategory: 'NON_TALENT_PROGRAM',
  personnelSource: 'SOCIAL_RECRUITMENT',
  employmentRelationship: EmploymentRelationship.INTERN,
  entryDate: new Date('2026-01-01T00:00:00.000Z'),
  plannedExitDate: null,
  actualExitDate: null,
  employmentStatus: EmploymentStatus.PROBATION,
  isRehire: false,
  previousPeriodId: null,
  exitReason: null,
  status: RecordStatus.ACTIVE,
  archivedAt: null,
  employee: {
    id: 'employee-1',
    employeeNo: 'E-001',
    name: '虚构员工',
    recordStatus: RecordStatus.ACTIVE,
    archivedAt: null,
  },
  assignments: [sourceAssignment],
};

const targetOrganization = {
  id: 'org-target',
  code: 'TARGET',
  name: '目标组织',
  status: RecordStatus.ACTIVE,
  archivedAt: null,
};

const targetPosition = {
  id: 'position-target',
  name: '目标职位',
  status: RecordStatus.ACTIVE,
  archivedAt: null,
};

const targetJobTitle = {
  id: 'job-title-target',
  code: 'TARGET-TITLE',
  name: '目标职务',
  status: RecordStatus.ACTIVE,
  archivedAt: null,
};

function createHarness(options: {
  source?: Record<string, any> | null;
  targetOrganization?: Record<string, any> | null;
  targetPosition?: Record<string, any> | null;
  targetJobTitle?: Record<string, any> | null;
  duplicate?: Record<string, any> | null;
  conversion?: Record<string, any>;
  approvalRequest?: Record<string, any> | null;
  accessible?: boolean;
  allData?: boolean;
} = {}) {
  const conversions: Record<string, any>[] = [];
  const period = options.source ?? sourcePeriod;
  const conversion = options.conversion ?? {
    id: 'conversion-1',
    type: 'INTERN_TO_EMPLOYEE',
    employeeId: 'employee-1',
    sourceEmploymentPeriodId: 'period-source',
    targetOrganizationId: 'org-target',
    targetPositionId: 'position-target',
    targetJobTitleId: 'job-title-target',
    targetJobLevel: 'S3',
    plannedEffectiveDate: new Date('2099-01-01T00:00:00.000Z'),
    approvalRequestId: 'approval-1',
    status: EmploymentApplicationStatus.PENDING,
    sourceSnapshot: {},
    targetSnapshot: {},
    archivedAt: null,
  };
  if (!conversion.sourceEmploymentPeriod) conversion.sourceEmploymentPeriod = period;
  conversions.push(conversion);

  const tx = {
    employmentPeriod: {
      findFirst: jest.fn().mockResolvedValue(period),
      findUnique: jest.fn().mockResolvedValue(period),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({
        id: 'period-target',
        employeeId: 'employee-1',
        sequenceNo: 2,
        employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
        entryDate: new Date('2099-01-01T00:00:00.000Z'),
        employmentStatus: EmploymentStatus.REGULAR,
      }),
    },
    employmentConversion: {
      findFirst: jest.fn().mockResolvedValue(options.duplicate ?? null),
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(conversions[0] ?? null)),
      findMany: jest.fn().mockResolvedValue(conversions),
      count: jest.fn().mockResolvedValue(conversions.length),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, any> }) => {
        const created = { ...conversion, ...data, id: 'conversion-created' };
        conversions[0] = created;
        return Promise.resolve(created);
      }),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, any> }) => {
        Object.assign(conversions[0], data);
        return Promise.resolve(conversions[0]);
      }),
      updateMany: jest.fn().mockImplementation(({ data }: { data: Record<string, any> }) => {
        Object.assign(conversions[0], data);
        return Promise.resolve({ count: 1 });
      }),
    },
    organization: {
      findFirst: jest.fn().mockResolvedValue(options.targetOrganization === undefined
        ? targetOrganization
        : options.targetOrganization),
    },
    position: {
      findFirst: jest.fn().mockResolvedValue(options.targetPosition === undefined
        ? targetPosition
        : options.targetPosition),
    },
    jobTitle: {
      findFirst: jest.fn().mockResolvedValue(options.targetJobTitle === undefined
        ? targetJobTitle
        : options.targetJobTitle),
    },
    approvalRequest: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'approval-1',
        businessType: conversion.type,
        businessId: 'conversion-1',
        status: 'PENDING',
        employmentStatus: EmploymentApplicationStatus.PENDING,
        archivedAt: null,
        ...options.approvalRequest,
      }),
    },
    employeeAssignment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'assignment-target' }),
      findFirst: jest.fn().mockResolvedValue(sourceAssignment),
    },
    employmentRecord: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'record-target' }),
    },
    employee: {
      update: jest.fn().mockResolvedValue({ id: 'employee-1' }),
    },
    employeeFieldChangeLog: {
      create: jest.fn().mockResolvedValue({ id: 'change-log-1' }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((input: ((client: typeof tx) => unknown) | Promise<unknown>[]) => (
      Array.isArray(input) ? Promise.all(input) : input(tx)
    )),
  };
  const access = {
    hasAllEmployeeData: jest.fn().mockReturnValue(options.allData ?? false),
    canAccessOrganizationInScope: jest.fn().mockResolvedValue(options.accessible ?? true),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-source', 'org-target']),
  };
  const runtime = {
    createRequest: jest.fn().mockResolvedValue({
      id: 'approval-1',
      status: 'PENDING',
      employmentStatus: EmploymentApplicationStatus.PENDING,
    }),
    createRequestInTransaction: jest.fn().mockResolvedValue({
      id: 'approval-1',
      status: 'PENDING',
      employmentStatus: EmploymentApplicationStatus.PENDING,
    }),
    completeEffective: jest.fn().mockResolvedValue({
      id: 'approval-1',
      status: 'COMPLETED',
      employmentStatus: EmploymentApplicationStatus.COMPLETED,
    }),
    completeEffectiveInTransaction: jest.fn().mockResolvedValue({
      id: 'approval-1',
      status: 'COMPLETED',
      employmentStatus: EmploymentApplicationStatus.COMPLETED,
    }),
  };
  const service = new EmploymentConversionsService(
    prisma as never,
    access as never,
    runtime as never,
  );

  return { service, prisma, tx, access, runtime, conversions, period };
}

const validCreateInput = {
  type: 'INTERN_TO_EMPLOYEE' as const,
  employeeId: 'employee-1',
  sourceEmploymentPeriodId: 'period-source',
  targetOrganizationId: 'org-target',
  targetPositionId: 'position-target',
  targetJobTitleId: 'job-title-target',
  targetJobLevel: 'S3' as const,
  plannedEffectiveDate: '2099-01-01',
};

describe('EmploymentConversionsService', () => {
  describe('create', () => {
    it('rejects a source period whose relationship is not INTERN or LABOR_WORKER', async () => {
      const source = {
        ...sourcePeriod,
        employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
      };
      const { service } = createHarness({ source });

      await expect(service.create(user, validCreateInput)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an employee id that does not match the source period', async () => {
      const { service } = createHarness();

      await expect(service.create(user, {
        ...validCreateInput,
        employeeId: 'employee-2',
      })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects archived target organizations', async () => {
      const { service } = createHarness({ targetOrganization: null });

      await expect(service.create(user, validCreateInput)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a planned effective date before today in Asia/Shanghai', async () => {
      const { service } = createHarness();

      await expect(service.create(user, {
        ...validCreateInput,
        plannedEffectiveDate: '2000-01-01',
      })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a second open conversion for the same source period', async () => {
      const { service } = createHarness({ duplicate: { id: 'existing-conversion' } });

      await expect(service.create(user, validCreateInput)).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates snapshots and binds the conversion to the published runtime request in one transaction', async () => {
      const { service, prisma, tx, runtime } = createHarness();

      const result = await service.create(user, validCreateInput);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.employmentConversion.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          employeeId: 'employee-1',
          sourceEmploymentPeriodId: 'period-source',
          status: EmploymentApplicationStatus.DRAFT,
          sourceSnapshot: expect.objectContaining({
            employmentRelationship: EmploymentRelationship.INTERN,
          }),
          targetSnapshot: expect.objectContaining({
            employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
            employmentStatus: EmploymentStatus.REGULAR,
          }),
        }),
      }));
      expect(runtime.createRequestInTransaction).toHaveBeenCalledWith(tx, expect.objectContaining({
        businessType: validCreateInput.type,
        businessId: 'conversion-created',
        applicantUserId: user.id,
      }));
      expect(runtime.createRequest).not.toHaveBeenCalled();
      expect(tx.employmentConversion.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'conversion-created' },
        data: expect.objectContaining({
          approvalRequestId: 'approval-1',
          status: EmploymentApplicationStatus.PENDING,
        }),
      }));
      expect(result).toEqual(expect.objectContaining({ id: 'conversion-created' }));
    });

    it('propagates approval creation failure from the conversion transaction', async () => {
      const { service, tx, runtime } = createHarness();
      const failure = new Error('approval creation failed');
      runtime.createRequestInTransaction.mockRejectedValue(failure);

      await expect(service.create(user, validCreateInput)).rejects.toBe(failure);

      expect(tx.employmentConversion.create).toHaveBeenCalled();
      expect(tx.employmentConversion.update).not.toHaveBeenCalled();
      expect(runtime.createRequest).not.toHaveBeenCalled();
    });

    it('requires both source and target organizations in the user data scope', async () => {
      const { service, access } = createHarness({ accessible: false });

      await expect(service.create(user, validCreateInput)).rejects.toBeInstanceOf(ForbiddenException);
      expect(access.canAccessOrganizationInScope).toHaveBeenCalled();
    });

    it('rejects a conversion type that does not match the source relationship', async () => {
      const { service } = createHarness();

      await expect(service.create(user, {
        ...validCreateInput,
        type: 'LABOR_TO_EMPLOYEE',
      })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('filters list results to conversions with both source and target organizations in scope', async () => {
      const { service, tx, access } = createHarness();

      await service.findAll(user, { page: 1, pageSize: 10 });

      expect(access.getAccessibleOrganizationIds).toHaveBeenCalledWith(user);
      expect(tx.employmentConversion.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          targetOrganizationId: { in: ['org-source', 'org-target'] },
          sourceEmploymentPeriod: {
            assignments: { some: { organizationId: { in: ['org-source', 'org-target'] } } },
          },
        }),
      }));
    });
  });

  describe('activate', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2099-01-02T04:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('rejects activation before the planned Asia/Shanghai business date', async () => {
      const { service, tx, runtime } = createHarness({
        conversion: {
          id: 'conversion-1',
          type: 'INTERN_TO_EMPLOYEE',
          employeeId: 'employee-1',
          sourceEmploymentPeriodId: 'period-source',
          targetOrganizationId: 'org-target',
          targetPositionId: 'position-target',
          targetJobTitleId: 'job-title-target',
          targetJobLevel: 'S3',
          plannedEffectiveDate: new Date('2099-01-03T00:00:00.000Z'),
          approvalRequestId: 'approval-1',
          status: EmploymentApplicationStatus.PENDING_EFFECTIVE,
          archivedAt: null,
        },
        approvalRequest: {
          id: 'approval-1',
          status: 'APPROVED',
          employmentStatus: EmploymentApplicationStatus.PENDING_EFFECTIVE,
        },
      });

      await expect(service.activate(user, 'conversion-1')).rejects.toBeInstanceOf(ConflictException);
      expect(tx.employmentPeriod.updateMany).not.toHaveBeenCalled();
      expect(tx.employeeAssignment.create).not.toHaveBeenCalled();
      expect(runtime.completeEffectiveInTransaction).not.toHaveBeenCalled();
    });

    it('rejects activation before the approval request reaches pending-effective', async () => {
      const { service, tx } = createHarness({
        approvalRequest: {
          id: 'approval-1',
          status: 'PENDING',
          employmentStatus: EmploymentApplicationStatus.PENDING,
        },
      });

      await expect(service.activate(user, 'conversion-1')).rejects.toBeInstanceOf(ConflictException);
      expect(tx.employmentPeriod.updateMany).not.toHaveBeenCalled();
      expect(tx.employeeAssignment.create).not.toHaveBeenCalled();
    });

    it('uses the UTC day before the new period start for every source end date', async () => {
      const { service, tx, runtime } = createHarness({
        conversion: {
          id: 'conversion-1',
          type: 'INTERN_TO_EMPLOYEE',
          employeeId: 'employee-1',
          sourceEmploymentPeriodId: 'period-source',
          targetOrganizationId: 'org-target',
          targetPositionId: 'position-target',
          targetJobTitleId: 'job-title-target',
          targetJobLevel: 'S3',
          plannedEffectiveDate: new Date('2099-01-02T00:00:00.000Z'),
          approvalRequestId: 'approval-1',
          status: EmploymentApplicationStatus.PENDING_EFFECTIVE,
          archivedAt: null,
        },
        approvalRequest: {
          id: 'approval-1',
          status: 'APPROVED',
          employmentStatus: EmploymentApplicationStatus.PENDING_EFFECTIVE,
        },
      });

      await service.activate(user, 'conversion-1');

      const priorDay = new Date('2099-01-01T00:00:00.000Z');
      expect(tx.employmentPeriod.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ actualExitDate: priorDay }),
      }));
      expect(tx.employeeAssignment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ endDate: priorDay }),
      }));
      expect(tx.employmentRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ endedAt: priorDay }),
      }));
      expect(tx.employmentPeriod.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ entryDate: new Date('2099-01-02T00:00:00.000Z') }),
      }));
      expect(tx.employeeAssignment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ startDate: new Date('2099-01-02T00:00:00.000Z') }),
      }));
      expect(tx.employmentRecord.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ effectiveAt: new Date('2099-01-02T00:00:00.000Z') }),
      }));
      expect(runtime.completeEffectiveInTransaction).toHaveBeenCalledWith(tx, 'approval-1');
      expect(runtime.completeEffective).not.toHaveBeenCalled();
    });

    it('blocks activation when the prior day would precede the source start date', async () => {
      const source = {
        ...sourcePeriod,
        entryDate: new Date('2099-01-02T00:00:00.000Z'),
        assignments: [{
          ...sourceAssignment,
          startDate: new Date('2099-01-02T00:00:00.000Z'),
        }],
      };
      const { service, tx } = createHarness({
        source,
        conversion: {
          id: 'conversion-1',
          type: 'INTERN_TO_EMPLOYEE',
          employeeId: 'employee-1',
          sourceEmploymentPeriodId: 'period-source',
          targetOrganizationId: 'org-target',
          targetPositionId: 'position-target',
          targetJobTitleId: 'job-title-target',
          targetJobLevel: 'S3',
          plannedEffectiveDate: new Date('2099-01-02T00:00:00.000Z'),
          approvalRequestId: 'approval-1',
          status: EmploymentApplicationStatus.PENDING_EFFECTIVE,
          archivedAt: null,
        },
        approvalRequest: {
          id: 'approval-1',
          status: 'APPROVED',
          employmentStatus: EmploymentApplicationStatus.PENDING_EFFECTIVE,
        },
      });

      await expect(service.activate(user, 'conversion-1')).rejects.toBeInstanceOf(ConflictException);
      expect(tx.employmentPeriod.updateMany).not.toHaveBeenCalled();
      expect(tx.employmentPeriod.create).not.toHaveBeenCalled();
    });

    it('rolls back activation when runtime completion fails inside the transaction', async () => {
      const { service, tx, runtime } = createHarness({
        conversion: {
          id: 'conversion-1',
          type: 'INTERN_TO_EMPLOYEE',
          employeeId: 'employee-1',
          sourceEmploymentPeriodId: 'period-source',
          targetOrganizationId: 'org-target',
          targetPositionId: 'position-target',
          targetJobTitleId: 'job-title-target',
          targetJobLevel: 'S3',
          plannedEffectiveDate: new Date('2099-01-01T00:00:00.000Z'),
          approvalRequestId: 'approval-1',
          status: EmploymentApplicationStatus.PENDING_EFFECTIVE,
          archivedAt: null,
        },
        approvalRequest: {
          id: 'approval-1',
          status: 'APPROVED',
          employmentStatus: EmploymentApplicationStatus.PENDING_EFFECTIVE,
        },
      });
      const failure = new Error('approval completion failed');
      runtime.completeEffectiveInTransaction.mockRejectedValue(failure);

      await expect(service.activate(user, 'conversion-1')).rejects.toBe(failure);

      expect(runtime.completeEffectiveInTransaction).toHaveBeenCalledWith(tx, 'approval-1');
      expect(runtime.completeEffective).not.toHaveBeenCalled();
    });

    it('atomically ends the source records, creates a new regular period and assignment, and completes runtime', async () => {
      const { service, tx, runtime } = createHarness({
        conversion: {
          id: 'conversion-1',
          type: 'INTERN_TO_EMPLOYEE',
          employeeId: 'employee-1',
          sourceEmploymentPeriodId: 'period-source',
          targetOrganizationId: 'org-target',
          targetPositionId: 'position-target',
          targetJobTitleId: 'job-title-target',
          targetJobLevel: 'S3',
          plannedEffectiveDate: new Date('2099-01-01T00:00:00.000Z'),
          approvalRequestId: 'approval-1',
          status: EmploymentApplicationStatus.PENDING_EFFECTIVE,
          archivedAt: null,
        },
        approvalRequest: {
          id: 'approval-1',
          status: 'APPROVED',
          employmentStatus: EmploymentApplicationStatus.PENDING_EFFECTIVE,
        },
      });

      await service.activate(user, 'conversion-1');

      expect(tx.employmentPeriod.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: 'period-source',
          employeeId: 'employee-1',
        }),
        data: expect.objectContaining({
          actualExitDate: new Date('2098-12-31T00:00:00.000Z'),
          employmentStatus: EmploymentStatus.TRANSFERRED_OUT,
        }),
      }));
      expect(tx.employeeAssignment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          endDate: new Date('2098-12-31T00:00:00.000Z'),
          status: AssignmentStatus.ENDED,
        }),
      }));
      expect(tx.employmentRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          currentFlag: false,
          endedAt: new Date('2098-12-31T00:00:00.000Z'),
        }),
      }));
      expect(tx.employmentPeriod.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          employeeId: 'employee-1',
          employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
          employmentStatus: EmploymentStatus.REGULAR,
          previousPeriodId: 'period-source',
        }),
      }));
      expect(tx.employeeAssignment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-target',
          positionId: 'position-target',
          jobTitleId: 'job-title-target',
          jobLevel: 'S3',
          employmentRelationship: EmploymentRelationship.INTERNAL_EMPLOYEE,
          isPrimary: true,
        }),
      }));
      expect(tx.employmentRecord.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          employeeId: 'employee-1',
          status: EmploymentStatus.REGULAR,
          currentFlag: true,
        }),
      }));
      expect(tx.employee.update).toHaveBeenCalledWith({
        where: { id: 'employee-1' },
        data: { organizationId: 'org-target' },
      });
      expect(tx.employmentConversion.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: 'conversion-1',
          status: EmploymentApplicationStatus.PENDING_EFFECTIVE,
        }),
        data: { status: EmploymentApplicationStatus.COMPLETED },
      }));
      expect(runtime.completeEffectiveInTransaction).toHaveBeenCalledWith(tx, 'approval-1');
      expect(runtime.completeEffective).not.toHaveBeenCalled();
    });

    it('rejects repeated activation consistently after completion', async () => {
      const { service, runtime } = createHarness({
        conversion: {
          id: 'conversion-1',
          employeeId: 'employee-1',
          sourceEmploymentPeriodId: 'period-source',
          targetOrganizationId: 'org-target',
          plannedEffectiveDate: new Date('2099-01-01T00:00:00.000Z'),
          approvalRequestId: 'approval-1',
          status: EmploymentApplicationStatus.COMPLETED,
        },
      });

      await expect(service.activate(user, 'conversion-1')).rejects.toBeInstanceOf(ConflictException);
      expect(runtime.completeEffective).not.toHaveBeenCalled();
    });
  });
});
