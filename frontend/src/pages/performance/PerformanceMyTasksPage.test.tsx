import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerformanceMyTasksPage } from './PerformanceMyTasksPage';

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
        stepId: 'confirm',
        stepName: '本人确认',
        stepType: 'CONFIRMATION',
        stepOrder: 0,
        attemptNo: 1,
        status: 'IN_PROGRESS',
        executorName: '确认人',
        finalScore: 92,
        actualAmount: 1840,
        assignees: [],
        isCurrent: true,
        canSubmit: true,
        completedAt: null,
      }],
    },
  }),
  useSubmitPerformanceWorkflowTask: () => ({ isPending: false, variables: undefined, mutate: vi.fn() }),
}));

describe('PerformanceMyTasksPage', () => {
  afterEach(cleanup);

  it('shows final score and actual amount to the current workflow executor', async () => {
    const user = userEvent.setup();
    render(<PerformanceMyTasksPage />);

    await user.click(screen.getByText('后续流程待办'));

    expect(screen.getByRole('columnheader', { name: '最终得分' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '实际金额' })).toBeInTheDocument();
    expect(screen.getByText('92.0000')).toBeInTheDocument();
    expect(screen.getByText('1840.00')).toBeInTheDocument();
  });
});
