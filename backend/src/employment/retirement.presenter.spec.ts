import { Gender } from '@prisma/client';
import { presentRetirement, type RetirementSnapshot } from './retirement.presenter';

const row: RetirementSnapshot = {
  id: 'retirement-1',
  employeeId: 'employee-1',
  plannedRetirementDate: new Date('2030-08-24T00:00:00.000Z'),
  employee: {
    employeeNo: 'FAKE-001',
    name: '虚构员工',
    gender: Gender.FEMALE,
    birthDate: new Date('1970-08-26T00:00:00.000Z'),
  },
};

describe('presentRetirement', () => {
  it('calculates age on the query date and maps only the supplied planned date and assignment', () => {
    expect(presentRetirement(row, {
      assignment: { organizationName: '虚构部门', jobTitleName: '虚构职务' },
      canViewEmployeeDetail: true,
    }, new Date('2026-08-25T00:00:00.000Z'))).toEqual({
      id: 'retirement-1',
      employeeId: 'employee-1',
      employeeName: '虚构员工',
      employeeNo: 'FAKE-001',
      gender: Gender.FEMALE,
      age: 55,
      birthDate: '1970-08-26',
      plannedRetirementDate: '2030-08-24',
      departmentName: '虚构部门',
      jobTitleName: '虚构职务',
      canViewEmployeeDetail: true,
    });
  });

  it('uses the service-provided current detail permission', () => {
    expect(presentRetirement(row, {
      assignment: { organizationName: '历史部门', jobTitleName: null },
      canViewEmployeeDetail: false,
    }, new Date('2026-08-25T00:00:00.000Z'))).toEqual(expect.objectContaining({
      canViewEmployeeDetail: false,
    }));
  });

  it('returns retirement fields independently from detail access', () => {
    expect(presentRetirement(row, {
      assignment: null,
      canViewEmployeeDetail: false,
    }, new Date('2026-08-25T00:00:00.000Z'))).toEqual(expect.objectContaining({
      gender: Gender.FEMALE,
      age: 55,
      birthDate: '1970-08-26',
      plannedRetirementDate: '2030-08-24',
      departmentName: null,
      jobTitleName: null,
    }));
  });
});
