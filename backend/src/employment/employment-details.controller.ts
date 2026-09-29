import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { EmploymentDetailsService } from './employment-details.service';

@ApiTags('任职管理详情')
@ApiBearerAuth()
@Controller('employment')
export class EmploymentDetailsController {
  constructor(private readonly service: EmploymentDetailsService) {}

  @Get('records/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '读取任职记录详情' })
  getEmploymentRecord(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getEmploymentRecordDetail(user, id);
  }

  @Get('probation/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '读取试用记录详情' })
  getProbation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getProbationDetail(user, id);
  }

  @Get('movements/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '读取异动详情' })
  getMovement(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getMovementDetail(user, id);
  }

  @Get('trial-posts/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '读取试岗详情' })
  getTrialPost(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getTrialPostDetail(user, id);
  }

  @Get('interns/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '读取实习周期详情' })
  getIntern(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getInternDetail(user, id);
  }

  @Get('labor-workers/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '读取劳务周期详情' })
  getLaborWorker(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getLaborWorkerDetail(user, id);
  }

  @Get('terminations/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '读取离职详情' })
  getTermination(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getTerminationDetail(user, id);
  }

  @Get('retirements/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '读取退休详情' })
  getRetirement(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getRetirementDetail(user, id);
  }

  @Get('part-time/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '读取兼职任职详情' })
  getPartTime(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getPartTimeDetail(user, id);
  }
}
