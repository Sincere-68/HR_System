import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TenantAccessTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

interface FeishuUserIdResponse {
  code: number;
  msg: string;
  data?: {
    user_list?: Array<{
      email?: string;
      mobile?: string;
      user_id?: string;
    }>;
  };
}

interface FeishuMessageResponse {
  code: number;
  msg: string;
  data?: { message_id?: string };
}

export interface FeishuCard {
  schema: '2.0';
  config?: { enable_forward?: boolean };
  header: { title: { tag: 'plain_text'; content: string }; template?: 'blue' | 'green' | 'orange' | 'red' };
  body: { elements: Array<Record<string, unknown>> };
}

@Injectable()
export class FeishuService {
  private readonly logger = new Logger(FeishuService.name);
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {}

  get enabled() {
    return this.config.get<boolean>('FEISHU_ENABLED', false);
  }

  /**
   * Resolves a Feishu recipient from HR contact data. Employee numbers are
   * deliberately not used here: Contact v3 no longer accepts employee_id as
   * a lookup identifier.
   */
  async resolveOpenIdByContact(input: { workEmail?: string | null; mobile?: string | null }) {
    if (!this.enabled) return null;
    const email = input.workEmail?.trim();
    const mobile = input.mobile?.trim();
    if (!email && !mobile) return null;

    const token = await this.getTenantAccessToken();
    if (!token) return null;
    try {
      const response = await this.request<FeishuUserIdResponse>(
        'https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            ...(email ? { emails: [email] } : {}),
            ...(mobile ? { mobiles: [mobile] } : {}),
          }),
        },
      );
      if (response.code !== 0) {
        this.logger.warn(`飞书联系人查询失败: ${response.msg || 'unknown error'}`);
        return null;
      }

      const openIds = new Set(
        response.data?.user_list
          ?.map((user) => user.user_id)
          .filter((userId): userId is string => Boolean(userId)) ?? [],
      );
      if (openIds.size === 1) return [...openIds][0]!;
      if (openIds.size > 1) {
        this.logger.warn('飞书联系人查询返回多个账号，未自动绑定');
        return null;
      }
      this.logger.warn('飞书联系人未匹配，可能不在应用通讯录权限范围内或资料不一致');
      return null;
    } catch (error) {
      this.logger.warn(`飞书联系人查询请求失败: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }

  async sendTextToOpenId(openId: string, text: string) {
    return this.sendText(openId, text, 'open_id');
  }

  async sendTextToEmail(email: string, text: string) {
    return this.sendText(email.trim(), text, 'email');
  }

  /** Sends a personal interactive card. Cards never target chat_id or groups. */
  async sendCardToOpenId(openId: string, card: FeishuCard) {
    if (!this.enabled || !openId) return false;
    const token = await this.getTenantAccessToken();
    if (!token) return false;
    try {
      const response = await this.request<FeishuMessageResponse>(
        'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ receive_id: openId, msg_type: 'interactive', content: JSON.stringify(card) }),
        },
      );
      if (response.code !== 0) {
        this.logger.warn(`飞书交互卡片发送失败: ${response.msg || 'unknown error'}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`飞书交互卡片请求失败: ${error instanceof Error ? error.message : 'unknown error'}`);
      return false;
    }
  }

  /** Updates an existing personal interactive card after a successful submission. */
  async updateCard(messageId: string, card: FeishuCard) {
    if (!this.enabled || !messageId) return false;
    const token = await this.getTenantAccessToken();
    if (!token) return false;
    try {
      const response = await this.request<FeishuMessageResponse>(
        `https://open.feishu.cn/open-apis/im/v1/messages/${encodeURIComponent(messageId)}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ msg_type: 'interactive', content: JSON.stringify(card) }),
        },
      );
      if (response.code !== 0) {
        this.logger.warn(`飞书卡片更新失败: ${response.msg || 'unknown error'}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`飞书卡片更新请求失败: ${error instanceof Error ? error.message : 'unknown error'}`);
      return false;
    }
  }

  private async sendText(receiveId: string, text: string, receiveIdType: 'email' | 'open_id') {
    if (!this.enabled || !receiveId) return false;
    const token = await this.getTenantAccessToken();
    if (!token) return false;
    try {
      const response = await this.request<FeishuMessageResponse>(
        `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ receive_id: receiveId, msg_type: 'text', content: JSON.stringify({ text }) }),
        },
      );
      if (response.code !== 0) {
        this.logger.warn(`飞书消息发送失败 (${receiveIdType}): ${response.msg || 'unknown error'}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`飞书消息请求失败 (${receiveIdType}): ${error instanceof Error ? error.message : 'unknown error'}`);
      return false;
    }
  }

  private async getTenantAccessToken() {
    if (!this.enabled) return null;
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) return this.accessToken;
    const appId = this.config.get<string>('FEISHU_APP_ID');
    const appSecret = this.config.get<string>('FEISHU_APP_SECRET');
    if (!appId || !appSecret) {
      this.logger.warn('飞书推送已开启但缺少应用凭证');
      return null;
    }
    try {
      const response = await this.request<TenantAccessTokenResponse>(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
        },
      );
      if (response.code !== 0 || !response.tenant_access_token) {
        this.logger.warn(`飞书 tenant_access_token 获取失败: ${response.msg || 'unknown error'}`);
        return null;
      }
      this.accessToken = response.tenant_access_token;
      this.accessTokenExpiresAt = Date.now() + Math.max(60, (response.expire ?? 7200) - 120) * 1000;
      return this.accessToken;
    } catch (error) {
      this.logger.warn(`飞书 tenant_access_token 请求失败: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }

  private async request<T>(url: string, init: RequestInit) {
    const response = await fetch(url, init);
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { code?: unknown; msg?: unknown } | null;
      const code = typeof body?.code === 'number' ? ` code=${body.code}` : '';
      const message = typeof body?.msg === 'string' && body.msg.trim() ? ` msg=${body.msg.trim().slice(0, 240)}` : '';
      throw new Error(`HTTP ${response.status}${code}${message}`);
    }
    return response.json() as Promise<T>;
  }
}
