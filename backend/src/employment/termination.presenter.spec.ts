import { ProcessStatus } from '@prisma/client';
import { presentTermination } from './termination.presenter';

const row = {
  id: 'termination-1',
  employeeId: 'employee-1',
  plannedLastWorkingDate: new Date('2026-09-30T00:00:00.000Z'),
  actualLastWorkingDate: new Date('2026-09-28T00:00:00.000Z'),
  terminationType: '主动离职',
  reason: '虚构离职原因',
  status: ProcessStatus.IN_PROGRESS,
  employee: { employeeNo: 'F-001', name: '虚构员工' },
  handoverCase: { archivedAt: null, status: ProcessStatus.IN_PROGRESS },
  approvalRequest: {
    archivedAt: null,
    status: ProcessStatus.PENDING,
    currentStep: 2,
    steps: [
      { stepOrder: 1, approver: { displayName: '旧审批人' } },
      { stepOrder: 2, approver: { displayName: '当前审批人' } },
    ],
  },
};

describe('presentTermination', () => {
  it('uses actual last-working date and explicit related process values', () => {
    expect(presentTermination(row, {
      assignment: { organizationName: '虚构部门', positionName: '虚构岗位' },
      canViewEmployeeDetail: true,
    })).toEqual({
      id: 'termination-1',
      employeeId: 'employee-1',
      employeeNo: 'F-001',
      employeeName: '虚构员工',
      previousDepartmentName: '虚构部门',
      previousPositionName: '虚构岗位',
      lastWorkingDate: '2026-09-28',
      lastWorkingDateBasis: 'ACTUAL',
      terminationType: '主动离职',
      terminationReason: '虚构离职原因',
      approvalStatus: ProcessStatus.PENDING,
      currentApproverName: '当前审批人',
      handoverStatus: ProcessStatus.IN_PROGRESS,
      compensationAmount: null,
      canViewEmployeeDetail: true,
    });
  });

  it('labels the planned fallback and returns sourced fields', () => {
    const result = presentTermination({ ...row, actualLastWorkingDate: null }, {
      assignment: null,
      canViewEmployeeDetail: false,
    });
    expect(result.lastWorkingDate).toBe('2026-09-30');
    expect(result.lastWorkingDateBasis).toBe('PLANNED');
    expect(result.terminationReason).toBe('虚构离职原因');
    expect(result.currentApproverName).toBe('当前审批人');
    expect(result.compensationAmount).toBeNull();
    expect(result.canViewEmployeeDetail).toBe(false);
  });

  it('ignores archived approval and handover records', () => {
    const archivedAt = new Date('2026-10-01T00:00:00.000Z');
    const result = presentTermination({
      ...row,
      approvalRequest: { ...row.approvalRequest, archivedAt },
      handoverCase: { ...row.handoverCase, archivedAt },
    }, { assignment: null, canViewEmployeeDetail: false });
    expect(result.approvalStatus).toBeNull();
    expect(result.currentApproverName).toBeNull();
    expect(result.handoverStatus).toBeNull();
  });
});
