import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessControlModule } from './access-control/access-control.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { BlacklistModule } from './blacklist/blacklist.module';
import { ContractsModule } from './contracts/contracts.module';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { validateEnvironment } from './config/env.validation';
import { DemoModule } from './demo/demo.module';
import { EmployeesModule } from './employees/employees.module';
import { EmployeeInfoApprovalModule } from './employee-info-approval/employee-info-approval.module';
import { EmployeeSubsetsModule } from './employee-subsets/employee-subsets.module';
import { EmploymentModule } from './employment/employment.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PrismaModule } from './prisma/prisma.module';
import { StaffingModule } from './staffing/staffing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', 'backend/.env'],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DemoModule,
    PrismaModule,
    AccessControlModule,
    AnalyticsModule,
    AuditModule,
    AuthModule,
    BlacklistModule,
    ContractsModule,
    OrganizationsModule,
    EmployeesModule,
    EmployeeInfoApprovalModule,
    EmployeeSubsetsModule,
    EmploymentModule,
    StaffingModule,
    OnboardingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
