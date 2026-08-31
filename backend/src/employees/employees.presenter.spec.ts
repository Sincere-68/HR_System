import { EmploymentStatus } from '@prisma/client';
import { presentEmployeeDetail, presentEmployeeListItem, type EmployeeListSnapshot } from './employees.presenter';

const now = new Date('2026-08-25T00:00:00.000Z');

function employee(): EmployeeListSnapshot {
  return {
    id: 'employee-1',
    employeeNo: 'FAKE-1001',
    name: '虚构员工甲',
    mobile: '13900001001',
    idCardNo: '110101200001011001',
    organizationId: 'org-1',
    organization: { id: 'legacy-org', name: '兼容部门' },
    employmentRecords: [{ status: EmploymentStatus.REGULAR }],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    gender: 'FEMALE',
    workEmail: 'fictional@example.invalid',
    personalEmail: 'private@example.invalid',
    birthDate: new Date('2000-08-26T00:00:00.000Z'),
    ethnicity: 'HAN',
    maritalStatus: 'UNMARRIED',
    politicalStatus: null,
    nativePlace: '虚构籍贯',
    householdAddress: '虚构户籍地址',
    residentialAddress: '虚构联系地址',
    employmentPeriods: [{
      personnelCategory: 'NON_TALENT_PROGRAM',
      personnelSource: 'SOCIAL_RECRUITMENT',
      employmentRelationship: 'INTERNAL_EMPLOYEE',
      entryDate: new Date('2025-08-25T00:00:00.000Z'),
      actualExitDate: null,
      agreements: [{ employingCompany: { id: 'company-1', code: 'COMPANY_001', name: '虚构全日制公司' } }],
    }],
    assignments: [{
      organization: { id: 'org-1', name: '产品研发部' },
      status: 'ACTIVE',
      position: { id: 'position-1', name: '软件工程师' },
      jobLevel: 'S1',
      workplace: { id: 'workplace-1', name: '虚构园区' },
      personnelPosition: 'FRONT_OFFICE',
      employeeLevel: 'STAFF',
      personnelCategory: 'NON_TALENT_PROGRAM',
      personnelSource: 'SOCIAL_RECRUITMENT',
      employmentRelationship: 'INTERNAL_EMPLOYEE',
      workArrangement: 'CONTRACT_EMPLOYMENT',
      isPrimary: true,
      startDate: new Date('2025-08-25T00:00:00.000Z'),
      endDate: null,
    }],
    reportingAsEmployee: [{
      manager: { name: '虚构经理甲', workEmail: 'manager@example.invalid' },
      isPrimary: true,
      startDate: new Date('2025-08-25T00:00:00.000Z'),
      endDate: null,
    }],
    identityDocuments: [{
      documentType: 'NATIONAL_ID',
      documentNumber: '110101200001011001',
      expiryDate: new Date('2030-01-01T00:00:00.000Z'),
      isPrimary: true,
    }],
    familyMembers: [{
      name: '虚构联系人甲',
      relationship: '家属',
      mobile: '13900002002',
      isEmergencyContact: true,
    }],
    educationExperiences: [{
      schoolName: '虚构大学',
      educationLevel: 'BACHELOR',
      institutionType: 'RANK_985',
      major: '虚构专业',
      graduationDate: new Date('2022-06-30T00:00:00.000Z'),
      isHighestEducation: true,
    }],
    workExperiences: [{
      startDate: new Date('2022-08-25T00:00:00.000Z'),
      endDate: new Date('2024-08-25T00:00:00.000Z'),
    }],
    convertedCandidates: [{ source: 'SOCIAL_RECRUITMENT' }],
  };
}

describe('presentEmployeeListItem', () => {
  it('assembles current personnel relations and calculated values', () => {
    const result = presentEmployeeListItem(employee(), now);

    expect(result).toMatchObject({
      organizationName: '产品研发部',
      entryDate: '2025-08-25',
      positionName: '软件工程师',
      personnelPosition: 'FRONT_OFFICE',
      jobLevel: 'S1',
      employeeLevel: 'STAFF',
      workEmail: 'fictional@example.invalid',
      personalEmail: 'private@example.invalid',
      managerName: '虚构经理甲',
      managerEmail: 'manager@example.invalid',
      fullTimeCompany: '虚构全日制公司',
      documentType: 'NATIONAL_ID',
      graduationSchoolName: '虚构大学',
      highestEducation: 'BACHELOR',
      age: 25,
      totalWorkYears: 2,
      totalServiceYears: 1,
    });
  });

  it('returns employee fields in full for HR users', () => {
    const result = presentEmployeeListItem(employee(), now);

    expect(result.mobile).toBe('13900001001');
    expect(result.documentNumber).toBe('110101200001011001');
    expect(result.workEmail).toBe('fictional@example.invalid');
    expect(result.personalEmail).toBe('private@example.invalid');
    expect(result.householdAddress).toBe('虚构户籍地址');
    expect(result.residentialAddress).toBe('虚构联系地址');
    expect(result.emergencyContactMobile).toBe('13900002002');
    expect(result.managerEmail).toBe('manager@example.invalid');
  });

  it('includes current assignment relation identifiers in the detail snapshot', () => {
    const result = presentEmployeeDetail(employee(), now);

    expect(result).toMatchObject({
      positionId: 'position-1',
      jobLevel: 'S1',
      workplaceId: 'workplace-1',
      agreementEmployingCompanyId: 'company-1',
    });
  });
});
