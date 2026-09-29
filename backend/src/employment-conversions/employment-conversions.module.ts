import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { EmploymentApprovalsModule } from '../employment-approvals/employment-approvals.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmploymentConversionsController } from './employment-conversions.controller';
import { EmploymentConversionsService } from './employment-conversions.service';

@Module({
  imports: [PrismaModule, AccessControlModule, EmploymentApprovalsModule],
  controllers: [EmploymentConversionsController],
  providers: [EmploymentConversionsService],
  exports: [EmploymentConversionsService],
})
export class EmploymentConversionsModule {}
