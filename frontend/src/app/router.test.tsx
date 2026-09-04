import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { placeholderHeadingTabs, placeholderRoutes } from '../config/navigation';
import { AppRouter } from './router';

vi.mock('../features/auth/protected-route', () => ({
  ProtectedRoute: () => <Outlet />,
}));

vi.mock('../features/auth/administrator-route', () => ({
  AdministratorRoute: () => <Outlet />,
}));

vi.mock('../layouts/AppLayout', () => ({
  AppLayout: () => <Outlet />,
}));

vi.mock('../pages/SystemSelectionPage', () => ({
  SystemSelectionPage: () => <h1>选择要进入的系统</h1>,
}));

vi.mock('../layouts/PerformanceLayout', () => ({
  PerformanceLayout: () => <Outlet />,
}));

vi.mock('../pages/performance/PerformanceDashboardPage', () => ({
  PerformanceDashboardPage: () => <h1>绩效系统</h1>,
}));

vi.mock('../pages/PlaceholderPage', () => ({
  PlaceholderPage: ({
    title,
    pendingFields,
    headingTabs,
  }: {
    title: string;
    pendingFields?: boolean;
    headingTabs?: string[];
  }) => (
    <div
      data-testid="placeholder-page"
      data-pending-fields={pendingFields ? 'true' : 'false'}
      data-heading-tabs={headingTabs?.join('|')}
    >
      {title}
    </div>
  ),
}));

vi.mock('../pages/analytics/EmployeeRosterPage', () => ({
  EmployeeRosterPage: () => <h1>员工名册</h1>,
}));

vi.mock('../pages/contracts/ContractsPage', () => ({
  ContractsPage: () => <h1>合同协议</h1>,
}));

vi.mock('../pages/staffing/TransferTypesPage', () => ({
  TransferTypesPage: () => <><h1>调动类型</h1><span>显示顺序</span></>,
}));

vi.mock('../pages/onboarding/OffersPage', () => ({
  OffersPage: () => <><h1>Offer管理</h1><span>个人邮箱</span></>,
}));

vi.mock('../pages/onboarding/InternOfferFormPage', () => ({
  InternOfferFormPage: () => <><h1>新建实习Offer</h1><span>候选人信息</span></>,
}));

vi.mock('../pages/onboarding/OfferCreationPage', () => ({
  OfferCreationPage: () => <><h1>Offer创建</h1><span>实习生转正</span></>,
}));

vi.mock('../pages/onboarding/EntriesPage', () => ({
  EntriesPage: () => <><h1>入职管理</h1><span>计划入职日期</span></>,
}));

vi.mock('../pages/onboarding/IntegrationPage', () => ({
  IntegrationPage: () => <><h1>新员工融入</h1><span>融入进度</span></>,
}));

vi.mock('../pages/onboarding/IntroductionPage', () => ({
  IntroductionPage: () => <><h1>新员工入职介绍</h1><span>入职介绍信息状态</span></>,
}));

vi.mock('../pages/onboarding/IdCardReaderPage', () => ({
  IdCardReaderPage: () => <><h1>读取身份证</h1><span>证件号码</span></>,
}));

vi.mock('../pages/subsets/EducationPage', () => ({
  EducationPage: () => <h1>教育经历</h1>,
}));

vi.mock('../pages/subsets/WorkHistoryPage', () => ({
  WorkHistoryPage: () => <h1>工作履历</h1>,
}));

vi.mock('../pages/subsets/FamilyPage', () => ({
  FamilyPage: () => <h1>家庭成员</h1>,
}));

vi.mock('../pages/subsets/AppraisalsPage', () => ({
  AppraisalsPage: () => <h1>考核结果</h1>,
}));

vi.mock('../pages/subsets/TrainingPage', () => ({
  TrainingPage: () => <h1>培训经历</h1>,
}));

vi.mock('../pages/subsets/AwardsPage', () => ({
  AwardsPage: () => <h1>表彰与奖励</h1>,
}));

vi.mock('../pages/subsets/CertificatesPage', () => ({
  CertificatesPage: () => <h1>证书执照</h1>,
}));

vi.mock('../pages/subsets/ProjectsPage', () => ({
  ProjectsPage: () => <h1>项目经历</h1>,
}));

vi.mock('../pages/subsets/SkillsPage', () => ({
  SkillsPage: () => <h1>专业技能</h1>,
}));

vi.mock('../pages/subsets/LanguagesPage', () => ({
  LanguagesPage: () => <h1>语言能力</h1>,
}));

const implementedOnboardingRoutes = [
  { path: '/onboarding/offers', title: 'Offer管理', feature: '个人邮箱' },
  { path: '/onboarding/offers/new', title: '新建实习Offer', feature: '候选人信息' },
  { path: '/onboarding/offers/templates', title: 'Offer创建', feature: '实习生转正' },
  { path: '/onboarding/entries', title: '入职管理', feature: '计划入职日期' },
  { path: '/onboarding/integration', title: '新员工融入', feature: '融入进度' },
  { path: '/onboarding/introduction', title: '新员工入职介绍', feature: '入职介绍信息状态' },
  { path: '/onboarding/id-card-reader', title: '读取身份证', feature: '证件号码' },
] as const;

