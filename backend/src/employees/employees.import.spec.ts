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

function createService(
  existingEmployee: { id: string; assignments?: unknown[] } | null = null,
  options: { organization?: { id: string; code: string; name: string } | null } = {},
) {
  const employeeCreate = jest.fn().mockResolvedValue({ id: 'created-employee' });
  const employeeUpdate = jest.fn().mockResolvedValue(undefined);
  const assignmentFindFirst = jest.fn().mockResolvedValue(
    existingEmployee?.assignments?.length
      ? {
        id: 'assignment-1', employmentPeriodId: 'period-1', organizationId: 'org-1', positionId: null,
        jobLevel: null, workplaceName: null, personnelPosition: null, employeeLevel: null,
        personnelCategory: null, personnelSource: null, employmentRelationship: 'INTERNAL_EMPLOYEE',
        workArrangement: 'CONTRACT_EMPLOYMENT', startDate: new Date('2026-01-01T00:00:00.000Z'),
      }
      : null,
  );
  const positionFindMany = jest.fn().mockResolvedValue([]);
  const tx = {
    employee: {
      create: employeeCreate,
      update: employeeUpdate,
      findMany: jest.fn().mockResolvedValue([]),
    },
    employeeAssignment: {
      findFirst: assignmentFindFirst,
      create: jest.fn().mockResolvedValue({
        id: 'assignment-created', employmentPeriodId: 'period-created', organizationId: 'org-1', positionId: null,
        jobLevel: null, workplaceName: null, personnelPosition: null, employeeLevel: null,
        personnelCategory: null, personnelSource: null, employmentRelationship: 'INTERN',
        workArrangement: 'INTERN', startDate: new Date('2026-08-13T00:00:00.000Z'),
      }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    employmentPeriod: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'period-1', entryDate: new Date('2026-01-01T00:00:00.000Z'), employmentRelationship: 'INTERNAL_EMPLOYEE',
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'period-created', entryDate: new Date('2026-08-13T00:00:00.000Z'), employmentRelationship: 'INTERN',
      }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    employmentRecord: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(undefined), update: jest.fn().mockResolvedValue(undefined) },
    employeeIdentityDocument: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
    employeeFamilyMember: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
    employeeEducationExperience: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
    employingCompany: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    employeeAgreement: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
    reportingRelationship: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
  };
  const prisma = {
    employee: {
      findUnique: jest.fn().mockResolvedValue(existingEmployee && {
        ...existingEmployee,
        assignments: existingEmployee.assignments ?? [],
      }),
      findFirst: jest.fn(),
      create: employeeCreate,
    },
    organization: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue(options.organization ? [options.organization] : []) },
    position: { findMany: positionFindMany, findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    employingCompany: { findMany: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const service = new EmployeesService(
    prisma as never,
    {
      hasAllEmployeeData: jest.fn().mockReturnValue(true),
      getAccessibleOrganizationIds: jest.fn().mockResolvedValue(null),
      getEmployeeWhere: jest.fn().mockResolvedValue({}),
    } as never,
    { create: jest.fn() } as never,
    { enabled: false } as never,
  );
  return { service, prisma, tx, employeeCreate, employeeUpdate, positionFindMany };
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
    expect(result.rows).toEqual([{ rowNumber: 2, employeeNo: 'IMPORT-001', action: 'CREATED', errors: [], warnings: [] }]);
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

  it('normalizes Chinese enum labels and slash-separated dates before saving', async () => {
    const { service, employeeUpdate } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(
      ['工号', '性别', '出生日期', '民族', '婚姻状况', '政治面貌'],
      [['EXISTING-002', '男', '2005/05/28', '汉族', '未婚', '共青团员']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'existing-employee' },
      data: expect.objectContaining({
        gender: 'MALE',
        birthDate: new Date('2005-05-28T00:00:00.000Z'),
        ethnicity: 'HAN',
        maritalStatus: 'UNMARRIED',
        politicalStatus: 'CYL_MEMBER',
      }),
    }));
  });

  it('creates the first employment period from import data without using interactive creation DTO rules', async () => {
    const organization = { id: 'org-1', code: 'ORG_1', name: '虚构部门' };
    const { service, tx } = createService({ id: 'partial-employee' }, { organization });
    const buffer = await createXlsx(
      ['工号', '部门', '入职日期', '雇佣关系', '用工形式'],
      [['PARTIAL-001', '虚构部门', '2026/08/13', '实习生', '实习生']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(tx.employmentPeriod.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        employeeId: 'partial-employee',
        employmentRelationship: 'INTERN',
        employmentStatus: 'REGULAR',
      }),
    }));
    expect(tx.employeeAssignment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        employeeId: 'partial-employee', organizationId: 'org-1', workArrangement: 'INTERN', isPrimary: true,
      }),
    }));
  });

  it('preserves a partial master row and only warns about incomplete employment values', async () => {
    const organization = { id: 'org-1', code: 'ORG_1', name: '虚构部门' };
    const { service, employeeUpdate } = createService({ id: 'partial-employee' }, { organization });
    const buffer = await createXlsx(['工号', '姓名', '部门'], [['PARTIAL-002', '更新姓名', '虚构部门']]);

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: '更新姓名' }),
    }));
    expect(result.rows[0]?.warnings).toContain('任职信息不完整，未创建任职周期和部门任职；缺少：入职日期、雇佣关系、用工形式');
    expect(result.rows[0]?.warnings).not.toContain('部门“虚构部门”不存在、不在当前范围内或已停用，未创建任职周期和部门任职');
  });

  it('warns about an unresolved complete employment without losing master data', async () => {
    const { service, employeeUpdate, tx } = createService({ id: 'partial-employee' });
    const buffer = await createXlsx(
      ['工号', '姓名', '部门', '入职日期', '雇佣关系', '用工形式'],
      [['PARTIAL-UNRESOLVED-001', '更新姓名', '不存在部门', '2026-08-13', '实习生', '实习生']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: '更新姓名' }) }));
    expect(tx.employmentPeriod.create).not.toHaveBeenCalled();
    expect(result.rows[0]?.warnings).toContain('部门“不存在部门”不存在、不在当前范围内或已停用，未创建任职周期和部门任职');
  });

  it('updates supplied current employment fields without interactive employment constraints', async () => {
    const organization = { id: 'org-1', code: 'ORG_1', name: '虚构部门' };
    const { service, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] }, { organization });
    const buffer = await createXlsx(
      ['工号', '入职日期', '人员状态'],
      [['EXISTING-EMPLOYMENT-UPDATE-001', '2026/09/01', '试用']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(tx.employmentPeriod.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'period-1' }, data: { entryDate: new Date('2026-09-01T00:00:00.000Z') },
    }));
    expect(tx.employmentRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ employeeId: 'existing-employee', status: 'PROBATION', currentFlag: true }),
    }));
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
    const { service, employeeCreate, employeeUpdate } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(['工号', '姓名'], [['EXISTING-001', '更新姓名']]);

    const result = await service.importEmployees(user, {
      originalname: 'employees.xlsx',
      buffer,
    }, { userId: user.id });

    expect(result).toMatchObject({ created: 0, updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'existing-employee' }, data: expect.objectContaining({ name: '更新姓名' }),
    }));
    expect(employeeCreate).not.toHaveBeenCalled();
  });

  it('resolves a unique position by its name when updating an existing primary assignment', async () => {
    const { service, prisma, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    prisma.position.findFirst.mockResolvedValue({ id: 'position-1' });
    const buffer = await createXlsx(['工号', '职位'], [['EXISTING-POSITION-001', '运营经理']]);

    const result = await service.importEmployees(user, {
      originalname: 'employees.xlsx',
      buffer,
    }, { userId: user.id });

    expect(tx.employeeAssignment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'assignment-1' }, data: expect.objectContaining({ positionId: 'position-1' }),
    }));
    expect(result.rows[0]).toEqual(expect.objectContaining({ action: 'UPDATED', warnings: [] }));
  });

  it('warns about deprecated position-number input but persists other values', async () => {
    const { service, employeeUpdate } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(['工号', '姓名', '职位'], [['EXISTING-POSITION-002', '更新姓名', '00001 - 财务总监']]);

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: '更新姓名' }) }));
    expect(result.rows[0]?.warnings).toContain('职位“00001 - 财务总监”包含已废止的职位编号，请仅填写职位名称');
  });

  it('warns when the position catalog is uninitialized without blocking other fields', async () => {
    const { service, employeeUpdate } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(['工号', '姓名', '职位'], [['EXISTING-POSITION-003', '更新姓名', '运营经理']]);

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result.rows[0]?.warnings).toContain('职位目录未初始化，请先执行安全职位名称目录同步脚本');
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: '更新姓名' }) }));
  });

  it('writes workplace text directly when updating an existing primary assignment', async () => {
    const { service, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(['工号', '工作地点'], [['EXISTING-WORKPLACE-001', '上海园区']]);

    const result = await service.importEmployees(user, {
      originalname: 'employees.xlsx',
      buffer,
    }, { userId: user.id });

    expect(tx.employeeAssignment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'assignment-1' }, data: expect.objectContaining({ workplaceName: '上海园区' }),
    }));
    expect(result.rows[0]).toEqual(expect.objectContaining({ action: 'UPDATED', warnings: [] }));
  });

  it('writes imported total work years, native place, household, and a complete emergency contact', async () => {
    const { service, employeeUpdate, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(
      ['工号', '累计工龄（年）', '籍贯详细说明', '户籍详细地址', '紧急联系人', '与本人关系', '紧急联系人电话'],
      [['EXISTING-RELATED-001', '8.25', '上海市浦东新区', '上海市浦东新区虚构路1号', '虚构联系人', '配偶', '13900001001']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        importedWorkYears: expect.objectContaining({}),
        nativePlace: '上海市浦东新区',
        householdAddress: '上海市浦东新区虚构路1号',
      }),
    }));
    expect(tx.employeeFamilyMember.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: '虚构联系人', relationship: '配偶', mobile: '13900001001' }),
    }));
    expect(result.rows[0]?.warnings).toEqual([]);
  });

  it('writes workplace text while importing confirmed bank and education fields', async () => {
    const { service, employeeUpdate, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(
      ['工号', '工作地点', '银行', '毕业学校名称', '院校类型', '最高学历', '毕业时间', '专业'],
      [['EXISTING-WARNING-001', '未知园区', '中国工商银行', '虚构大学', '985', '本科', '2024-06-30', '虚构专业']],
    );

    const result = await service.importEmployees(user, {
      originalname: 'employees.xlsx',
      buffer,
    }, { userId: user.id });

    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bankName: 'ICBC' }),
    }));
    expect(tx.employeeAssignment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workplaceName: '未知园区' }),
    }));
    expect(tx.employeeEducationExperience.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolName: '虚构大学', institutionType: 'RANK_985', educationLevel: 'BACHELOR', major: '虚构专业',
      }),
    }));
    expect(result.rows[0]?.warnings).toEqual([]);
  });

  it('warns about duplicate documents without losing valid master fields', async () => {
    const { service, employeeUpdate, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    tx.employeeIdentityDocument.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'other-document' });
    const buffer = await createXlsx(
      ['工号', '姓名', '证件类型', '证件号码'],
      [['EXISTING-DUPLICATE-DOCUMENT-001', '更新姓名', '身份证', '110101199901015001']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: '更新姓名' }) }));
    expect(tx.employeeIdentityDocument.create).not.toHaveBeenCalled();
    expect(result.rows[0]?.warnings).toContain('证件类型和号码“110101199901015001”已被其他人员使用，未导入证件');
  });

  it('warns about incomplete independent records without losing valid master fields', async () => {
    const { service, employeeUpdate, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(
      ['工号', '姓名', '证件类型', '紧急联系人', '毕业学校名称'],
      [['EXISTING-PARTIAL-001', '更新姓名', '身份证', '虚构联系人', '虚构大学']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: '更新姓名' }) }));
    expect(tx.employeeIdentityDocument.create).not.toHaveBeenCalled();
    expect(tx.employeeFamilyMember.create).not.toHaveBeenCalled();
    expect(tx.employeeEducationExperience.create).not.toHaveBeenCalled();
    expect(result.rows[0]?.warnings).toEqual(expect.arrayContaining([
      '证件类型和证件号码必须同时提供，未导入证件',
      '紧急联系人缺少姓名、与本人关系或电话，未创建独立联系人记录',
      '教育信息缺少毕业学校名称或最高学历，未创建独立教育经历',
    ]));
  });

  it('keeps valid fields when company or manager cannot be safely matched', async () => {
    const { service, employeeUpdate } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(
      ['工号', '姓名', '全日制公司', '直线经理'],
      [['EXISTING-RELATION-001', '更新姓名', 'UNKNOWN_COMPANY', '不存在经理']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: '更新姓名' }) }));
    expect(result.rows[0]?.warnings).toEqual(expect.arrayContaining([
      '全日制公司“UNKNOWN_COMPANY”不存在，未导入',
      '直线经理“不存在经理”不存在，未导入',
    ]));
  });

  it('creates a new employee and complete imported employment without interactive-only data', async () => {
    const organization = { id: 'org-1', code: 'ORG_1', name: '虚构部门' };
    const { service, tx } = createService(null, { organization });
    const buffer = await createXlsx(
      ['工号', '姓名', '部门', '入职日期', '雇佣关系', '用工形式'],
      [['IMPORT-WITH-EMPLOYMENT', '虚构导入员工', '虚构部门', '2026-08-13', '实习生', '实习生']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ created: 1, failed: 0 });
    expect(tx.employmentPeriod.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ employmentRelationship: 'INTERN', employmentStatus: 'REGULAR' }),
    }));
    expect(tx.employeeAssignment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org-1', workArrangement: 'INTERN' }),
    }));
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
