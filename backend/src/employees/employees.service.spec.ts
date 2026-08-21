import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { AuditService } from '../audit/audit.service';
import { DemoDataService } from '../demo/demo-data.service';
import { EmployeesService } from './employees.service';

const auditContext = { userId: 'demo-user-admin' };

function createServices() {
  const config = { get: (_key: string, fallback: unknown) => fallback } as never;
  const demo = new DemoDataService(config);
  const prisma = {} as never;
  const access = new AccessControlService(prisma, demo);
  const audit = new AuditService(prisma, demo);
  const employees = new EmployeesService(prisma, access, audit, demo);
  return { demo, access, employees };
}

function query(overrides: Partial<{ keyword: string; organizationId: string; status: EmploymentStatus; page: number; pageSize: number }> = {}) {
  return { page: 1, pageSize: 10, ...overrides } as never;
}

describe('EmployeesService in demo mode', () => {
  it('filters, paginates, and masks rows according to the role', async () => {
    const { demo, employees } = createServices();
    const departmentAdmin = demo.getUser('demo-user-deptadmin')!;

    const firstPage = await employees.findAll(departmentAdmin, query({ pageSize: 2 }));
    const inactive = await employees.findAll(departmentAdmin, query({ status: EmploymentStatus.INACTIVE }));
    const byKeyword = await employees.findAll(departmentAdmin, query({ keyword: '1002' }));

    expect(firstPage.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(firstPage.data[0]?.mobile).toMatch(/\*{4}/);
    expect(inactive.data.map((employee) => employee.employeeNo)).toEqual(['DEMO-2001']);
    expect(byKeyword.data.map((employee) => employee.name)).toEqual(['周予安']);
  });

  it('does not expose departments or employees outside the user scope', async () => {
    const { demo, access, employees } = createServices();
    const viewer = demo.getUser('demo-user-viewer')!;

    const result = await employees.findAll(viewer, query({ organizationId: 'demo-org-product' }));
    expect(result.data).toEqual([]);
    await expect(
      employees.findOne(viewer, 'demo-employee-1001', auditContext),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      access.assertOrganizationAccess(viewer, 'demo-org-product'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates and edits a complete employee through the existing service', async () => {
    const { demo, employees } = createServices();
    const admin = demo.getUser('demo-user-admin')!;

    const created = await employees.create(admin, {
      employeeNo: 'DEMO-5001',
      name: '完整演示员工',
      mobile: '13800005001',
      idCardNo: '110101199901015001',
      organizationId: 'demo-org-sales',
      employmentStatus: EmploymentStatus.ACTIVE,
    }, auditContext);
    const updated = await employees.update(admin, created.id, {
      name: '完整演示员工（已编辑）',
      employmentStatus: EmploymentStatus.INACTIVE,
    }, auditContext);

    expect(created.mobile).toBe('13800005001');
    expect(updated.name).toBe('完整演示员工（已编辑）');
    expect(updated.employmentStatus).toBe(EmploymentStatus.INACTIVE);
    expect(demo.getAuditCount()).toBe(2);
  });

  it('returns unmasked values only to the sensitive-data role', async () => {
    const { demo, employees } = createServices();
    const admin = demo.getUser('demo-user-admin')!;
    const viewer = {
      ...demo.getUser('demo-user-admin')!,
      permissions: [PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.EMPLOYEE_DATA_ALL],
    };

    const adminResult = await employees.findOne(admin, 'demo-employee-1001', auditContext);
    const viewerResult = await employees.findOne(viewer, 'demo-employee-1001', auditContext);

    expect(adminResult.mobile).toBe('13800001001');
    expect(viewerResult.mobile).toBe('138****1001');
  });
});
