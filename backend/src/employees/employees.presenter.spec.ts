import { EmploymentStatus } from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import { maskIdCard, maskMobile, presentEmployee } from './employees.presenter';

const employee = {
  id: 'employee-1',
  employeeNo: 'DEMO-1001',
  name: '林知夏',
  mobile: '13800001001',
  idCardNo: '110101199203181021',
  organizationId: 'org-1',
  organization: { name: '产品研发部' },
  employmentRecords: [{ status: EmploymentStatus.ACTIVE }],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const user = {
  id: 'user-1',
  username: 'viewer',
  displayName: '普通查看者',
  role: 'VIEWER' as const,
  roleName: '普通查看者',
  permissions: [PERMISSIONS.EMPLOYEE_READ],
  organizationIds: ['org-1'],
};

describe('employees presenter', () => {
  it('masks mobile and ID card without sensitive permission', () => {
    const result = presentEmployee(employee, user);
    expect(result.mobile).toBe('138****1001');
    expect(result.idCardNo).toBe('110101********1021');
    expect(JSON.stringify(result)).not.toContain(employee.mobile);
    expect(JSON.stringify(result)).not.toContain(employee.idCardNo);
  });

  it('returns sensitive values with permission', () => {
    const result = presentEmployee(employee, {
      ...user,
      role: 'ADMIN',
      permissions: [PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.EMPLOYEE_SENSITIVE_READ],
    });
    expect(result.mobile).toBe(employee.mobile);
    expect(result.idCardNo).toBe(employee.idCardNo);
  });

  it('uses deterministic mask formats', () => {
    expect(maskMobile('13800001001')).toBe('138****1001');
    expect(maskIdCard('110101199203181021')).toBe('110101********1021');
  });
});
