import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { PerformanceController } from './performance.controller';
import { MockPerformanceDataAdapter, PERFORMANCE_DATA_ADAPTER } from './performance-data.adapter';
import { PerformanceRuleEngine } from './performance-rule-engine';
import { PerformanceService } from './performance.service';
import { PerformanceTemplateParser } from './performance-template.parser';

@Module({
  imports: [AccessControlModule],
  controllers: [PerformanceController],
  providers: [
    PerformanceRuleEngine,
    PerformanceTemplateParser,
    { provide: PERFORMANCE_DATA_ADAPTER, useClass: MockPerformanceDataAdapter },
    PerformanceService,
  ],
  exports: [PerformanceService],
})
export class PerformanceModule {}
