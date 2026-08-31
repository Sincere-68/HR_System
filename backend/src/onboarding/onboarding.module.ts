import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { DemoModule } from '../demo/demo.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [PrismaModule, AccessControlModule, DemoModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
