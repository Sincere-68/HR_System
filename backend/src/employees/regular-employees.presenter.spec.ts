import { presentRegularEmployee, type RegularEmployeeSnapshot } from './regular-employees.presenter';

function employee(overrides: Partial<RegularEmployeeSnapshot> = {}): RegularEmployeeSnapshot {
  return {
    id: 'employee-1',
    name: '虚构正式员工',
    employeeNo: 'FAKE-REGULAR-001',
    gender: 'FEMALE',
    workEmail: 'regular.employee@example.invalid',
    bankName: 'ICBC',
    bankAccountNumber: '6222000000000000001',
    bankBranchName: '虚构支行',
    employmentPeriods: [{
      entryDate: new Date('2026-01-02T00:00:00.000Z'),
      assignments: [{
        organization: { name: '产品研发部' },
        position: { name: '软件工程师' },
        jobLevel: 'S2',
        workArrangement: 'CONTRACT_EMPLOYMENT',
      }],
      agreements: [{ employingCompany: { name: '虚构全日制公司' } }],
    }],
    reportingAsEmployee: [{ manager: { name: '虚构行政经理' } }],
    ...overrides,
  };
}

describe('presentRegularEmployee', () => {
  it('maps only confirmed formal-personnel sources and null placeholders', () => {
    expect(presentRegularEmployee(employee(), true)).toEqual({
      employeeId: 'employee-1',
      canViewEmployeeDetail: true,
      name: '虚构正式员工',
      employeeNo: 'FAKE-REGULAR-001',
      entryDate: '2026-01-02',
      departmentName: '产品研发部',
      positionName: '软件工程师',
      jobLevel: 'S2',
      gender: 'FEMALE',
      workEmail: 'regular.employee@example.invalid',
      workArrangement: 'CONTRACT_EMPLOYMENT',
      managerName: '虚构行政经理',
      resumeInfo: null,
      interviewEvaluation: null,
      bankName: 'ICBC',
      bankAccountNumber: '6222000000000000001',
      bankBranchName: '虚构支行',
      fullTimeCompany: '虚构全日制公司',
    });
  });

  it('keeps optional position, manager, company, and bank sources null', () => {
    const result = presentRegularEmployee(employee({
      bankName: null,
      bankAccountNumber: null,
      bankBranchName: null,
      reportingAsEmployee: [],
      employmentPeriods: [{
        entryDate: new Date('2026-01-02T00:00:00.000Z'),
        assignments: [{
          organization: { name: '产品研发部' },
          position: null,
          jobLevel: null,
          workArrangement: 'CONTRACT_EMPLOYMENT',
        }],
        agreements: [{ employingCompany: null }],
      }],
    }), false);

    expect(result).toEqual(expect.objectContaining({
      canViewEmployeeDetail: false,
      positionName: null,
      jobLevel: null,
      managerName: null,
      fullTimeCompany: null,
      bankName: null,
      bankAccountNumber: null,
      bankBranchName: null,
      resumeInfo: null,
      interviewEvaluation: null,
    }));
  });
});
