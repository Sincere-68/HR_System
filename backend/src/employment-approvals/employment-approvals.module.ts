import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmploymentApprovalRuntimeService } from './employment-approval-runtime.service';
import { EmploymentApprovalsController } from './employment-approvals.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [EmploymentApprovalsController],
  providers: [EmploymentApprovalRuntimeService],
  exports: [EmploymentApprovalRuntimeService],
})
export class EmploymentApprovalsModule {}
