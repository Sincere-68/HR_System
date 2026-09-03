import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { QueryEmployeeRosterDto } from './dto/query-employee-roster.dto';
import { EmployeeRosterService } from './employee-roster.service';

@ApiTags('人事分析')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly employeeRoster: EmployeeRosterService) {}

  @Get('roster')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询当前在职员工名册（仅数据库模式，只读）' })
  findRoster(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryEmployeeRosterDto,
  ) {
    return this.employeeRoster.findAll(user, query);
  }
}
