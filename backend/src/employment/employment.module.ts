import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { DemoModule } from '../demo/demo.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmploymentController } from './employment.controller';
import { EmploymentDetailsController } from './employment-details.controller';
import { EmploymentDetailsService } from './employment-details.service';
import { EmploymentService } from './employment.service';
import { EmploymentViewCountsController } from './employment-view-counts.controller';
import { EmploymentViewCountsService } from './employment-view-counts.service';
import { PersonnelLaborWorkersService } from './personnel-labor-workers.service';
import { PersonnelResignedService } from './personnel-resigned.service';
import { ReportingRelationshipsController } from './reporting-relationships.controller';
import { ReportingRelationshipsService } from './reporting-relationships.service';

@Module({
  imports: [PrismaModule, AccessControlModule, DemoModule],
  controllers: [EmploymentController, EmploymentDetailsController, EmploymentViewCountsController, ReportingRelationshipsController],
  providers: [EmploymentService, EmploymentDetailsService, EmploymentViewCountsService, ReportingRelationshipsService, PersonnelLaborWorkersService, PersonnelResignedService],
})
export class EmploymentModule {}
