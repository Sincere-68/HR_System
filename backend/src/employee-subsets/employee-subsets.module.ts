import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { DemoModule } from '../demo/demo.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeeSubsetsController } from './employee-subsets.controller';
import { EmployeeSubsetsService } from './employee-subsets.service';

@Module({
  imports: [PrismaModule, AccessControlModule, DemoModule],
  controllers: [EmployeeSubsetsController],
  providers: [EmployeeSubsetsService],
})
export class EmployeeSubsetsModule {}
