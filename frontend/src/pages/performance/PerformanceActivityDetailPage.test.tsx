import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PerformanceActivityDetailPage } from './PerformanceActivityDetailPage';

const workflow = {
  cycleId: 'activity-1',
  cycleName: '2026年第三季度绩效活动',
  instanceId: 'instance-1',
  employeeId: 'employee-1',
  employeeName: '测试员工',
  employeeNo: 'E0001',
  templateName: '季度考核模板',
  templateVersionNo: 1,
  steps: [{
    id: 'assessment:task-1',
    source: 'ASSESSMENT' as const,
    name: '直属经理评估',
    type: 'EVALUATION' as const,
    stepOrder: 0,
    attemptNo: 1,
    status: 'IN_PROGRESS' as const,
    role: '指定人员',
    completedAt: null,
    isQualified: null,
    assignees: [{
      id: 'assignee-1',
      employeeId: 'manager-1',
      displayName: '部门经理',
      role: '指定人员',
      status: 'IN_PROGRESS' as const,
      deliveredAt: null,
      deliveryStatus: 'FAILED' as const,
      deliveryFailureReason: '未匹配到唯一飞书个人账号',
      submittedAt: null,
      isQualified: null,
      deliveries: [{
        id: 'delivery-1',
        channel: 'FEISHU_CARD' as const,
        status: 'FAILED' as const,
        deliveredAt: null,
        failureReason: '未匹配到唯一飞书个人账号',
        createdAt: '2026-07-02T01:00:00.000Z',
      }],
    }],
  }],
};

vi.mock('../../features/performance/api', () => ({
  usePerformanceCycle: () => ({
    isLoading: false,
    isError: false,
    data: {
      id: 'activity-1',
      name: '2026年第三季度绩效活动',
      organizationId: 'organization-1',
      organizationName: '人力资源部',
      isPublic: false,
      linkedLevel: true,
      year: 2026,
      periodType: 'QUARTERLY',
      exceptionHandlerType: 'DIRECT_MANAGER',
      exceptionHandlerEmployeeId: null,
      exceptionHandlerName: null,
      exceptionHandlerEmployeeNo: null,
      lockRelation: true,
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      templateName: '季度考核模板',
      templateVersionNo: 1,
      createdByName: '管理员',
      status: 'DRAFT',
      instanceCount: 1,
      completedInstanceCount: 0,
      createdAt: '2026-07-01T00:00:00.000Z',
      instances: [{
        id: 'instance-1',
        employeeId: 'employee-1',
        employeeName: '测试员工',
        employeeNo: 'E0001',
        organizationName: '人力资源部',
        templateName: '季度考核模板',
        indicatorTemplateName: null,
        currentStepName: '直属经理评估',
        currentStepKind: 'ASSESSMENT',
        currentExecutorName: '部门经理',
        assessmentGroupName: null,
        assessmentStatus: 'IN_PROGRESS',
        assessmentCompletedAt: null,
        workflowCompletedAt: null,
        status: 'IN_PROGRESS',
        finalScore: 95.5,
        finalGrade: null,
        employmentStatus: 'REGULAR',
        finalCoefficient: 0.955,
      }],
    },
  }),
  usePerformanceParticipantWorkflow: () => ({ isLoading: false, isError: false, data: workflow }),
  usePerformanceParticipantAssessmentDetail: () => ({ isLoading: false, isError: false, data: { modules: [{ id: 'module-1', name: '直属经理评估', type: 'EVALUATION', weight: 100, status: 'IN_PROGRESS', scorerNames: ['部门经理'], moduleScore: 89.5, weightedScore: 89.5, adjustmentDirection: null, indicators: [{ id: 'indicator-1', name: '交付质量', description: '完成情况', standards: ['按时交付'], moduleName: '直属经理评估', moduleType: 'EVALUATION', scorerNames: ['部门经理'], rawScore: null, indicatorWeight: 100, weightedScore: null, scoreStatus: 'IN_PROGRESS', scoreSource: 'UNAVAILABLE' }] }], finalScore: null, finalCoefficient: null, employeeAmountBaseSnapshot: null, employeeAmountBaseVersionNo: null, calculationFormula: null, actualAmount: null, emptyReason: '考核尚未完成，暂未生成最终得分和金额。' } }),
  useAddPerformanceCycleParticipants: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useStartPerformanceCycle: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRestartPerformanceCycle: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useCloseCycleParticipants: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdatePerformanceCycleParticipantTemplate: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRemovePerformanceCycleParticipant: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useCreateCycleParticipantAmountBase: () => ({ isPending: false, mutateAsync: vi.fn() }),
  usePerformanceTemplates: () => ({ data: [{ id: 'template-1', name: '已发布模板', latestVersion: { id: 'version-1', versionNo: 1, status: 'PUBLISHED' } }] }),
}));

