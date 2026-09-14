import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DemoDataService } from '../demo/demo-data.service';
import { AuthService } from './auth.service';

function createService() {
  const config = { get: (_key: string, fallback: unknown) => fallback } as never;
  const demo = new DemoDataService(config);
  const jwt = { signAsync: jest.fn(({ sub }) => Promise.resolve(`token-for-${sub}`)) } as never;
  return new AuthService({} as never, jwt, demo);
}

describe('AuthService database authentication', () => {
  it('selects only authentication fields so login tolerates unavailable optional integrations', async () => {
    const passwordHash = await bcrypt.hash('local-password', 4);
    const findUnique = jest.fn().mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      passwordHash,
      displayName: '虚构管理员',
      role: {
        code: 'ADMIN',
        name: '管理员',
        permissions: [{ permission: { code: 'employee.read' } }],
      },
      dataScopes: [{ organizationId: 'org-1' }],
    });
    const service = new AuthService(
      { user: { findUnique } } as never,
      { signAsync: jest.fn(({ sub }) => Promise.resolve(`token-for-${sub}`)) } as never,
      { enabled: false } as never,
    );

    await expect(service.login('admin', 'local-password')).resolves.toMatchObject({
      accessToken: 'token-for-user-1',
      user: { username: 'admin', permissions: ['employee.read'], organizationIds: ['org-1'] },
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { username: 'admin' },
      select: expect.objectContaining({
        id: true,
        username: true,
        passwordHash: true,
        displayName: true,
        role: expect.any(Object),
        dataScopes: expect.any(Object),
      }),
    });
    const selectedFields = findUnique.mock.calls[0][0].select as Record<string, unknown>;
    expect(selectedFields).not.toHaveProperty('feishuOpenId');
    expect(selectedFields).not.toHaveProperty('feishuOpenIdSyncedAt');
  });
});

describe('AuthService in demo mode', () => {
  it('logs in and restores a user without querying Prisma', async () => {
    const service = createService();
    const login = await service.login('admin', 'Demo@123');
    const restored = await service.getAuthUser(login.user.id);

    expect(login.accessToken).toBe('token-for-demo-user-admin');
    expect(restored.username).toBe('admin');
  });

  it('returns no business-data permissions for a demo viewer', async () => {
    const service = createService();
    const login = await service.login('viewer', 'Demo@123');

    expect(login.user.role).toBe('VIEWER');
    expect(login.user.permissions).toEqual([]);
  });

  it('rejects an invalid demo password', async () => {
    const service = createService();
    await expect(service.login('admin', 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
