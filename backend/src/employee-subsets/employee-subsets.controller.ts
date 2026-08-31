import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { QueryEmployeeSubsetDto } from './dto/query-employee-subset.dto';
import { EmployeeSubsetsService } from './employee-subsets.service';

@ApiTags('人员子集')
@ApiBearerAuth()
@Controller('subsets')
export class EmployeeSubsetsController {
  constructor(private readonly service: EmployeeSubsetsService) {}

  @Get('education')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  findEducation(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeeSubsetDto) {
    return this.service.findEducation(user, query);
  }

  @Get('work-history')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  findWorkHistory(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeeSubsetDto) {
    return this.service.findWorkHistory(user, query);
  }

  @Get('family')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  findFamily(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeeSubsetDto) {
    return this.service.findFamily(user, query);
  }

  @Get('appraisals')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  findAppraisals(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeeSubsetDto) {
    return this.service.findAppraisals(user, query);
  }

  @Get('training')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  findTraining(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeeSubsetDto) {
    return this.service.findTraining(user, query);
  }

  @Get('awards')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  findAwards(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeeSubsetDto) {
    return this.service.findAwards(user, query);
  }

  @Get('certificates')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  findCertificates(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeeSubsetDto) {
    return this.service.findCertificates(user, query);
  }

  @Get('projects')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  findProjects(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeeSubsetDto) {
    return this.service.findProjects(user, query);
  }

  @Get('skills')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  findSkills(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeeSubsetDto) {
    return this.service.findSkills(user, query);
  }

  @Get('languages')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  findLanguages(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeeSubsetDto) {
    return this.service.findLanguages(user, query);
  }
}
