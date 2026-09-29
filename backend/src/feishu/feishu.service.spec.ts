import { ConfigService } from '@nestjs/config';
import { FeishuService } from './feishu.service';

describe('FeishuService', () => {
  it('does nothing when Feishu is disabled', async () => {
    const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) } as unknown as ConfigService;
    const service = new FeishuService(config);
    expect(await service.resolveOpenIdByContact({ workEmail: 'fictional@example.invalid' })).toBeNull();
    expect(await service.sendTextToEmail('fictional@example.invalid', '测试消息')).toBe(false);
    expect(await service.sendTextToOpenId('ou_xxx', '测试消息')).toBe(false);
    expect(await service.sendCardToOpenId('ou_xxx', {
      schema: '2.0',
      header: { title: { tag: 'plain_text', content: '测试卡片' } },
      body: { elements: [] },
    })).toBe(false);
    expect(await service.sendCardMessageToOpenId('ou_xxx', {
      schema: '2.0',
      header: { title: { tag: 'plain_text', content: '测试卡片' } },
      body: { elements: [] },
    })).toBeNull();
    expect(await service.updateCard('message_xxx', {
      schema: '2.0',
      header: { title: { tag: 'plain_text', content: '已提交' } },
      body: { elements: [] },
    })).toBe(false);
  });
});
