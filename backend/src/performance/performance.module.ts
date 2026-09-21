import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { AuthModule } from '../auth/auth.module';
import { FeishuModule } from '../feishu/feishu.module';
import { FeishuLongConnectionService } from '../feishu/feishu-long-connection.service';
import { PerformanceController } from './performance.controller';
import { MockPerformanceDataAdapter, PERFORMANCE_DATA_ADAPTER } from './performance-data.adapter';
import { PerformanceRuleEngine } from './performance-rule-engine';
import { PerformanceService } from './performance.service';
import { FeishuTaskAuthGuard } from './feishu-task-auth.guard';
import { FeishuTaskSessionService } from './feishu-task-session.service';
import { PerformanceTemplateParser } from './performance-template.parser';

@Module({
  imports: [AccessControlModule, AuthModule, FeishuModule],
  controllers: [PerformanceController],
  providers: [
    PerformanceRuleEngine,
    PerformanceTemplateParser,
    { provide: PERFORMANCE_DATA_ADAPTER, useClass: MockPerformanceDataAdapter },
    FeishuTaskSessionService,
    FeishuTaskAuthGuard,
    PerformanceService,
  ],
  exports: [PerformanceService],
})
export class PerformanceModule {}
