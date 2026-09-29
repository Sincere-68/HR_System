import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerformanceTasksPage } from './PerformanceTasksPage';

vi.mock('../../features/performance/api', () => ({
  usePerformanceTasks: () => ({ isLoading: false, isError: false, data: { data: [] } }),
  usePerformanceWorkflowTasks: () => ({
    isLoading: false,
    isError: false,
    data: {
      data: [{
        id: 'workflow-1',
        cycleId: 'cycle-1',
        cycleName: '测试活动',
        instanceId: 'instance-1',
        employeeId: 'employee-1',
        employeeName: '测试员工',
        employeeNo: 'E001',
        stepId: 'review',
        stepName: 'HR 审核',
        stepType: 'REVIEW',
        stepOrder: 0,
        attemptNo: 1,
        status: 'IN_PROGRESS',
        executorName: '审核人',
        finalScore: 88.5,
        actualAmount: 1770,
        assignees: [],
        isCurrent: true,
        canSubmit: false,
        completedAt: null,
      }],
    },
  }),
}));

describe('PerformanceTasksPage', () => {
  afterEach(cleanup);

  it('shows final score and actual amount for workflow tasks', async () => {
    const user = userEvent.setup();
    render(<PerformanceTasksPage />);

    await user.click(screen.getByText('后续流程'));

    expect(screen.getByRole('columnheader', { name: '最终得分' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '实际金额' })).toBeInTheDocument();
    expect(screen.getByText('88.5000')).toBeInTheDocument();
    expect(screen.getByText('1770.00')).toBeInTheDocument();
  });
});
