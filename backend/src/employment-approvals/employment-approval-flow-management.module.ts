import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmploymentApprovalFlowManagementController } from './employment-approval-flow-management.controller';
import { EmploymentApprovalFlowManagementService } from './employment-approval-flow-management.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [EmploymentApprovalFlowManagementController],
  providers: [EmploymentApprovalFlowManagementService],
  exports: [EmploymentApprovalFlowManagementService],
})
export class EmploymentApprovalFlowManagementModule {}
