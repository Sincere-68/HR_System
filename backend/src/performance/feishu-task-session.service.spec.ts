import { UnauthorizedException } from '@nestjs/common';
import { FeishuTaskSessionService } from './feishu-task-session.service';

function config(values: Record<string, unknown>) {
  return { get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback) };
}

describe('FeishuTaskSessionService', () => {
  it('creates an opaque state and never stores the raw value', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'session-1' });
    const service = new FeishuTaskSessionService(
      { performanceFeishuTaskSession: { create } } as never,
      { enabled: true } as never,
      {} as never,
      config({ FEISHU_OAUTH_REDIRECT_URI: 'https://hr.example.invalid/performance/feishu-task-inbox', FEISHU_TASK_INBOX_URL: 'https://hr.example.invalid/performance/feishu-task-inbox' }) as never,
    );

    const state = await service.createState('employee-1', 'cycle-1');

    expect(state).toBeTruthy();
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ employeeId: 'employee-1', cycleId: 'cycle-1', stateHash: expect.not.stringMatching(state!) }) });
  });

  it('exchanges a code for an employee-only session without requiring a User', async () => {
    const session = { id: 'session-1', employeeId: 'employee-1', cycleId: 'cycle-1', employee: { workEmail: 'employee@example.invalid', mobile: null } };
    const prisma = {
      performanceFeishuTaskSession: {
        findFirst: jest.fn().mockResolvedValue(session),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const feishu = { enabled: true, exchangeAuthorizationCode: jest.fn().mockResolvedValue({ openId: 'ou_employee' }), resolveOpenIdByContact: jest.fn().mockResolvedValue('ou_employee') };
    const jwt = { signAsync: jest.fn().mockResolvedValue('short-session-token') };
    const service = new FeishuTaskSessionService(prisma as never, feishu as never, jwt as never, config({ FEISHU_OAUTH_REDIRECT_URI: 'https://hr.example.invalid/performance/feishu-task-inbox', FEISHU_TASK_INBOX_URL: 'https://hr.example.invalid/performance/feishu-task-inbox' }) as never);
    const inbox = { cycleId: 'cycle-1', cycleName: '测试活动', employeeId: 'employee-1', employeeName: '测试人员', employeeNo: 'T001', assessmentTasks: [], workflowTasks: [], totalPending: 0 };

    await expect(service.exchange('state', 'code', jest.fn().mockResolvedValue(inbox))).resolves.toEqual({ accessToken: 'short-session-token', expiresIn: 600, inbox });
    expect(jwt.signAsync).toHaveBeenCalledWith({ kind: 'FEISHU_TASK', employeeId: 'employee-1', cycleId: 'cycle-1' }, { expiresIn: 600 });
  });

  it('rejects a forwarded state when the authorized Feishu account differs', async () => {
    const service = new FeishuTaskSessionService(
      { performanceFeishuTaskSession: { findFirst: jest.fn().mockResolvedValue({ id: 'session-1', employeeId: 'employee-1', cycleId: 'cycle-1', employee: { workEmail: 'employee@example.invalid', mobile: null } }) } } as never,
      { enabled: true, exchangeAuthorizationCode: jest.fn().mockResolvedValue({ openId: 'ou_other' }), resolveOpenIdByContact: jest.fn().mockResolvedValue('ou_expected') } as never,
      {} as never,
      config({ FEISHU_OAUTH_REDIRECT_URI: 'https://hr.example.invalid/performance/feishu-task-inbox', FEISHU_TASK_INBOX_URL: 'https://hr.example.invalid/performance/feishu-task-inbox' }) as never,
    );

    await expect(service.exchange('state', 'code', jest.fn())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired or replayed state before exchanging the code', async () => {
    const exchangeAuthorizationCode = jest.fn();
    const service = new FeishuTaskSessionService(
      { performanceFeishuTaskSession: { findFirst: jest.fn().mockResolvedValue(null) } } as never,
      { enabled: true, exchangeAuthorizationCode } as never,
      {} as never,
      config({ FEISHU_OAUTH_REDIRECT_URI: 'https://hr.example.invalid/performance/feishu-task-inbox', FEISHU_TASK_INBOX_URL: 'https://hr.example.invalid/performance/feishu-task-inbox' }) as never,
    );

    await expect(service.exchange('used-state', 'code', jest.fn())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
  });
});
