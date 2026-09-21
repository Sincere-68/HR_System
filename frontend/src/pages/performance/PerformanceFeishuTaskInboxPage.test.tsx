import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformanceFeishuTaskInboxPage } from './PerformanceFeishuTaskInboxPage';

const exchangeFeishuTaskSession = vi.fn();
let inboxData: Record<string, unknown> | undefined;

vi.mock('../../features/performance/api', () => ({
  performanceApi: { exchangeFeishuTaskSession: (...args: unknown[]) => exchangeFeishuTaskSession(...args) },
  useFeishuTaskInbox: () => ({ isLoading: false, isError: false, data: inboxData }),
  useSubmitFeishuAssessmentTask: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useSubmitFeishuWorkflowTask: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

function renderPage(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path="/performance/feishu-task-inbox" element={<PerformanceFeishuTaskInboxPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe('PerformanceFeishuTaskInboxPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    inboxData = undefined;
    exchangeFeishuTaskSession.mockReset();
  });
  afterEach(cleanup);

  it('exchanges the OAuth code and stores a dedicated session token', async () => {
    exchangeFeishuTaskSession.mockResolvedValue({ accessToken: 'feishu-session-token', expiresIn: 600, inbox: { assessmentTasks: [], workflowTasks: [] } });
    renderPage('/performance/feishu-task-inbox?state=opaque-state&code=authorization-code');

    await waitFor(() => expect(exchangeFeishuTaskSession).toHaveBeenCalledWith('opaque-state', 'authorization-code'));
    await waitFor(() => expect(sessionStorage.getItem('hr_demo_feishu_task_token')).toBe('feishu-session-token'));
  });

  it('does not exchange identity without both state and code', () => {
    renderPage('/performance/feishu-task-inbox?state=opaque-state');

    expect(exchangeFeishuTaskSession).not.toHaveBeenCalled();
    expect(screen.getByText('正在等待飞书身份授权，请从飞书个人提醒卡片进入')).toBeInTheDocument();
  });

  it('shows frozen score and actual amount on workflow items and their action modal', async () => {
    sessionStorage.setItem('hr_demo_feishu_task_token', 'session-token');
    inboxData = {
      cycleName: '测试活动', employeeName: '执行人', employeeNo: 'E100', totalPending: 1, assessmentTasks: [],
      workflowTasks: [{
        id: 'workflow-1', cycleId: 'cycle-1', cycleName: '测试活动', instanceId: 'instance-1', employeeId: 'employee-1', employeeName: '被考核人', employeeNo: 'E001', stepId: 'review', stepName: '审核', stepType: 'REVIEW', stepOrder: 0, attemptNo: 1, status: 'IN_PROGRESS', executorName: '执行人', finalScore: 88.5, actualAmount: 1770, assignees: [], isCurrent: true, canSubmit: true, completedAt: null,
      }],
    };
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderPage('/performance/feishu-task-inbox');

    expect(screen.getByText(/最终得分：88\.5000/)).toBeInTheDocument();
    expect(screen.getByText(/实际金额：1770\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '处理' }));
    expect(screen.getByText('最终得分：88.5000')).toBeInTheDocument();
    expect(screen.getByText('实际金额：1770.00')).toBeInTheDocument();
  });
});
