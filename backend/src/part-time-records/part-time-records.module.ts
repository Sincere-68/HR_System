import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { AuditModule } from '../audit/audit.module';
import { EmploymentApprovalsModule } from '../employment-approvals/employment-approvals.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PartTimeRecordsController } from './part-time-records.controller';
import { PartTimeRecordsService } from './part-time-records.service';

@Module({
  imports: [PrismaModule, AccessControlModule, AuditModule, EmploymentApprovalsModule],
  controllers: [PartTimeRecordsController],
  providers: [PartTimeRecordsService],
  exports: [PartTimeRecordsService],
})
export class PartTimeRecordsModule {}
