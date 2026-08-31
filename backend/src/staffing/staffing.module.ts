import { Module } from '@nestjs/common';
import { DemoModule } from '../demo/demo.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffingController } from './staffing.controller';
import { StaffingService } from './staffing.service';

@Module({
  imports: [PrismaModule, DemoModule],
  controllers: [StaffingController],
  providers: [StaffingService],
})
export class StaffingModule {}
