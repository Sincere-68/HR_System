import { presentPersonnelLaborWorker } from './personnel-labor-worker.presenter';

describe('presentPersonnelLaborWorker', () => {
  const row = {
    employeeId: 'employee-1',
    entryDate: new Date('2026-08-01T00:00:00.000Z'),
    employee: {
      employeeNo: 'L-001',
      name: '虚构劳务人员',
      workEmail: 'fictional.labor@example.invalid',
    },
    assignments: [{
      organization: { name: '虚构部门' },
      jobTitle: { name: '虚构职务' },
      position: { name: '虚构职位' },
      workArrangement: 'LABOR_EMPLOYMENT' as const,
    }],
  };

  it('maps only the personnel-page field order and confirmed sources', () => {
    expect(presentPersonnelLaborWorker(row, {
      managerName: '虚构直线经理',
      canViewEmployeeDetail: true,
    })).toEqual({
      name: '虚构劳务人员',
      workEmail: 'fictional.labor@example.invalid',
      employeeNo: 'L-001',
      entryDate: '2026-08-01',
      departmentName: '虚构部门',
      jobTitleName: '虚构职务',
      positionName: '虚构职位',
      workArrangement: 'LABOR_EMPLOYMENT',
      managerName: '虚构直线经理',
      employeeId: 'employee-1',
      canViewEmployeeDetail: true,
    });
  });

  it('keeps nullable relation fields null without adding workplace or company fields', () => {
    const result = presentPersonnelLaborWorker({
      ...row,
      assignments: [{
        ...row.assignments[0],
        jobTitle: null,
        position: null,
      }],
    }, {
      managerName: null,
      canViewEmployeeDetail: false,
    });

    expect(result).toEqual(expect.objectContaining({
      jobTitleName: null,
      positionName: null,
      managerName: null,
      canViewEmployeeDetail: false,
    }));
    expect(result).not.toHaveProperty('workplaceName');
    expect(result).not.toHaveProperty('fullTimeCompany');
  });
});
