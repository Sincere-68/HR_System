import { AssignmentStatus } from '@prisma/client';
import { presentPartTime } from './part-time.presenter';

const row = {
  id: 'assignment-part-time-1',
  employeeId: 'employee-1',
  startDate: new Date('2026-08-01T00:00:00.000Z'),
  endDate: new Date('2026-12-31T00:00:00.000Z'),
  status: AssignmentStatus.ACTIVE,
  employee: { employeeNo: 'F-001', name: '虚构兼职员工' },
  organization: { name: '虚构兼职部门' },
  jobTitle: { name: '虚构兼职职务' },
};

describe('presentPartTime', () => {
  it('maps assignment fields and leaves unsupported business fields null', () => {
    expect(presentPartTime(row, true)).toEqual({
      id: 'assignment-part-time-1',
      employeeId: 'employee-1',
      employeeName: '虚构兼职员工',
      employeeNo: 'F-001',
      partTimeType: null,
      startDate: '2026-08-01',
      institutionName: null,
      departmentName: '虚构兼职部门',
      managerName: null,
      jobTitleName: '虚构兼职职务',
      endDate: '2026-12-31',
      assignmentStatus: AssignmentStatus.ACTIVE,
      approvalStatus: null,
      canViewEmployeeDetail: true,
    });
  });

  it('maps a denied detail permission without changing list fields', () => {
    expect(presentPartTime(row, false)).toEqual(expect.objectContaining({
      employeeId: 'employee-1',
      canViewEmployeeDetail: false,
    }));
  });
});
