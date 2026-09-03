import ExcelJS from 'exceljs';
import { EmployeesService } from './employees.service';
import { PERMISSIONS } from '@hr-demo/shared';

const user = {
  id: 'user-admin',
  username: 'admin',
  displayName: '虚构管理员',
  role: 'ADMIN' as const,
  roleName: '管理员',
  permissions: [PERMISSIONS.EMPLOYEE_READ],
  organizationIds: [],
};

const employee = {
  id: 'employee-1',
  employeeNo: 'FAKE-1001',
  name: '虚构员工甲',
  mobile: '13900001001',
  idCardNo: null,
  organizationId: 'org-1',
  organization: { name: '虚构部门' },
  employmentRecords: [{ status: 'REGULAR' }],
  employmentPeriods: [],
  assignments: [],
  reportingAsEmployee: [],
  identityDocuments: [],
  familyMembers: [],
  educationExperiences: [],
  workExperiences: [],
  convertedCandidates: [],
  gender: null,
  workEmail: 'fictional.employee@example.invalid',
  personalEmail: null,
  birthDate: null,
  ethnicity: null,
  maritalStatus: null,
  politicalStatus: null,
  nativePlace: null,
  householdType: null,
  householdAddress: null,
  residentialAddress: null,
  bankName: null,
  bankBranchName: null,
  bankAccountNumber: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createService() {
  const employeeFindMany = jest.fn().mockResolvedValue([employee]);
  const prisma = { employee: { findMany: employeeFindMany } };
  const access = {
    hasAllEmployeeData: jest.fn().mockReturnValue(true),
    getAccessibleOrganizationIds: jest.fn(),
    getEmployeeWhere: jest.fn(),
    getOrganizationSubtreeIds: jest.fn(),
  };
  const service = new EmployeesService(
    prisma as never,
    access as never,
    { create: jest.fn() } as never,
    { enabled: false } as never,
  );
  return { service, employeeFindMany };
}

describe('EmployeesService exportEmployees', () => {
  it('creates a CSV with only the selected fields', async () => {
    const { service, employeeFindMany } = createService();

    const result = await service.exportEmployees(user, {
      format: 'CSV',
      fields: ['employeeNo', 'name', 'workEmail'],
      employeeIds: ['employee-1'],
    });

    expect(result.contentType).toBe('text/csv; charset=utf-8');
    expect(result.filename).toMatch(/^人员导出_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(result.buffer.toString('utf8')).toContain('工号');
    expect(result.buffer.toString('utf8')).toContain('姓名');
    expect(result.buffer.toString('utf8')).toContain('企业邮箱');
    expect(result.buffer.toString('utf8')).toContain('FAKE-1001');
    expect(employeeFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ id: { in: ['employee-1'] } }]),
      }),
    }));
  });

  it('creates an XLSX with fields in the user-selected order', async () => {
    const { service } = createService();

    const result = await service.exportEmployees(user, {
      format: 'XLSX',
      fields: ['name', 'employeeNo'],
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const worksheet = workbook.getWorksheet('人员')!;
    expect(worksheet.getRow(1).values).toEqual([, '姓名', '工号']);
    expect(worksheet.getRow(2).values).toEqual([, '虚构员工甲', 'FAKE-1001']);
  });
});
