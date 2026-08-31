import { ApprovalDecision, AssignmentStatus, ProcessStatus } from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import { EmployeeInfoApprovalService } from './employee-info-approval.service';

const query = { page: 1, pageSize: 10 } as never;
const scopedUser = {
  id: 'user-1',
  username: 'viewer',
  displayName: '虚构查看者',
  role: 'VIEWER' as const,
  roleName: '查看者',
  permissions: [PERMISSIONS.EMPLOYEE_READ],
  organizationIds: ['org-1'],
};

const employeeWhere = {
  OR: [
    { assignments: { some: { organizationId: { in: ['org-1', 'org-child'] } } } },
    { assignments: { none: {} }, organizationId: { in: ['org-1', 'org-child'] } },
  ],
};

function createDatabaseService(rows: unknown[] = []) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const count = jest.fn().mockResolvedValue(rows.length);
  const prisma = {
    employeeChangeRequest: { findMany, count },
    organization: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'org-1', parentId: null },
        { id: 'org-child', parentId: 'org-1' },
      ]),
    },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const access = {
    hasAllEmployeeData: jest.fn(() => false),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-1', 'org-child']),
    getEmployeeWhere: jest.fn().mockResolvedValue(employeeWhere),
  };
  return {
    service: new EmployeeInfoApprovalService(prisma as never, access as never, { enabled: false } as never),
    findMany,
  };
}

describe('EmployeeInfoApprovalService', () => {
  it('returns an explicit empty page in demo mode', async () => {
    const service = new EmployeeInfoApprovalService(
      {} as never,
      {} as never,
      { enabled: true } as never,
    );

    await expect(service.findAll(scopedUser, query)).resolves.toEqual({
      data: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    });
  });

  it('queries only unarchived records with the shared employee scope and scoped assignments', async () => {
    const { service, findMany } = createDatabaseService();

    await service.findAll(scopedUser, query);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        archivedAt: null,
        approvalRequest: {
          is: {
            businessType: 'EMPLOYEE_CHANGE_REQUEST',
            archivedAt: null,
          },
        },
        employee: { is: { AND: [employeeWhere] } },
      },
      include: expect.objectContaining({
        employee: expect.objectContaining({
          include: expect.objectContaining({
            assignments: expect.objectContaining({
              where: expect.objectContaining({
                status: AssignmentStatus.ACTIVE,
                organizationId: { in: ['org-1', 'org-child'] },
              }),
            }),
          }),
        }),
        approvalRequest: expect.objectContaining({
          include: expect.objectContaining({
            steps: expect.objectContaining({ where: { decision: ApprovalDecision.PENDING } }),
          }),
        }),
      }),
    }));
  });

  it('lets a parent department filter include records assigned to its descendants', async () => {
    const { service, findMany } = createDatabaseService();

    await service.findAll(scopedUser, { page: 1, pageSize: 10, departmentId: 'org-1' } as never);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        employee: {
          is: {
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    assignments: {
                      some: expect.objectContaining({
                        organizationId: { in: ['org-1', 'org-child'] },
                      }),
                    },
                  }),
                ]),
              }),
            ]),
          },
        },
      }),
    }));
  });

  it('uses currentStep rather than an earlier pending step and never exposes an outside department', async () => {
    const row = {
      id: 'change-1',
      employeeId: 'employee-1',
      employee: {
        id: 'employee-1',
        name: '虚构员工',
        organizationId: 'org-outside',
        organization: { id: 'org-outside', name: '范围外主部门' },
        assignments: [
          {
            isPrimary: false,
            startDate: new Date('2026-01-01'),
            organization: { name: '范围内次要部门' },
          },
        ],
      },
      approvalRequest: {
        currentStep: 2,
        status: ProcessStatus.PENDING,
        submittedAt: new Date('2026-08-20T08:30:00.000Z'),
        applicant: { displayName: '虚构发起人' },
        steps: [
          { stepOrder: 1, decision: ApprovalDecision.PENDING, approver: { displayName: '旧审批人' } },
          { stepOrder: 2, decision: ApprovalDecision.PENDING, approver: { displayName: '当前审批人' } },
        ],
      },
      status: ProcessStatus.PENDING,
      createdAt: new Date('2026-08-20T08:30:00.000Z'),
    };
    const { service } = createDatabaseService([row]);

    const result = await service.findAll(scopedUser, query);

    expect(result.data[0]).toEqual(expect.objectContaining({
      departmentName: '范围内次要部门',
      currentApproverName: '当前审批人',
    }));
    expect(JSON.stringify(result.data[0])).not.toContain('范围外主部门');
  });
});
