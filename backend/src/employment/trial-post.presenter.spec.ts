import { ProcessStatus } from '@prisma/client';
import { presentTrialPost } from './trial-post.presenter';

const row = {
  id: 'trial-1',
  employeeId: 'employee-1',
  startDate: new Date('2026-08-01T00:00:00.000Z'),
  endDate: new Date('2026-08-31T00:00:00.000Z'),
  result: '通过',
  status: ProcessStatus.COMPLETED,
  employee: { employeeNo: 'F-001', name: '虚构员工' },
  targetPosition: { organization: { id: 'org-a', name: '虚构部门' } },
};

describe('presentTrialPost', () => {
  it('maps explicit trial-post fields and keeps unsupported columns null', () => {
    expect(presentTrialPost(row, {
      canDisplayOrganization: () => true,
      canViewEmployeeDetail: true,
    })).toEqual({
      id: 'trial-1',
      employeeId: 'employee-1',
      employeeNo: 'F-001',
      employeeName: '虚构员工',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      movementTypeName: null,
      departmentName: '虚构部门',
      jobTitleName: null,
      result: '通过',
      status: ProcessStatus.COMPLETED,
      canViewEmployeeDetail: true,
    });
  });

  it('keeps result visible while protecting an out-of-scope organization', () => {
    const result = presentTrialPost(row, {
      canDisplayOrganization: () => false,
      canViewEmployeeDetail: false,
    });

    expect(result.result).toBe('通过');
    expect(result.departmentName).toBeNull();
    expect(result.canViewEmployeeDetail).toBe(false);
    expect(JSON.stringify(result)).not.toContain('虚构部门');
  });
});
