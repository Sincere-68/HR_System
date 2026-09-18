import { FeishuLongConnectionService } from './feishu-long-connection.service';

describe('FeishuLongConnectionService', () => {
  it('does not start a client when long connection is disabled', async () => {
    const config = { get: jest.fn((key: string, fallback?: unknown) => key === 'FEISHU_ENABLED' ? true : fallback) };
    const service = new FeishuLongConnectionService(config as never);
    service.registerCardActionHandler(jest.fn());

    await service.onModuleInit();

    expect(config.get).toHaveBeenCalledWith('FEISHU_LONG_CONNECTION_ENABLED', false);
  });

  it('registers a card action handler for later SDK delivery', async () => {
    const service = new FeishuLongConnectionService({ get: jest.fn() } as never);
    const handler = jest.fn().mockResolvedValue({ toast: { type: 'success' } });

    service.registerCardActionHandler(handler);

    await expect((service as any).handler({ payload: { event: {} }, eventId: 'event-1' })).resolves.toEqual({ toast: { type: 'success' } });
  });
});
