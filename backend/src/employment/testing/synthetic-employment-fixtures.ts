export type SyntheticEmploymentRelationship = 'INTERNAL_EMPLOYEE' | 'INTERN' | 'LABOR_WORKER';
export type SyntheticEmploymentStatus = 'PROBATION' | 'REGULAR' | 'RESIGNED' | 'NON_REGULAR';
export type SyntheticAssignmentStatus = 'ACTIVE' | 'ENDED';
export type SyntheticApprovalStatus = 'PENDING' | 'APPROVED' | null;

export interface SyntheticCompany {
  id: string;
  name: string;
}

export interface SyntheticOrganization {
  id: string;
  parentId: string | null;
  name: string;
}

export interface SyntheticPosition {
  id: string;
  name: string;
}

export interface SyntheticEmployee {
  id: string;
  employeeNo: string;
  name: string;
  workEmail: null;
  mobile: null;
  managerEmployeeId: null;
}

export interface SyntheticEmploymentPeriod {
  id: string;
  employeeId: string;
  sequenceNo: number;
  entryDate: string;
  actualExitDate: string | null;
  employmentRelationship: SyntheticEmploymentRelationship;
  employmentStatus: SyntheticEmploymentStatus;
  previousPeriodId: string | null;
}

export interface SyntheticAssignment {
  id: string;
  employeeId: string;
  employmentPeriodId: string;
  organizationId: string;
  positionId: string;
  jobTitle: string;
  startDate: string;
  endDate: string | null;
  status: SyntheticAssignmentStatus;
  isPrimary: boolean;
}

export interface SyntheticReportingRelationship {
  id: string;
  employeeId: string;
  managerEmployeeId: string;
  relationshipType: 'ADMINISTRATIVE' | 'BUSINESS';
  isPrimary: boolean;
  startDate: string;
  endDate: string | null;
  status: 'ACTIVE' | 'ENDED';
}

export interface SyntheticAuthorizationScenario {
  visibleAssignmentIds: string[];
  canViewEmployeeDetail: boolean;
  canManage: boolean;
  scope: 'CURRENT_ASSIGNMENT' | 'HISTORICAL_ASSIGNMENT';
}

export interface SyntheticProbationPendingEffect {
  id: string;
  employeeId: string;
  employmentPeriodId: string;
  approvalStatus: Exclude<SyntheticApprovalStatus, null>;
  lifecycleStatus: 'PENDING_EFFECTIVE';
  approvedAt: string;
  effectiveAt: null;
  currentEmploymentStatus: 'PROBATION';
  targetEmploymentStatus: 'REGULAR';
}

export interface SyntheticUnsourcedFields {
  intern: {
    internshipOrganizationName: null;
    approvalStatus: null;
    managerName: null;
    bankName: null;
    bankAccountNumber: null;
    bankBranchName: null;
  };
  labor: {
    conversionEventId: null;
    conversionStatus: null;
    managerName: null;
  };
  partTime: {
    partTimeType: null;
    institutionName: null;
    managerName: null;
    approvalStatus: null;
  };
}

export interface SyntheticEmploymentFixtures {
  company: SyntheticCompany;
  organizations: SyntheticOrganization[];
  positions: SyntheticPosition[];
  employees: SyntheticEmployee[];
  employmentPeriods: SyntheticEmploymentPeriod[];
  assignments: SyntheticAssignment[];
  reportingRelationships: SyntheticReportingRelationship[];
  managerlessEmployeeId: string;
  authorization: {
    current: SyntheticAuthorizationScenario;
    history: SyntheticAuthorizationScenario;
  };
  probationPendingEffect: SyntheticProbationPendingEffect;
  unsourcedFields: SyntheticUnsourcedFields;
}

/**
 * Build deterministic, database-free employment data for unit and presenter tests.
 * Every call returns new arrays and objects so a test cannot mutate another test's data.
 */
