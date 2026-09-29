import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FeishuTaskPrincipal } from './feishu-task-session.service';

export const FeishuTask = createParamDecorator(
  (_data: unknown, context: ExecutionContext): FeishuTaskPrincipal =>
    context.switchToHttp().getRequest<{ feishuTask: FeishuTaskPrincipal }>().feishuTask,
);
