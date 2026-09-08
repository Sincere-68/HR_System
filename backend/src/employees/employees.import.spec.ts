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
      findFirst: jest.fn().mockResolvedValue(null),
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
    const { service, employeeUpdate, tx } = createService({ id: 'partial-employee' }, { organization });
    const buffer = await createXlsx(
      ['工号', '姓名', '部门', '用工形式'],
      [['PARTIAL-002', '更新姓名', '虚构部门', '合同用工']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: '更新姓名' }),
    }));
    expect(tx.employmentPeriod.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ entryDate: null, employmentRelationship: 'INTERNAL_EMPLOYEE' }),
    }));
    expect(tx.employeeAssignment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org-1', startDate: null }),
    }));
    expect(result.rows[0]?.warnings).toEqual([]);
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

  it('stores full Chinese administrative paths for region columns', async () => {
    const { service, employeeUpdate } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(
      ['工号', '籍贯地区', '户籍所在地地区', '联系地址地区'],
      [[
        'EXISTING-REGION-NAMES-001',
        '湖北省 / 武汉市 / 洪山区',
        '北京市 / 市辖区 / 朝阳区',
        '上海市 / 市辖区 / 浦东新区',
      ]],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nativePlaceRegionName: '湖北省 / 武汉市 / 洪山区',
        householdRegionName: '北京市 / 市辖区 / 朝阳区',
        residentialRegionName: '上海市 / 市辖区 / 浦东新区',
      }),
    }));
  });

  it('warns for ambiguous or unrecognized Chinese region input without blocking text fields', async () => {
    const { service, employeeUpdate } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(
      ['工号', '姓名', '籍贯地区', '籍贯详细说明'],
      [['EXISTING-REGION-WARNING-001', '更新姓名', '洪山区', '湖北省武汉市洪山区']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: '更新姓名', nativePlace: '湖北省武汉市洪山区' }),
    }));
    expect(result.rows[0]?.warnings).toContain('籍贯地区“洪山区”不是可确认的完整中文行政区划层级，未导入该字段');
  });

  it('writes text address and native-place fields directly from their Chinese headers', async () => {
    const { service, employeeUpdate } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(
      ['工号', '籍贯详细说明', '户籍详细地址', '联系详细地址'],
      [['EXISTING-ADDRESS-TEXT-001', '湖北省武汉市洪山区', '武汉市洪山区虚构路1号', '上海市浦东新区虚构路2号']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nativePlace: '湖北省武汉市洪山区',
        householdAddress: '武汉市洪山区虚构路1号',
        residentialAddress: '上海市浦东新区虚构路2号',
      }),
    }));
  });

  it('maps legacy address headers when they accompany Chinese template headers', async () => {
    const { service, employeeUpdate } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(
      ['工号', '姓名', 'parent_RegistAddress', 'parent_Birthplace', 'parent_HomeAddress'],
      [[
        'EXISTING-ADDRESS-MIXED-001',
        '更新姓名',
        '武汉市洪山区虚构路1号',
        '湖北省武汉市洪山区',
        '上海市浦东新区虚构路2号',
      ]],
    );

    const result = await service.importEmployees(user, { originalname: '混合列.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: '更新姓名',
        householdAddress: '武汉市洪山区虚构路1号',
        nativePlace: '湖北省武汉市洪山区',
        residentialAddress: '上海市浦东新区虚构路2号',
      }),
    }));
  });

  it('maps legacy address headers to the matching text fields', async () => {
    const { service, employeeUpdate } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(
      ['工号', 'parent_RegistAddress', 'parent_Birthplace', 'parent_HomeAddress'],
      [[
        'EXISTING-ADDRESS-LEGACY-001',
        '武汉市洪山区虚构路1号',
        '湖北省武汉市洪山区',
        '上海市浦东新区虚构路2号',
      ]],
    );

    const result = await service.importEmployees(user, { originalname: '全部在职.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        householdAddress: '武汉市洪山区虚构路1号',
        nativePlace: '湖北省武汉市洪山区',
        residentialAddress: '上海市浦东新区虚构路2号',
      }),
    }));
  });

  it('creates an education record from whichever education field exists', async () => {
    const { service, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(
      ['工号', '毕业学校名称'],
      [['EXISTING-EDUCATION-MINIMUM-001', '虚构大学']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(tx.employeeEducationExperience.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolName: '虚构大学', educationLevel: null, institutionType: undefined,
        graduationDate: undefined, major: undefined,
      }),
    }));
  });

  it('preserves an existing education record when only one high-education field is supplied', async () => {
    const { service, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    tx.employeeEducationExperience.findFirst.mockResolvedValue({
      id: 'education-1', schoolName: '原学校', institutionType: 'RANK_211', educationLevel: 'BACHELOR',
      graduationDate: new Date('2024-06-30T00:00:00.000Z'), major: '原专业',
    });
    const buffer = await createXlsx(
      ['工号', '最高学历'],
      [['EXISTING-EDUCATION-PARTIAL-001', '硕士研究生']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(tx.employeeEducationExperience.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'education-1' }, data: expect.objectContaining({ educationLevel: 'MASTER', schoolName: '原学校' }),
    }));
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

  it('stores a typed document without a number or expiry date', async () => {
    const { service, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    const buffer = await createXlsx(
      ['工号', '证件类型'],
      [['EXISTING-DOCUMENT-NO-EXPIRY-001', '身份证']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(tx.employeeIdentityDocument.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        documentType: 'NATIONAL_ID', documentNumber: null, expiryDate: undefined,
      }),
    }));
  });

  it('treats placeholder document expiry dates as empty', async () => {
    const { service, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    tx.employee.findFirst.mockResolvedValue(null);
    const buffer = await createXlsx(
      ['工号', '证件类型', '证件号码', '证件截止日期'],
      [['EXISTING-DOCUMENT-PLACEHOLDER-001', '身份证', '110101199901015001', '长期有效']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(tx.employeeIdentityDocument.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ expiryDate: undefined }),
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
      ['工号', '姓名', '证件类型', '紧急联系人'],
      [['EXISTING-PARTIAL-001', '更新姓名', '身份证', '虚构联系人']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(employeeUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: '更新姓名' }) }));
    expect(tx.employeeIdentityDocument.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ documentType: 'NATIONAL_ID', documentNumber: null }),
    }));
    expect(tx.employeeFamilyMember.create).not.toHaveBeenCalled();
    expect(tx.employeeEducationExperience.create).not.toHaveBeenCalled();
    expect(result.rows[0]?.warnings).toEqual(expect.arrayContaining([
      '紧急联系人缺少与本人关系，未创建独立联系人记录',
    ]));
  });

  it('changes an existing primary manager by ending the historical relation and creating a new one', async () => {
    const { service, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    tx.employee.findMany.mockResolvedValue([{ id: 'manager-2' }]);
    tx.reportingRelationship.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'relationship-1', managerEmployeeId: 'manager-1' });
    const buffer = await createXlsx(
      ['工号', '直线经理'],
      [['EXISTING-MANAGER-001', '虚构经理']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(tx.reportingRelationship.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'relationship-1' }, data: expect.objectContaining({ status: 'INACTIVE', endDate: expect.any(Date) }),
    }));
    expect(tx.reportingRelationship.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ managerEmployeeId: 'manager-2', isPrimary: true, status: 'ACTIVE' }),
    }));
  });

  it('does not create a duplicate manager relation when the imported manager is already current', async () => {
    const { service, tx } = createService({ id: 'existing-employee', assignments: [{ id: 'assignment-1' }] });
    tx.employee.findMany.mockResolvedValue([{ id: 'manager-1' }]);
    tx.reportingRelationship.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'relationship-1', managerEmployeeId: 'manager-1' });
    const buffer = await createXlsx(
      ['工号', '直线经理'],
      [['EXISTING-MANAGER-SAME-001', '虚构经理']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ updated: 1, failed: 0 });
    expect(tx.reportingRelationship.update).not.toHaveBeenCalled();
    expect(tx.reportingRelationship.create).not.toHaveBeenCalled();
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

  it('creates a new employee with a partial dated assignment when only organization and arrangement are supplied', async () => {
    const organization = { id: 'org-1', code: 'ORG_1', name: '虚构部门' };
    const { service, tx } = createService(null, { organization });
    const buffer = await createXlsx(
      ['工号', '姓名', '部门', '用工形式'],
      [['IMPORT-PARTIAL-ASSIGNMENT-001', '虚构导入员工', '虚构部门', '合同用工']],
    );

    const result = await service.importEmployees(user, { originalname: 'employees.xlsx', buffer }, { userId: user.id });

    expect(result).toMatchObject({ created: 1, failed: 0 });
    expect(tx.employmentPeriod.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ entryDate: null, employmentRelationship: 'INTERNAL_EMPLOYEE' }),
    }));
    expect(tx.employeeAssignment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org-1', startDate: null, workArrangement: 'CONTRACT_EMPLOYMENT' }),
    }));
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
