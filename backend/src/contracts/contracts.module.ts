import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { DemoModule } from '../demo/demo.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [PrismaModule, AccessControlModule, DemoModule],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
