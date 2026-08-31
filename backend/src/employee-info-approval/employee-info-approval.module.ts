import { Module } from '@nestjs/common';
import { EmployeeInfoApprovalController } from './employee-info-approval.controller';
import { EmployeeInfoApprovalService } from './employee-info-approval.service';

@Module({
  controllers: [EmployeeInfoApprovalController],
  providers: [EmployeeInfoApprovalService],
})
export class EmployeeInfoApprovalModule {}
