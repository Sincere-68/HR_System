import { presentPersonnelResigned } from './personnel-resigned.presenter';

const row = {
  id: 'termination-1',
  plannedLastWorkingDate: new Date('2026-09-30T00:00:00.000Z'),
  actualLastWorkingDate: new Date('2026-09-28T00:00:00.000Z'),
  reason: '虚构离职原因',
  employee: {
    employeeNo: 'FAKE-001',
    name: '虚构员工',
    gender: 'FEMALE',
    mobile: '13900001001',
    identityDocuments: [
      { documentNumber: 'SECONDARY-DOCUMENT', isPrimary: false },
      { documentNumber: 'PRIMARY-DOCUMENT', isPrimary: true },
    ],
  },
  employmentPeriod: {
    entryDate: new Date('2020-01-01T00:00:00.000Z'),
    assignments: [{
      organization: { name: '离职前部门' },
      position: { name: '离职前职位' },
    }],
    agreements: [{ employingCompany: { name: '虚构全日制公司' } }],
  },
};

describe('presentPersonnelResigned', () => {
  it('maps the personnel-page field order from confirmed historical sources', () => {
    expect(presentPersonnelResigned(row)).toEqual({
      id: 'termination-1',
      employeeNo: 'FAKE-001',
      name: '虚构员工',
      departmentName: '离职前部门',
      gender: 'FEMALE',
      entryDate: '2020-01-01',
      previousPositionName: '离职前职位',
      terminationReason: '虚构离职原因',
      movementType: null,
      lastWorkingDate: '2026-09-28',
      lastWorkingDateBasis: 'ACTUAL',
      fullTimeCompany: '虚构全日制公司',
      documentNumber: 'PRIMARY-DOCUMENT',
      mobile: '13900001001',
    });
  });

  it('uses planned date and stable first active document when no primary document exists', () => {
    const result = presentPersonnelResigned({
      ...row,
      actualLastWorkingDate: null,
      employee: {
        ...row.employee,
        identityDocuments: [{ documentNumber: 'FIRST-DOCUMENT', isPrimary: false }],
      },
      employmentPeriod: null,
    });

    expect(result).toEqual(expect.objectContaining({
      departmentName: null,
      entryDate: null,
      previousPositionName: null,
      lastWorkingDate: '2026-09-30',
      lastWorkingDateBasis: 'PLANNED',
      fullTimeCompany: null,
      documentNumber: 'FIRST-DOCUMENT',
      movementType: null,
    }));
  });
});