vi.mock('../../features/employees/api', () => ({
  useOrganizations: () => ({ data: [] }),
  useEmployees: () => ({ data: { data: [] }, isFetching: false }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/performance/activities/activity-1']}>
        <Routes>
          <Route path="/performance/activities/:activityId" element={<PerformanceActivityDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PerformanceActivityDetailPage', () => {
  afterEach(cleanup);

  it('shows every participant with the activity detail columns', () => {
    renderPage();

    expect(screen.getByText('2026年第三季度绩效活动')).toBeInTheDocument();
    expect(screen.getByText('测试员工')).toBeInTheDocument();
    expect(screen.getByText('E0001')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '当前执行人' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '最终系数' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '金额基数' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移除' })).toBeInTheDocument();
  });

  it('opens a contextual participant removal dialog', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '移除' }));

    expect(screen.getByText('确认移除当前活动人员')).toBeInTheDocument();
    expect(screen.getByText(/不影响该员工在其他活动中的记录/)).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /移\s*除/ })).toBeInTheDocument();
  });

  it('uses employee ids for participant selection actions', () => {
    renderPage();
    const row = screen.getByText('测试员工').closest('tr');
    expect(row).not.toBeNull();
    const checkbox = row?.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    fireEvent.click(checkbox as HTMLInputElement);
    expect(screen.getByRole('button', { name: '开启绩效' })).toBeInTheDocument();
  });

  it('opens the assessment detail drawer from the employee name', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '测试员工' }));
    expect(screen.getByText('考核表详情')).toBeInTheDocument();
    expect(screen.getByText('交付质量')).toBeInTheDocument();
    expect(screen.getByText('按时交付')).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers.indexOf('考核环节')).toBeLessThan(headers.indexOf('指标名称'));
    expect(screen.getByRole('columnheader', { name: '考核环得分' })).toBeInTheDocument();
    expect(screen.getByText('89.5000')).toBeInTheDocument();
    expect(screen.getByText('考核尚未完成，暂未生成最终得分和金额。')).toBeInTheDocument();
  });

  it('opens the right flow drawer from the current executor and shows real missing timestamps', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '部门经理' }));
    expect(screen.getAllByText('流程信息').length).toBeGreaterThan(0);
    expect(screen.getByText('被考核人员')).toBeInTheDocument();
    expect(screen.getAllByText('直属经理评估').length).toBeGreaterThan(0);
    expect(screen.getByText('未送达')).toBeInTheDocument();
    expect(screen.getByText('未提交')).toBeInTheDocument();
    expect(screen.getByText('未匹配到唯一飞书个人账号')).toBeInTheDocument();
  });

  it('shows the performance start action for a draft activity', () => {
    renderPage();

    expect(screen.getByRole('button', { name: '开启绩效' })).toBeInTheDocument();
  });

  it('opens the direct participant picker from the activity detail', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /添加被考核人/ }));
    expect(screen.getAllByText('添加被考核人').length).toBeGreaterThan(1);
    expect(screen.getAllByLabelText('筛选被考核人部门').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('具体被考核人').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('被考核人绩效模板').length).toBeGreaterThan(0);
  });
});
