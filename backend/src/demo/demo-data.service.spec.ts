import { ConflictException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import { DemoDataService } from './demo-data.service';

function createService() {
  return new DemoDataService({ get: (_key: string, fallback: unknown) => fallback } as never);
}

describe('DemoDataService', () => {
  it('authenticates the built-in accounts without a database', () => {
    const service = createService();
    const admin = service.authenticate('admin', 'Demo@123');

    expect(service.enabled).toBe(true);
    expect(admin?.role).toBe('ADMIN');
    expect(admin?.permissions).toContain(PERMISSIONS.EMPLOYEE_DATA_ALL);
    expect(service.authenticate('admin', 'wrong-password')).toBeNull();
    expect(service.getUser('demo-user-admin')?.username).toBe('admin');
  });

  it('keeps the three role scopes and operation permissions separate', () => {
    const service = createService();
    const departmentAdmin = service.authenticate('deptadmin', 'Demo@123');
    const viewer = service.authenticate('viewer', 'Demo@123');

    expect(departmentAdmin?.organizationIds).toEqual(['demo-org-ceo_chen_rui']);
    expect(service.getOrganizations()).toHaveLength(44);
    expect(service.getOrganizations().filter(({ parentId }) => parentId === 'demo-org-company_shanghai_yixin')).toHaveLength(2);
    expect(service.getOrganizations().filter(({ parentId }) => parentId === 'demo-org-ceo_chen_rui')).toHaveLength(9);
    expect(service.getOrganizations().filter(({ parentId }) => parentId === 'demo-org-chairman_chen_gang')).toHaveLength(12);
    expect(service.getOrganizations().find(({ name }) => name === '上海宜信电子商务有限公司')?.parentId).toBeNull();
    expect(service.getOrganizations().find(({ name }) => name === '二部天猫超市组')?.parentId).toBe('demo-org-ceo_second_department');
    expect(departmentAdmin?.permissions).toContain(PERMISSIONS.EMPLOYEE_UPDATE);
    expect(viewer?.organizationIds).toEqual(['demo-org-chairman_chen_gang']);
    expect(viewer?.permissions).toEqual([]);
  });

  it('creates and updates in-memory employees', () => {
    const service = createService();
    const created = service.createEmployee({
      employeeNo: 'DEMO-4001',
      name: '演示新员工',
      mobile: '13800004001',
      idCardNo: '110101199901011234',
      organizationId: 'demo-org-ceo_second_tmall_supermarket',
      employmentStatus: 'REGULAR',
    });

    service.updateEmployee(created, {
      name: '演示员工（已编辑）',
      organizationId: 'demo-org-chairman_finance',
      employmentStatus: 'RESIGNED',
    });

    expect(service.getEmployees()).toHaveLength(5);
    expect(created.name).toBe('演示员工（已编辑）');
    expect(created.organization.name).toBe('财务部');
    expect(created.employmentRecords[0]?.status).toBe(EmploymentStatus.RESIGNED);
  });

  it('rejects duplicate employee numbers and ID card numbers', () => {
    const service = createService();

    expect(() => service.createEmployee({
      employeeNo: 'DEMO-1001',
      name: '重复工号',
      mobile: '13800004998',
      idCardNo: '110101199901019998',
      organizationId: 'demo-org-ceo_second_tmall_supermarket',
      employmentStatus: 'REGULAR',
    })).toThrow(ConflictException);

    expect(() => service.createEmployee({
      employeeNo: 'DEMO-4999',
      name: '重复身份证',
      mobile: '13800004999',
      idCardNo: '110101199203181021',
      organizationId: 'demo-org-ceo_second_tmall_supermarket',
      employmentStatus: 'REGULAR',
    })).toThrow('身份证号已存在');
  });
});
