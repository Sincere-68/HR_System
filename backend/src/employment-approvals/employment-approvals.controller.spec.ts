import 'reflect-metadata';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { EmploymentApprovalsController } from './employment-approvals.controller';

const user: AuthenticatedUser = {
  id: 'user-current',
  username: 'mock-current',
  displayName: '虚构当前用户',
  role: 'VIEWER',
  roleName: '查看者',
  permissions: [],
  organizationIds: [],
};

describe('EmploymentApprovalsController', () => {
  const service = {
    findMine: jest.fn(),
    findCurrent: jest.fn(),
    findDetail: jest.fn(),
    approveCurrentStep: jest.fn(),
    returnForRevision: jest.fn(),
    reject: jest.fn(),
    withdraw: jest.fn(),
  };
  const controller = new EmploymentApprovalsController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it('leaves participant routes to service authorization instead of requiring a broad write permission', () => {
    expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.findMine)).toBeUndefined();
    expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.findCurrent)).toBeUndefined();
    expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.findDetail)).toBeUndefined();
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller.findMine)).toBeUndefined();
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller.approve)).toBeUndefined();
  });

  it('does not expose generic request creation or effective-state mutation endpoints', () => {
    expect(controller).not.toHaveProperty('createRequest');
    expect(controller).not.toHaveProperty('markPendingEffective');
    expect(controller).not.toHaveProperty('completeEffective');
  });

  it('forwards approve, return, reject, and withdraw actions with the authenticated user', async () => {
    service.approveCurrentStep.mockResolvedValue({ id: 'request-1' });
    service.returnForRevision.mockResolvedValue({ id: 'request-1' });
    service.reject.mockResolvedValue({ id: 'request-1' });
    service.withdraw.mockResolvedValue({ id: 'request-1' });

    await controller.approve(user, 'request-1', { comment: '同意' });
    await controller.returnForRevision(user, 'request-1', { comment: '请修订' });
    await controller.reject(user, 'request-1', { comment: '驳回原因' });
    await controller.withdraw(user, 'request-1');

    expect(service.approveCurrentStep).toHaveBeenCalledWith(user, 'request-1', '同意');
    expect(service.returnForRevision).toHaveBeenCalledWith(user, 'request-1', '请修订');
    expect(service.reject).toHaveBeenCalledWith(user, 'request-1', '驳回原因');
    expect(service.withdraw).toHaveBeenCalledWith(user, 'request-1');
  });
});
