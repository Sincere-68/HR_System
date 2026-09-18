import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Lark from '@larksuiteoapi/node-sdk';

export interface FeishuCardActionEvent {
  payload: Record<string, unknown>;
  eventId?: string;
}

export type FeishuCardActionHandler = (event: FeishuCardActionEvent) => Promise<Record<string, unknown>>;

@Injectable()
export class FeishuLongConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FeishuLongConnectionService.name);
  private handler: FeishuCardActionHandler | null = null;
  private client: { close?: (params?: { force?: boolean }) => void } | null = null;

  constructor(private readonly config: ConfigService) {}

  registerCardActionHandler(handler: FeishuCardActionHandler) {
    this.handler = handler;
  }

  async onModuleInit() {
    if (!this.config.get<boolean>('FEISHU_ENABLED', false) || !this.config.get<boolean>('FEISHU_LONG_CONNECTION_ENABLED', false)) return;
    const appId = this.config.get<string>('FEISHU_APP_ID');
    const appSecret = this.config.get<string>('FEISHU_APP_SECRET');
    if (!appId || !appSecret) {
      this.logger.error('飞书长连接已启用但缺少应用凭证');
      return;
    }
    if (!this.handler) {
      this.logger.error('飞书长连接已启用但未注册卡片处理器');
      return;
    }

    try {
      const dispatcher = new Lark.EventDispatcher({
        verificationToken: this.config.get<string>('FEISHU_VERIFICATION_TOKEN'),
        encryptKey: this.config.get<string>('FEISHU_ENCRYPT_KEY'),
      }).register({
        'card.action.trigger': async (data: Record<string, unknown>) => {
          const action = this.actionSummary(data);
          const sanitize = (value: unknown, key = ''): unknown => {
            if (Array.isArray(value)) return value.map((item) => sanitize(item));
            if (value && typeof value === 'object') {
              return Object.fromEntries(
                Object.entries(value).map(([childKey, childValue]) => [
                  childKey,
                  sanitize(childValue, childKey),
                ]),
              );
            }

            if (/token|secret|open_id|user_id|union_id|message_id|app_id|tenant_key|comment/i.test(key)) {
              return '<masked>';
            }

            return value;
          };

          this.logger.log(`[FeishuCardDebug] ${JSON.stringify(sanitize(data))}`);
          this.logger.log(`收到飞书卡片回传: event=${this.eventId(data) ?? 'none'} action=${action} shape=${this.payloadShape(data)}`);
          try {
            const result = await this.handler!({ payload: data, eventId: this.eventId(data) });
            this.logger.log(`飞书卡片回传处理完成: event=${this.eventId(data) ?? 'none'} toast=${this.toastSummary(result)}`);
            return result;
          } catch (error) {
            this.logger.error(`飞书卡片回传处理失败: event=${this.eventId(data) ?? 'none'} reason=${error instanceof Error ? error.message : 'unknown error'}`);
            return { toast: { type: 'error', content: '卡片提交处理失败，请稍后重试' } };
          }
        },
      });
      const client = new Lark.WSClient({ appId, appSecret });
      void client.start({ eventDispatcher: dispatcher });
      this.client = client;
      this.logger.log('飞书卡片长连接已启动');
    } catch (error) {
      this.logger.error(`飞书卡片长连接启动失败: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  onModuleDestroy() {
    this.client?.close?.({ force: true });
    this.client = null;
  }

  private actionSummary(value: Record<string, unknown>) {
    const event = value.event as Record<string, unknown> | undefined;
    const action = (event?.action ?? value.action) as Record<string, unknown> | undefined;
    const formValue = (action?.form_value ?? action?.form_values) as Record<string, unknown> | undefined;
    const fields = formValue ? Object.keys(formValue).filter((field) => field !== 'token').join(',') || 'none' : 'none';
    return `fields=${fields}`;
  }

  private payloadShape(value: Record<string, unknown>) {
    const topLevel = Object.keys(value).sort().join(',') || 'none';
    const event = value.event;
    const eventFields = event && typeof event === 'object' ? Object.keys(event as Record<string, unknown>).sort().join(',') || 'none' : 'none';
    const action = event && typeof event === 'object' ? (event as Record<string, unknown>).action : value.action;
    const actionFields = action && typeof action === 'object' ? Object.keys(action as Record<string, unknown>).sort().join(',') || 'none' : 'none';
    return `top=${topLevel};event=${eventFields};action=${actionFields}`;
  }

  private toastSummary(value: Record<string, unknown>) {
    const toast = value.toast as Record<string, unknown> | undefined;
    return typeof toast?.type === 'string' ? toast.type : 'none';
  }

  private eventId(value: Record<string, unknown>) {
    const header = value.header as Record<string, unknown> | undefined;
    const event = value.event as Record<string, unknown> | undefined;
    const id = header?.event_id ?? value.event_id ?? event?.event_id;
    return typeof id === 'string' && id ? id : undefined;
  }
}
