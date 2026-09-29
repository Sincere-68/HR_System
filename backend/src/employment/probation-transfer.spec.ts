import ExcelJS from 'exceljs';
import { AuditAction, ProcessStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { EmploymentService } from './employment.service';

const user = {
  id: 'user-1',
  username: 'hr-admin',
  displayName: '虚构管理员',
  role: 'ADMIN' as const,
  roleName: '系统管理员',
  permissions: ['employee.read', 'employee.update'] as never,
  organizationIds: ['org-a'],
};

async function workbookBuffer(headers: string[], row: unknown[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('导出数据');
  worksheet.addRow(headers);
  worksheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function createImportService() {
  const findFirst = jest.fn().mockResolvedValue({
    employeeId: 'employee-1',
    employmentPeriodId: 'period-1',
    employee: { name: '虚构员工' },
    organization: { name: '虚构部门' },
    position: { name: '虚构职位' },
  });
  const findMany = jest.fn().mockResolvedValue([]);
  const create = jest.fn().mockResolvedValue({ id: 'probation-1' });
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const tx = {
    probationRecord: { findMany, create, updateMany },
  };
  const prisma = {
    employeeAssignment: { findFirst },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const access = {
    hasAllEmployeeData: jest.fn(() => false),
    getAccessibleOrganizationIds: jest.fn().mockResolvedValue(['org-a']),
  };
  const audit = { create: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new EmploymentService(
      prisma as never,
      access as never,
      { enabled: false } as never,
      audit as never,
    ),
    prisma,
    audit,
    create,
    findMany,
    updateMany,
  };
}

describe('EmploymentService probation transfer', () => {
  it('imports the confirmed Beisen export headers into a draft probation record', async () => {
    const { service, create, audit } = createImportService();
    const buffer = await workbookBuffer(
      ['JobNumber', 'parent_Name', 'OIdDepartment', 'OIdJobPosition', 'ProbationStartDate', 'ProbationStopDate'],
      ['F-001', '虚构员工', '虚构部门', '虚构职位', '2026-08-01', '2026-11-01'],
    );

    await expect(service.importProbation(user, {
      originalname: '即将试用到期.xlsx',
      buffer,
    }, { userId: user.id })).resolves.toEqual(expect.objectContaining({
      created: 1,
      updated: 0,
      failed: 0,
      rows: [expect.objectContaining({ employeeNo: 'F-001', action: 'CREATED' })],
    }));

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 'employee-1',
        employmentPeriodId: 'period-1',
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        plannedEndDate: new Date('2026-11-01T00:00:00.000Z'),
        status: ProcessStatus.DRAFT,
      }),
      select: { id: true },
    });
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      AuditAction.CREATE,
      'probation-1',
      expect.objectContaining({ action: 'import-create' }),
      expect.anything(),
      'probation_record',
    );
  });

  it('rejects a row when a supplied Beisen department does not match the effective assignment', async () => {
    const { service, create } = createImportService();
    const buffer = await workbookBuffer(
      ['JobNumber', 'parent_Name', 'OIdDepartment', 'OIdJobPosition', 'ProbationStartDate', 'ProbationStopDate'],
      ['F-001', '虚构员工', '错误部门', '虚构职位', '2026-08-01', '2026-11-01'],
    );

    const result = await service.importProbation(user, {
      originalname: '即将试用到期.xlsx',
      buffer,
    }, { userId: user.id });

    expect(result).toEqual(expect.objectContaining({
      created: 0,
      failed: 1,
      rows: [expect.objectContaining({
        action: 'FAILED',
        errors: [expect.stringContaining('部门“错误部门”')],
      })],
    }));
    expect(create).not.toHaveBeenCalled();
  });

  it('exports selected rows with business headers and display status labels', async () => {
    const service = new EmploymentService(
      {} as never,
      {} as never,
      { enabled: false } as never,
    );
    jest.spyOn(service, 'findProbation').mockResolvedValue({
      data: [{
        id: 'probation-1',
        employeeId: 'employee-1',
        employeeNo: 'F-001',
        employeeName: '虚构员工',
        organizationName: null,
        departmentName: '虚构部门',
        positionName: '虚构职位',
        jobTitleName: null,
        startDate: '2026-08-01',
        plannedEndDate: '2026-11-01',
        probationMonths: 3,
        actualEndDate: null,
        evaluationType: null,
        evaluationName: null,
        result: null,
        evaluation: null,
        evaluationApprovalStatus: null,
        approvalStatus: null,
        currentApproverName: null,
        confirmedDate: null,
        extensionCount: 0,
        status: ProcessStatus.DRAFT,
        daysUntilPlannedEnd: 45,
        canViewEmployeeDetail: true,
        canManage: true,
        canRemindApproval: false,
        canTransferApproval: false,
      }],
      meta: { page: 1, pageSize: 10_000, total: 1, totalPages: 1 },
    });

    const result = await service.exportProbation(user, {
      format: 'CSV',
      fields: ['employeeNo', 'status', 'plannedEndDate'],
      probationIds: ['probation-1'],
      query: { view: 'all' },
    } as never);

    expect(result.filename).toMatch(/^试用管理导出_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(result.buffer.toString('utf8')).toContain('"工号","试用状态","预计试用结束日期"');
    expect(result.buffer.toString('utf8')).toContain('"F-001","待发起","2026-11-01"');
  });

  it('produces CSV and XLSX templates with the supported import headers', async () => {
    const service = new EmploymentService({} as never, {} as never, { enabled: false } as never);

    const csv = await service.getProbationImportTemplate('CSV');
    const xlsx = await service.getProbationImportTemplate('XLSX');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    expect(csv).toEqual(expect.objectContaining({
      filename: '试用管理导入模板.csv',
      contentType: 'text/csv; charset=utf-8',
    }));
    expect(csv.buffer.toString('utf8')).toContain('"工号"');
    expect(csv.buffer.toString('utf8')).toContain('"预计试用结束日期"');
    expect(xlsx).toEqual(expect.objectContaining({
      filename: '试用管理导入模板.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));
    expect(workbook.worksheets[0]?.getRow(1).values).toEqual(expect.arrayContaining([
      '工号',
      '试用开始日期',
      '预计试用结束日期',
    ]));
  });

  it('rejects a missing file or an unsupported import extension before reading employee data', async () => {
    const { service, prisma } = createImportService();

    await expect(service.importProbation(user, undefined, { userId: user.id }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.importProbation(user, {
      originalname: '试用记录.txt',
      buffer: Buffer.from('not a spreadsheet'),
    }, { userId: user.id })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.employeeAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('returns a readable validation error for a corrupt XLSX upload', async () => {
    const { service, prisma } = createImportService();

    await expect(service.importProbation(user, {
      originalname: '损坏的试用记录.xlsx',
      buffer: Buffer.from('not a valid xlsx archive'),
    }, { userId: user.id })).rejects.toMatchObject({
      message: '无法读取 XLSX 文件，请确认文件未损坏或受密码保护',
    });

    expect(prisma.employeeAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('reports duplicate employee numbers within one import and does not persist the duplicate row', async () => {
    const { service, create } = createImportService();
    const csv = [
      '工号,试用开始日期,预计试用结束日期',
      'F-001,2026-08-01,2026-11-01',
      'F-001,2026-08-01,2026-11-01',
    ].join('\r\n');

    const result = await service.importProbation(user, {
      originalname: '试用记录.csv',
      buffer: Buffer.from(csv, 'utf8'),
    }, { userId: user.id });

    expect(result).toEqual(expect.objectContaining({
      created: 1,
      failed: 1,
      rows: [
        expect.objectContaining({ rowNumber: 2, employeeNo: 'F-001', action: 'CREATED' }),
        expect.objectContaining({
          rowNumber: 3,
          employeeNo: 'F-001',
          action: 'FAILED',
          errors: ['导入文件中的工号重复'],
        }),
      ],
    }));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('updates a matching editable probation record and counts a planned-end-date extension', async () => {
    const { service, findMany, updateMany, audit, create } = createImportService();
    findMany.mockResolvedValue([{
      id: 'probation-existing-1',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      plannedEndDate: new Date('2026-10-31T00:00:00.000Z'),
      status: ProcessStatus.IN_PROGRESS,
    }]);
    const csv = [
      '工号,试用开始日期,预计试用结束日期,试用期(月)',
      'F-001,2026-08-01,2026-11-30,4',
    ].join('\r\n');

    await expect(service.importProbation(user, {
      originalname: '试用记录.csv',
      buffer: Buffer.from(csv, 'utf8'),
    }, { userId: user.id })).resolves.toEqual(expect.objectContaining({
      created: 0,
      updated: 1,
      failed: 0,
      rows: [expect.objectContaining({ action: 'UPDATED' })],
    }));

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'probation-existing-1',
        status: { in: [ProcessStatus.DRAFT, ProcessStatus.IN_PROGRESS] },
        archivedAt: null,
      },
      data: {
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        plannedEndDate: new Date('2026-11-30T00:00:00.000Z'),
        probationMonths: 4,
        extensionCount: { increment: 1 },
      },
    });
    expect(create).not.toHaveBeenCalled();
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id }),
      AuditAction.UPDATE,
      'probation-existing-1',
      expect.objectContaining({ action: 'import-update', probationMonths: 4 }),
      expect.anything(),
      'probation_record',
    );
  });

  it('rejects selected export rows that are no longer inside the filtered result set', async () => {
    const service = new EmploymentService({} as never, {} as never, { enabled: false } as never);
    jest.spyOn(service, 'findProbation').mockResolvedValue({
      data: [{
        id: 'probation-1',
        employeeId: 'employee-1',
        employeeNo: 'F-001',
        employeeName: '虚构员工',
        organizationName: null,
        departmentName: null,
        positionName: null,
        jobTitleName: null,
        startDate: '2026-08-01',
        plannedEndDate: '2026-11-01',
        probationMonths: 3,
        actualEndDate: null,
        evaluationType: null,
        evaluationName: null,
        result: null,
        evaluation: null,
        evaluationApprovalStatus: null,
        approvalStatus: null,
        currentApproverName: null,
        confirmedDate: null,
        extensionCount: 0,
        status: ProcessStatus.DRAFT,
        daysUntilPlannedEnd: 45,
        canViewEmployeeDetail: true,
        canManage: true,
        canRemindApproval: false,
        canTransferApproval: false,
      }],
      meta: { page: 1, pageSize: 10_000, total: 1, totalPages: 1 },
    });

    await expect(service.exportProbation(user, {
      format: 'CSV',
      fields: ['employeeNo'],
      probationIds: ['probation-1', 'probation-stale'],
      query: { view: 'all' },
    } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.findProbation).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ page: 1, pageSize: 2 }),
      ['probation-1', 'probation-stale'],
    );
  });

  it('rejects an unselected export that exceeds the supported row limit', async () => {
    const service = new EmploymentService({} as never, {} as never, { enabled: false } as never);
    jest.spyOn(service, 'findProbation').mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 10_000, total: 10_001, totalPages: 2 },
    });

    await expect(service.exportProbation(user, {
      format: 'CSV',
      fields: ['employeeNo'],
      query: { view: 'all' },
    } as never)).rejects.toMatchObject({
      message: '当前筛选结果超过 10000 条，请缩小筛选范围后再导出',
    });
  });
});
