import { Module } from '@nestjs/common';
import { FeishuModule } from '../feishu/feishu.module';
import { EmployeeInfoApprovalController } from './employee-info-approval.controller';
import { EmployeeInfoApprovalService } from './employee-info-approval.service';

@Module({
  imports: [FeishuModule],
  controllers: [EmployeeInfoApprovalController],
  providers: [EmployeeInfoApprovalService],
})
export class EmployeeInfoApprovalModule {}
