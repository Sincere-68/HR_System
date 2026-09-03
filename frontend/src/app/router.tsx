import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../features/auth/protected-route';
import { AppLayout } from '../layouts/AppLayout';
import { PerformanceLayout } from '../layouts/PerformanceLayout';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { SystemSelectionPage } from '../pages/SystemSelectionPage';
import { PerformanceAmountBasePage } from '../pages/performance/PerformanceAmountBasePage';
import { PerformanceDashboardPage } from '../pages/performance/PerformanceDashboardPage';
import { PerformanceMyTasksPage } from '../pages/performance/PerformanceMyTasksPage';
import { PerformanceResultsPage } from '../pages/performance/PerformanceResultsPage';
import { PerformanceTasksPage } from '../pages/performance/PerformanceTasksPage';
import { PerformanceTemplatesPage } from '../pages/performance/PerformanceTemplatesPage';
import { PerformanceTemplateEditorPage } from '../pages/performance/PerformanceTemplateEditorPage';
import { BlacklistPage } from '../pages/blacklist/BlacklistPage';
import { BlacklistRemovalPage } from '../pages/blacklist/BlacklistRemovalPage';
import { EmployeeDetailPage } from '../pages/employees/EmployeeDetailPage';
import { EmployeeFormPage } from '../pages/employees/EmployeeFormPage';
import { EmployeeInfoApprovalPage } from '../pages/employees/EmployeeInfoApprovalPage';
import { EmployeeListPage } from '../pages/employees/EmployeeListPage';
import { EmployeeRosterPage } from '../pages/analytics/EmployeeRosterPage';
import { ContractsPage } from '../pages/contracts/ContractsPage';
import { EmployeeChangeManagementPage } from '../pages/employment/EmployeeChangeManagementPage';
import { EmploymentRecordsPage } from '../pages/employment/EmploymentRecordsPage';
import { InternManagementPage } from '../pages/employment/InternManagementPage';
import { LaborWorkerManagementPage } from '../pages/employment/LaborWorkerManagementPage';
import { PartTimeManagementPage } from '../pages/employment/PartTimeManagementPage';
import { ProbationPage } from '../pages/employment/ProbationPage';
import { RetirementManagementPage } from '../pages/employment/RetirementManagementPage';
import { TrialPostManagementPage } from '../pages/employment/TrialPostManagementPage';
import { TerminationManagementPage } from '../pages/employment/TerminationManagementPage';
import { EntriesPage } from '../pages/onboarding/EntriesPage';
import { IdCardReaderPage } from '../pages/onboarding/IdCardReaderPage';
import { IntegrationPage } from '../pages/onboarding/IntegrationPage';
import { IntroductionPage } from '../pages/onboarding/IntroductionPage';
import { OffersPage } from '../pages/onboarding/OffersPage';
import { InternOfferFormPage } from '../pages/onboarding/InternOfferFormPage';
import { OfferCreationPage } from '../pages/onboarding/OfferCreationPage';
import { HandoverPage } from '../pages/HandoverPage';
import { AppraisalsPage } from '../pages/subsets/AppraisalsPage';
import { AwardsPage } from '../pages/subsets/AwardsPage';
import { CertificatesPage } from '../pages/subsets/CertificatesPage';
import { EducationPage } from '../pages/subsets/EducationPage';
import { FamilyPage } from '../pages/subsets/FamilyPage';
import { LanguagesPage } from '../pages/subsets/LanguagesPage';
import { ProjectsPage } from '../pages/subsets/ProjectsPage';
import { SkillsPage } from '../pages/subsets/SkillsPage';
import { TrainingPage } from '../pages/subsets/TrainingPage';
import { WorkHistoryPage } from '../pages/subsets/WorkHistoryPage';
import { TransferTypesPage } from '../pages/staffing/TransferTypesPage';
import { placeholderHeadingTabs, placeholderRoutes } from '../config/navigation';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route index element={<SystemSelectionPage />} />
        <Route path="performance" element={<PerformanceLayout />}>
          <Route index element={<PerformanceDashboardPage />} />
          <Route path="templates" element={<PerformanceTemplatesPage />} />
          <Route path="templates/new" element={<PerformanceTemplateEditorPage />} />
          <Route path="templates/:templateId" element={<PerformanceTemplateEditorPage />} />
          <Route path="tasks" element={<PerformanceTasksPage />} />
          <Route path="my-tasks" element={<PerformanceMyTasksPage />} />
          <Route path="results" element={<PerformanceResultsPage />} />
          <Route path="settings/amount-base" element={<PerformanceAmountBasePage />} />
        </Route>
        <Route element={<AppLayout />}>
          <Route path="personnel/employees" element={<EmployeeListPage />} />
          <Route
            path="personnel/employees/new"
            element={(
              <>
                <EmployeeListPage />
                <EmployeeFormPage />
              </>
            )}
          />
          <Route path="personnel/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="personnel/employees/:id/edit" element={<EmployeeFormPage />} />
          <Route path="personnel/blacklist" element={<BlacklistPage />} />
          <Route path="personnel/blacklist-removals" element={<BlacklistRemovalPage />} />
          <Route path="personnel/approval" element={<EmployeeInfoApprovalPage />} />
          <Route path="analytics/roster" element={<EmployeeRosterPage />} />
          <Route path="contracts" element={<ContractsPage />} />
          <Route path="employment/probation" element={<ProbationPage />} />
          <Route path="employment/changes" element={<EmployeeChangeManagementPage />} />
          <Route path="employment/trial-post" element={<TrialPostManagementPage />} />
          <Route path="employment/interns" element={<InternManagementPage />} />
          <Route path="employment/labor" element={<LaborWorkerManagementPage />} />
          <Route path="employment/part-time" element={<PartTimeManagementPage />} />
          <Route path="employment/records" element={<EmploymentRecordsPage />} />
          <Route path="employment/termination" element={<TerminationManagementPage />} />
          <Route path="employment/retirement" element={<RetirementManagementPage />} />
          <Route path="onboarding/offers" element={<OffersPage />} />
          <Route path="onboarding/offers/new" element={<InternOfferFormPage />} />
          <Route path="onboarding/offers/templates" element={<OfferCreationPage />} />
          <Route path="onboarding/entries" element={<EntriesPage />} />
          <Route path="onboarding/integration" element={<IntegrationPage />} />
          <Route path="onboarding/introduction" element={<IntroductionPage />} />
          <Route path="onboarding/id-card-reader" element={<IdCardReaderPage />} />
          <Route path="handover" element={<HandoverPage />} />
          <Route path="staffing/transfer-types" element={<TransferTypesPage />} />
          <Route path="subsets/education" element={<EducationPage />} />
          <Route path="subsets/work-history" element={<WorkHistoryPage />} />
          <Route path="subsets/family" element={<FamilyPage />} />
          <Route path="subsets/appraisals" element={<AppraisalsPage />} />
          <Route path="subsets/training" element={<TrainingPage />} />
          <Route path="subsets/awards" element={<AwardsPage />} />
          <Route path="subsets/certificates" element={<CertificatesPage />} />
          <Route path="subsets/projects" element={<ProjectsPage />} />
          <Route path="subsets/skills" element={<SkillsPage />} />
          <Route path="subsets/languages" element={<LanguagesPage />} />
          {placeholderRoutes.map((route) => (
            <Route
              key={route.key}
              path={route.key.slice(1)}
              element={(
                <PlaceholderPage
                  title={route.label}
                  routePath={route.key}
                  headingTabs={placeholderHeadingTabs[route.key]}
                  pendingFields={route.key === '/employment/reporting-lines'}
                />
              )}
            />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
