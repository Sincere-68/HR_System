import { UnauthorizedException } from '@nestjs/common';
import { DemoDataService } from '../demo/demo-data.service';
import { AuthService } from './auth.service';

function createService() {
  const config = { get: (_key: string, fallback: unknown) => fallback } as never;
  const demo = new DemoDataService(config);
  const jwt = { signAsync: jest.fn(({ sub }) => Promise.resolve(`token-for-${sub}`)) } as never;
  return new AuthService({} as never, jwt, demo);
}

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
