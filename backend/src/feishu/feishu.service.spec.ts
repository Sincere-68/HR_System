import { ConfigService } from '@nestjs/config';
import { FeishuService } from './feishu.service';

describe('FeishuService', () => {
  it('does nothing when Feishu is disabled', async () => {
    const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) } as unknown as ConfigService;
    const service = new FeishuService(config);
    expect(await service.resolveOpenIdByEmployeeId('EMP-1001')).toBeNull();
    expect(await service.sendTextToOpenId('ou_xxx', '测试消息')).toBe(false);
  });
});
