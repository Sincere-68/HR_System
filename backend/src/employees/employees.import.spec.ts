import ExcelJS from 'exceljs';
import { EmployeesService } from './employees.service';
import { KNOWN_ACTIVE_EMPLOYEE_EXPORT_PROFILE } from './employee-import-column-profiles';
import { PERMISSIONS } from '@hr-demo/shared';

const user = {
  id: 'user-admin',
  username: 'admin',
  displayName: '虚构管理员',
  role: 'ADMIN' as const,
  roleName: '管理员',
  permissions: [PERMISSIONS.EMPLOYEE_UPDATE],
  organizationIds: [],
};

async function createXlsx(headers: string[], rows: string[][]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('人员');
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function createService(existingEmployee: { id: string } | null = null) {
  const employeeCreate = jest.fn().mockResolvedValue({ id: 'created-employee' });
  const prisma = {
    employee: {
      findUnique: jest.fn().mockResolvedValue(existingEmployee && { ...existingEmployee, assignments: [] }),
      findFirst: jest.fn(),
      create: employeeCreate,
    },
    organization: { findFirst: jest.fn() },
    $transaction: jest.fn((callback: (client: unknown) => unknown) => callback({
      employee: { create: employeeCreate },
      employeeIdentityDocument: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    })),
  };
  const service = new EmployeesService(
    prisma as never,
    { hasAllEmployeeData: jest.fn().mockReturnValue(true), getAccessibleOrganizationIds: jest.fn() } as never,
    { create: jest.fn() } as never,
    { enabled: false } as never,
  );
  return { service, employeeCreate };
}

describe('EmployeesService importEmployees', () => {
  it('creates a partial employee from only an employee-number column', async () => {
    const { service, employeeCreate } = createService();
    const buffer = await createXlsx(['工号'], [['IMPORT-001']]);

    const result = await service.importEmployees(user, {
      originalname: 'employees.xlsx',
      buffer,
    }, { userId: user.id });

    expect(result).toMatchObject({ created: 1, updated: 0, failed: 0 });
    expect(result.rows).toEqual([{ rowNumber: 2, employeeNo: 'IMPORT-001', action: 'CREATED', errors: [] }]);
    expect(employeeCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ employeeNo: 'IMPORT-001', name: null, mobile: null }),
    }));
  });

  it('accepts a BOM and whitespace in the employee-number header', async () => {
    const { service } = createService();
    const buffer = await createXlsx(['﻿ 工号 '], [['IMPORT-HEADER-001']]);

    const result = await service.importEmployees(user, {
      originalname: 'employees.xlsx',
      buffer,
    }, { userId: user.id });

    expect(result).toMatchObject({ created: 1, failed: 0 });
  });

  it('normalizes Chinese enum labels and slash-separated dates before update validation', async () => {
    const { service } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] } as never);
    const update = jest.spyOn(service, 'update').mockResolvedValue({} as never);
    const buffer = await createXlsx(
      ['工号', '性别', '出生日期', '民族', '婚姻状况', '政治面貌'],
      [['EXISTING-002', '男', '2005/05/28', '汉族', '未婚', '共青团员']],
    );

    await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(update).toHaveBeenCalledWith(user, 'existing-employee', expect.objectContaining({
      gender: 'MALE',
      birthDate: '2005-05-28',
      ethnicity: 'HAN',
      maritalStatus: 'UNMARRIED',
      politicalStatus: 'CYL_MEMBER',
    }), { userId: user.id });
  });

  it('completes an existing partial master with its first employment record', async () => {
    const { service } = createService({ id: 'partial-employee' });
    const complete = jest.spyOn(service as unknown as {
      completeImportedEmployment: () => Promise<string[]>;
    }, 'completeImportedEmployment').mockResolvedValue([]);
    const buffer = await createXlsx(
      ['工号', '部门', '入职日期', '雇佣关系', '用工形式', '人员状态'],
      [['PARTIAL-001', '虚构部门', '2026/08/13', '实习生', '实习生', '正式']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(complete).toHaveBeenCalledWith(
      user,
      'partial-employee',
      expect.objectContaining({ employeeNo: 'PARTIAL-001', organizationName: '虚构部门' }),
      expect.objectContaining({ employmentRelationship: 'INTERN', workArrangement: 'INTERN' }),
      { userId: user.id },
    );
  });

  it('returns a row error when a partial master has incomplete employment fields', async () => {
    const { service } = createService({ id: 'partial-employee' });
    const buffer = await createXlsx(['工号', '部门'], [['PARTIAL-002', '虚构部门']]);

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 0, failed: 1 });
    expect(result.rows[0]?.errors[0]).toContain('补齐任职信息时必须同时提供');
  });

  it('requires actual Chinese business headers instead of guessing external field names', async () => {
    const { service, employeeCreate } = createService();
    const buffer = await createXlsx(['JobNumber', 'EmployeeName'], [['IMPORT-EXTERNAL-001', '虚构导入员工']]);

    await expect(service.importEmployees(user, {
      originalname: 'employees.xlsx',
      buffer,
    }, { userId: user.id })).rejects.toThrow('导入文件必须包含“工号”列');
    expect(employeeCreate).not.toHaveBeenCalled();
  });

  it('accepts only the complete known active-employee export profile', async () => {
    const { service, employeeCreate } = createService();
    const headers = KNOWN_ACTIVE_EMPLOYEE_EXPORT_PROFILE.map(([header]) => header);
    const row = headers.map(() => '');
    row[0] = 'IMPORT-KNOWN-EXPORT-001';
    row[1] = '虚构已知导出员工';
    const buffer = await createXlsx(headers, [row]);

    const result = await service.importEmployees(user, {
      originalname: '全部在职.xlsx',
      buffer,
    }, { userId: user.id });

    expect(result).toMatchObject({ created: 1, failed: 0 });
    expect(employeeCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ employeeNo: 'IMPORT-KNOWN-EXPORT-001', name: '虚构已知导出员工' }),
    }));
  });

  it('updates only present fields for an existing employee', async () => {
    const { service, employeeCreate } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] } as never);
    const update = jest.spyOn(service, 'update').mockResolvedValue({} as never);
    const buffer = await createXlsx(['工号', '姓名'], [['EXISTING-001', '更新姓名']]);

    const result = await service.importEmployees(user, {
      originalname: 'employees.xlsx',
      buffer,
    }, { userId: user.id });

    expect(result).toMatchObject({ created: 0, updated: 1, failed: 0 });
    expect(update).toHaveBeenCalledWith(user, 'existing-employee', { name: '更新姓名' }, { userId: user.id });
    expect(employeeCreate).not.toHaveBeenCalled();
  });

  it('returns a per-row error when the employee number is absent', async () => {
    const { service, employeeCreate } = createService();
    const buffer = await createXlsx(['工号', '姓名'], [['', '虚构员工']]);

    const result = await service.importEmployees(user, {
      originalname: 'employees.xlsx',
      buffer,
    }, { userId: user.id });

    expect(result).toMatchObject({ created: 0, failed: 1 });
    expect(result.rows[0]).toEqual(expect.objectContaining({ action: 'FAILED', errors: ['工号不能为空'] }));
    expect(employeeCreate).not.toHaveBeenCalled();
  });
});
