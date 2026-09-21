import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { PerformanceFeishuTaskSessionExchangeResult, PerformanceFeishuTaskInbox } from '@hr-demo/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FeishuService } from '../feishu/feishu.service';

export interface FeishuTaskPrincipal {
  kind: 'FEISHU_TASK';
  employeeId: string;
  cycleId: string;
}

@Injectable()
export class FeishuTaskSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feishu: FeishuService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  get enabled() {
    return Boolean(
      this.feishu.enabled
      && this.config.get<string>('FEISHU_OAUTH_REDIRECT_URI')
      && this.config.get<string>('FEISHU_TASK_INBOX_URL'),
    );
  }

  get redirectUri() {
    return this.config.get<string>('FEISHU_OAUTH_REDIRECT_URI') ?? '';
  }

  async createState(employeeId: string, cycleId: string) {
    if (!this.enabled) return null;
    const state = randomBytes(32).toString('base64url');
    const ttl = this.config.get<number>('FEISHU_TASK_SESSION_TTL_SECONDS', 600);
    await this.prisma.performanceFeishuTaskSession.create({
      data: {
        employeeId,
        cycleId,
        stateHash: this.hash(state),
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });
    return state;
  }

  authorizationUrl(state: string) {
    const appId = this.config.get<string>('FEISHU_APP_ID');
    if (!appId || !this.redirectUri) return null;
    const url = new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchange(state: string, code: string, getInbox: (employeeId: string, cycleId: string) => Promise<PerformanceFeishuTaskInbox>): Promise<PerformanceFeishuTaskSessionExchangeResult> {
    if (!this.enabled) throw new ConflictException('飞书绩效待办入口尚未配置');
    if (!state?.trim() || !code?.trim()) throw new BadRequestException('飞书授权参数不完整');
    const session = await this.prisma.performanceFeishuTaskSession.findFirst({
      where: { stateHash: this.hash(state), status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: { employee: { select: { id: true, workEmail: true, mobile: true } } },
    });
    if (!session?.cycleId) throw new UnauthorizedException('飞书待办授权已失效，请从最新提醒卡片进入');

    const identity = await this.feishu.exchangeAuthorizationCode(code, this.redirectUri);
    if (!identity?.openId) throw new UnauthorizedException('无法确认飞书操作人身份');
    const expectedOpenId = await this.feishu.resolveOpenIdByContact(session.employee);
    if (!expectedOpenId || !this.sameIdentity(expectedOpenId, identity.openId)) throw new UnauthorizedException('飞书账号与当前待办执行人不匹配');

    const consumed = await this.prisma.performanceFeishuTaskSession.updateMany({
      where: { id: session.id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      data: { status: 'CONSUMED', consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new ConflictException('飞书授权已被使用');

    const expiresIn = Math.min(this.config.get<number>('FEISHU_TASK_SESSION_TTL_SECONDS', 600), 900);
    const accessToken = await this.jwt.signAsync(
      { kind: 'FEISHU_TASK', employeeId: session.employeeId, cycleId: session.cycleId },
      { expiresIn },
    );
    return {
      accessToken,
      expiresIn,
      inbox: await getInbox(session.employeeId, session.cycleId),
    };
  }

  async verifyPrincipal(payload: { kind?: string; employeeId?: string; cycleId?: string }) {
    if (payload.kind !== 'FEISHU_TASK' || !payload.employeeId || !payload.cycleId) {
      throw new UnauthorizedException('飞书绩效待办会话无效');
    }
    return { kind: 'FEISHU_TASK' as const, employeeId: payload.employeeId, cycleId: payload.cycleId };
  }

  private sameIdentity(expected: string, actual: string) {
    const expectedHash = createHash('sha256').update(expected).digest();
    const actualHash = createHash('sha256').update(actual).digest();
    return expectedHash.equals(actualHash);
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
