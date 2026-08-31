import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { DemoModule } from '../demo/demo.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmploymentController } from './employment.controller';
import { EmploymentService } from './employment.service';
import { PersonnelLaborWorkersService } from './personnel-labor-workers.service';
import { PersonnelResignedService } from './personnel-resigned.service';

@Module({
  imports: [PrismaModule, AccessControlModule, DemoModule],
  controllers: [EmploymentController],
  providers: [EmploymentService, PersonnelLaborWorkersService, PersonnelResignedService],
})
export class EmploymentModule {}