export function createSyntheticEmploymentFixtures(): SyntheticEmploymentFixtures {
  const company: SyntheticCompany = {
    id: 'company-mock-yunling',
    name: '云岭数科（模拟企业）',
  };

  const organizations: SyntheticOrganization[] = [
    { id: 'org-east-r-and-d', parentId: null, name: '华东研发中心' },
    { id: 'org-product-platform', parentId: 'org-east-r-and-d', name: '产品平台部' },
    { id: 'org-customer-delivery', parentId: 'org-east-r-and-d', name: '客户交付部' },
  ];

  const positions: SyntheticPosition[] = [
    { id: 'position-backend-engineer', name: '后端工程师' },
    { id: 'position-product-manager', name: '产品经理' },
    { id: 'position-hrbp', name: 'HRBP' },
  ];

  const employees: SyntheticEmployee[] = [
    {
      id: 'employee-mock-001',
      employeeNo: 'MOCK-HR-001',
      name: '李知远',
      workEmail: null,
      mobile: null,
      managerEmployeeId: null,
    },
    {
      id: 'employee-mock-002',
      employeeNo: 'MOCK-HR-002',
      name: '周语宁',
      workEmail: null,
      mobile: null,
      managerEmployeeId: null,
    },
    {
      id: 'employee-mock-003',
      employeeNo: 'MOCK-HR-003',
      name: '陈予安',
      workEmail: null,
      mobile: null,
      managerEmployeeId: null,
    },
  ];

  const employmentPeriods: SyntheticEmploymentPeriod[] = [
    {
      id: 'period-001-first',
      employeeId: 'employee-mock-001',
      sequenceNo: 1,
      entryDate: '2023-03-01',
      actualExitDate: '2024-06-30',
      employmentRelationship: 'INTERNAL_EMPLOYEE',
      employmentStatus: 'RESIGNED',
      previousPeriodId: null,
    },
    {
      id: 'period-001-rehire',
      employeeId: 'employee-mock-001',
      sequenceNo: 2,
      entryDate: '2025-02-10',
      actualExitDate: null,
      employmentRelationship: 'INTERNAL_EMPLOYEE',
      employmentStatus: 'PROBATION',
      previousPeriodId: 'period-001-first',
    },
    {
      id: 'period-002-current',
      employeeId: 'employee-mock-002',
      sequenceNo: 1,
      entryDate: '2024-01-15',
      actualExitDate: null,
      employmentRelationship: 'INTERNAL_EMPLOYEE',
      employmentStatus: 'REGULAR',
      previousPeriodId: null,
    },
    {
      id: 'period-003-current',
      employeeId: 'employee-mock-003',
      sequenceNo: 1,
      entryDate: '2025-05-06',
      actualExitDate: null,
      employmentRelationship: 'INTERNAL_EMPLOYEE',
      employmentStatus: 'REGULAR',
      previousPeriodId: null,
    },
  ];

  const assignments: SyntheticAssignment[] = [
    {
      id: 'assignment-001-history',
      employeeId: 'employee-mock-001',
      employmentPeriodId: 'period-001-first',
      organizationId: 'org-product-platform',
      positionId: 'position-backend-engineer',
      jobTitle: '后端工程师',
      startDate: '2023-03-01',
      endDate: '2024-06-30',
      status: 'ENDED',
      isPrimary: true,
    },
    {
      id: 'assignment-001-current',
      employeeId: 'employee-mock-001',
      employmentPeriodId: 'period-001-rehire',
      organizationId: 'org-customer-delivery',
      positionId: 'position-product-manager',
      jobTitle: '产品经理',
      startDate: '2025-02-10',
      endDate: null,
      status: 'ACTIVE',
      isPrimary: true,
    },
    {
      id: 'assignment-002-current',
      employeeId: 'employee-mock-002',
      employmentPeriodId: 'period-002-current',
      organizationId: 'org-product-platform',
      positionId: 'position-hrbp',
      jobTitle: 'HRBP',
      startDate: '2024-01-15',
      endDate: null,
      status: 'ACTIVE',
      isPrimary: true,
    },
    {
      id: 'assignment-003-current',
      employeeId: 'employee-mock-003',
      employmentPeriodId: 'period-003-current',
      organizationId: 'org-east-r-and-d',
      positionId: 'position-backend-engineer',
      jobTitle: '后端工程师',
      startDate: '2025-05-06',
      endDate: null,
      status: 'ACTIVE',
      isPrimary: true,
    },
  ];

  const reportingRelationships: SyntheticReportingRelationship[] = [
    {
      id: 'reporting-001-current',
      employeeId: 'employee-mock-001',
      managerEmployeeId: 'employee-mock-002',
      relationshipType: 'ADMINISTRATIVE',
      isPrimary: true,
      startDate: '2025-02-10',
      endDate: null,
      status: 'ACTIVE',
    },
  ];

  const authorization = {
    current: {
      visibleAssignmentIds: ['assignment-001-current'],
      canViewEmployeeDetail: true,
      canManage: true,
      scope: 'CURRENT_ASSIGNMENT' as const,
    },
    history: {
      visibleAssignmentIds: ['assignment-001-history'],
      canViewEmployeeDetail: false,
      canManage: false,
      scope: 'HISTORICAL_ASSIGNMENT' as const,
    },
  };

  const probationPendingEffect: SyntheticProbationPendingEffect = {
    id: 'probation-001-pending-effect',
    employeeId: 'employee-mock-001',
    employmentPeriodId: 'period-001-rehire',
    approvalStatus: 'APPROVED',
    lifecycleStatus: 'PENDING_EFFECTIVE',
    approvedAt: '2025-05-02',
    effectiveAt: null,
    currentEmploymentStatus: 'PROBATION',
    targetEmploymentStatus: 'REGULAR',
  };

  const unsourcedFields: SyntheticUnsourcedFields = {
    intern: {
      internshipOrganizationName: null,
      approvalStatus: null,
      managerName: null,
      bankName: null,
      bankAccountNumber: null,
      bankBranchName: null,
    },
    labor: {
      conversionEventId: null,
      conversionStatus: null,
      managerName: null,
    },
    partTime: {
      partTimeType: null,
      institutionName: null,
      managerName: null,
      approvalStatus: null,
    },
  };

  return {
    company,
    organizations,
    positions,
    employees,
    employmentPeriods,
    assignments,
    reportingRelationships,
    managerlessEmployeeId: 'employee-mock-003',
    authorization,
    probationPendingEffect,
    unsourcedFields,
  };
}