const implementedSubsetRoutes = [
  { path: '/subsets/education', title: '教育经历' },
  { path: '/subsets/work-history', title: '工作履历' },
  { path: '/subsets/family', title: '家庭成员' },
  { path: '/subsets/appraisals', title: '考核结果' },
  { path: '/subsets/training', title: '培训经历' },
  { path: '/subsets/awards', title: '表彰与奖励' },
  { path: '/subsets/certificates', title: '证书执照' },
  { path: '/subsets/projects', title: '项目经历' },
  { path: '/subsets/skills', title: '专业技能' },
  { path: '/subsets/languages', title: '语言能力' },
] as const;

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

describe('AppRouter onboarding integration', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(implementedOnboardingRoutes)('renders $path with its implemented page', ({ path, title, feature }) => {
    renderRoute(path);

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText(feature)).toBeInTheDocument();
    expect(screen.queryByTestId('placeholder-page')).not.toBeInTheDocument();
  });

  it('keeps implemented onboarding paths out of placeholderRoutes', () => {
    const placeholderPaths = new Set(placeholderRoutes.map((route) => route.key));

    for (const route of implementedOnboardingRoutes) {
      expect(placeholderPaths.has(route.path)).toBe(false);
    }
    expect(placeholderPaths.has('/contracts')).toBe(false);
  });

  it('renders the employee roster page instead of a placeholder', () => {
    renderRoute('/analytics/roster');

    expect(screen.getByRole('heading', { name: '员工名册' })).toBeInTheDocument();
    expect(screen.queryByTestId('placeholder-page')).not.toBeInTheDocument();
  });

  it('keeps the other analytics pages as placeholders', () => {
    for (const path of ['/analytics/dashboard', '/analytics/structure', '/analytics/mobility', '/analytics/contracts', '/analytics/reports']) {
      cleanup();
      renderRoute(path);
      expect(screen.getByTestId('placeholder-page')).toBeInTheDocument();
    }
  });

  it('renders the implemented contracts page instead of a placeholder', () => {
    renderRoute('/contracts');

    expect(screen.getByRole('heading', { name: '合同协议' })).toBeInTheDocument();
    expect(screen.queryByTestId('placeholder-page')).not.toBeInTheDocument();
  });

  it('renders the implemented transfer-types page instead of a placeholder', () => {
    renderRoute('/staffing/transfer-types');

    expect(screen.getByRole('heading', { name: '调动类型' })).toBeInTheDocument();
    expect(screen.getByText('显示顺序')).toBeInTheDocument();
    expect(screen.queryByTestId('placeholder-page')).not.toBeInTheDocument();
    expect(placeholderRoutes.map((route) => route.key)).not.toContain('/staffing/transfer-types');
  });

  it('marks reporting relationships as a pending-field placeholder', () => {
    renderRoute('/employment/reporting-lines?view=1&page=3&pageSize=50');

    expect(screen.getByTestId('placeholder-page')).toHaveTextContent('汇报关系');
    expect(screen.getByTestId('placeholder-page')).toHaveAttribute('data-pending-fields', 'true');
  });
});

describe('AppRouter system entry', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders system selection at the default route', () => {
    renderRoute('/');

    expect(screen.getByRole('heading', { name: '选择要进入的系统' })).toBeInTheDocument();
  });

  it('renders the performance system entry separately from personnel management', () => {
    renderRoute('/performance');

    expect(screen.getByRole('heading', { name: '绩效系统' })).toBeInTheDocument();
  });
});

describe('AppRouter employee-subset integration', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(implementedSubsetRoutes)('renders $path with its implemented page', ({ path, title }) => {
    renderRoute(path);

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.queryByTestId('placeholder-page')).not.toBeInTheDocument();
  });

  it('keeps implemented subset paths out of placeholderRoutes and materials in them', () => {
    const placeholderPaths = new Set(placeholderRoutes.map((route) => route.key));

    for (const route of implementedSubsetRoutes) {
      expect(placeholderPaths.has(route.path)).toBe(false);
    }
    expect(placeholderPaths.has('/subsets/materials')).toBe(true);
  });

  it('keeps materials as a placeholder with its unchanged heading tabs', () => {
    renderRoute('/subsets/materials?view=2');

    expect(screen.getByTestId('placeholder-page')).toHaveTextContent('材料管理');
    expect(screen.getByTestId('placeholder-page')).toHaveAttribute(
      'data-heading-tabs',
      '按人员查看|按分类查看|全部材料',
    );
    expect(placeholderHeadingTabs['/subsets/materials']).toEqual(['按人员查看', '按分类查看', '全部材料']);
  });
});
