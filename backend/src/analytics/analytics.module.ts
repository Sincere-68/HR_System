import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { DemoModule } from '../demo/demo.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { EmployeeRosterService } from './employee-roster.service';

@Module({
  imports: [PrismaModule, AccessControlModule, DemoModule],
  controllers: [AnalyticsController],
  providers: [EmployeeRosterService],
})
export class AnalyticsModule {}
