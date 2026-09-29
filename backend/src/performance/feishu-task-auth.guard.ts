import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FeishuTaskSessionService, type FeishuTaskPrincipal } from './feishu-task-session.service';

@Injectable()
export class FeishuTaskAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly sessions: FeishuTaskSessionService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers?: { authorization?: string }; feishuTask?: FeishuTaskPrincipal }>();
    const header = request.headers?.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('缺少飞书绩效待办会话');
    try {
      const payload = await this.jwt.verifyAsync<{ kind?: string; employeeId?: string; cycleId?: string }>(header.slice(7));
      request.feishuTask = await this.sessions.verifyPrincipal(payload);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('飞书绩效待办会话已失效');
    }
  }
}
