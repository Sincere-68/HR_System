import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TenantAccessTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

interface FeishuUserResponse {
  code: number;
  msg: string;
  data?: { user?: { open_id?: string } };
}

interface FeishuMessageResponse {
  code: number;
  msg: string;
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

  async resolveOpenIdByEmployeeId(employeeId: string) {
    if (!this.enabled) return null;
    const token = await this.getTenantAccessToken();
    if (!token) return null;
    try {
      const response = await this.request<FeishuUserResponse>(
        `https://open.feishu.cn/open-apis/contact/v3/users/${encodeURIComponent(employeeId)}?user_id_type=employee_id`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.code !== 0 || !response.data?.user?.open_id) {
        this.logger.warn(`飞书员工身份同步未匹配: ${response.msg || 'unknown error'}`);
        return null;
      }
      return response.data.user.open_id;
    } catch (error) {
      this.logger.warn(`飞书员工身份同步请求失败: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }

  async sendTextToOpenId(openId: string, text: string) {
    if (!this.enabled || !openId) return false;
    const token = await this.getTenantAccessToken();
    if (!token) return false;
    try {
      const response = await this.request<FeishuMessageResponse>(
        'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ receive_id: openId, msg_type: 'text', content: JSON.stringify({ text }) }),
        },
      );
      if (response.code !== 0) {
        this.logger.warn(`飞书个人消息发送失败: ${response.msg || 'unknown error'}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`飞书个人消息请求失败: ${error instanceof Error ? error.message : 'unknown error'}`);
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
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<T>;
  }
}
