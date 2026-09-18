import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EmployeeDetailPage } from './EmployeeDetailPage';

const employee = {
  id: 'employee-1',
  employeeNo: 'E001',
  name: '虚构员工',
  organizationId: 'org-1',
  organizationName: '人力资源部',
  employmentStatus: 'REGULAR' as const,
  entryDate: '2026-01-01',
  positionName: null,
  gender: null,
  personnelPosition: null,
  jobLevel: null,
  employeeLevel: null,
  workplaceName: null,
  workEmail: null,
  personalEmail: null,
  mobile: null,
  personnelCategory: null,
  personnelSource: null,
  fullTimeCompany: null,
  employmentRelationship: null,
  workArrangement: null,
  managerName: null,
  managerEmail: null,
  totalWorkYears: null,
  totalServiceYears: null,
  documentType: null,
  documentNumber: null,
  documentExpiryDate: null,
  birthDate: null,
  age: null,
  ethnicity: null,
  maritalStatus: null,
  politicalStatus: null,
  nativePlaceRegionName: null,
  householdType: null,
  householdRegionName: null,
  residentialRegionName: null,
  emergencyContactName: null,
  emergencyContactRelationship: null,
  emergencyContactMobile: null,
  bankName: null,
  bankBranchName: null,
  bankAccountNumber: null,
  graduationSchoolName: null,
  institutionType: null,
  highestEducation: null,
  graduationDate: null,
  major: null,
  assignmentId: null,
  positionId: null,
  agreementEmployingCompanyId: null,
  primaryDocumentId: null,
  emergencyContactId: null,
  highestEducationId: null,
  nationality: null,
  workStartDate: null,
  birthdayPreference: null,
  lunarBirthDate: null,
  fullTimeDutyDescription: null,
  partTimePositionName: null,
  partTimeHourlyRate: null,
  hasCompanyEquity: false,
  assignmentStartDate: null,
  confirmationDate: null,
  trialPostEndDate: null,
  movementTypeId: null,
  movementTypeName: null,
  changeReason: null,
  changeDescription: null,
  managerEmployeeId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  currentPerformanceActivity: {
    cycleId: 'cycle-1',
    cycleName: '2026 年度绩效活动',
    currentStepName: '直属经理评估',
    currentStepKind: 'ASSESSMENT' as const,
    currentExecutorName: '虚构经理',
    status: 'IN_PROGRESS' as const,
  },
};

vi.mock('../../features/auth/auth-context', () => ({
  useAuth: () => ({ user: { permissions: [] } }),
}));
vi.mock('../../features/employees/api', () => ({
  useEmployee: () => ({ data: employee, isLoading: false, isError: false, refetch: vi.fn() }),
}));

describe('EmployeeDetailPage', () => {
  afterEach(cleanup);

  it('shows the employee current performance activity and current flow step', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/personnel/employees/employee-1']}>
          <Routes><Route path="/personnel/employees/:id" element={<EmployeeDetailPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('当前绩效进度')).toBeInTheDocument();
    expect(screen.getByText('2026 年度绩效活动')).toHaveAttribute('href', '/performance/activities/cycle-1');
    expect(screen.getByText('直属经理评估')).toBeInTheDocument();
    expect(screen.getByText('虚构经理')).toBeInTheDocument();
  });
});
