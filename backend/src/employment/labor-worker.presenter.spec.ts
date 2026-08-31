import { presentLaborWorker } from './labor-worker.presenter';

describe('presentLaborWorker', () => {
  const row = {
    id: 'period-1',
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
      workplace: { name: '虚构工作地点' },
      workArrangement: 'LABOR_EMPLOYMENT' as const,
    }],
  };

  it('maps Employee.workEmail and explicit assignment fields when authorized', () => {
    expect(presentLaborWorker(row, {
      managerName: '虚构经理',
      canViewEmployeeDetail: true,
    })).toEqual({
      id: 'period-1',
      employeeId: 'employee-1',
      employeeName: '虚构劳务人员',
      workEmail: 'fictional.labor@example.invalid',
      employeeNo: 'L-001',
      entryDate: '2026-08-01',
      departmentName: '虚构部门',
      jobTitleName: '虚构职务',
      workArrangement: 'LABOR_EMPLOYMENT',
      managerName: '虚构经理',
      workplaceName: '虚构工作地点',
      canViewEmployeeDetail: true,
    });
  });

  it('returns Employee.workEmail independently from detail access', () => {
    expect(presentLaborWorker(row, {
      managerName: null,
      canViewEmployeeDetail: false,
    })).toEqual(expect.objectContaining({
      workEmail: 'fictional.labor@example.invalid',
      canViewEmployeeDetail: false,
    }));
  });
});
