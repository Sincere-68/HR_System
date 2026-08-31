import { AssignmentStatus, EmploymentStatus } from '@prisma/client';
import { presentEmploymentRecord } from './employment-record.presenter';

const row = {
  id: 'assignment-1',
  employeeId: 'employee-1',
  employmentPeriodId: 'period-1',
  startDate: new Date('2026-08-01T00:00:00.000Z'),
  endDate: null,
  status: AssignmentStatus.ACTIVE,
  isPrimary: true,
  employmentPeriod: {
    entryDate: new Date('2026-07-15T00:00:00.000Z'),
    employmentRecords: [{
      status: EmploymentStatus.REGULAR,
      effectiveAt: new Date('2026-07-15T00:00:00.000Z'),
      endedAt: null,
    }],
  },
  employee: {
    employeeNo: 'F-001',
    name: '虚构员工',
    employmentRecords: [{ status: EmploymentStatus.REGULAR }],
    convertedCandidates: [{ resumeAttachmentId: 'attachment-1' }],
  },
  organization: { name: '虚构部门' },
  position: { name: '虚构岗位' },
};

describe('presentEmploymentRecord', () => {
  it('maps explicit assignment data, placeholders, and an authorized availability marker', () => {
    expect(presentEmploymentRecord(row, {
      isLatestPrimaryRecord: true,
      canViewEmployeeDetail: true,
    })).toEqual({
      id: 'assignment-1',
      employeeId: 'employee-1',
      employeeNo: 'F-001',
      employeeName: '虚构员工',
      entryDate: '2026-07-15',
      departmentName: '虚构部门',
      positionName: '虚构岗位',
      positionStartDate: '2026-08-01',
      positionEndDate: null,
      personnelLocator: null,
      personnelStatus: EmploymentStatus.REGULAR,
      assignmentStatus: AssignmentStatus.ACTIVE,
      approvalStatus: null,
      isLatestPrimaryRecord: true,
      interviewEvaluation: null,
      availability: 'AVAILABLE',
      canViewEmployeeDetail: true,
    });
  });

  it('keeps resume availability independent from detail access', () => {
    expect(presentEmploymentRecord(row, {
      isLatestPrimaryRecord: false,
      canViewEmployeeDetail: false,
    })).toEqual(expect.objectContaining({
      availability: 'AVAILABLE',
      isLatestPrimaryRecord: false,
      canViewEmployeeDetail: false,
    }));
  });
});
