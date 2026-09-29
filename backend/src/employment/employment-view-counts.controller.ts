import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { QueryEmploymentViewCountsDto } from './dto/query-employment-view-counts.dto';
import { EmploymentViewCountsService } from './employment-view-counts.service';

@ApiTags('任职管理')
@ApiBearerAuth()
@Controller('employment')
export class EmploymentViewCountsController {
  constructor(private readonly service: EmploymentViewCountsService) {}

  @Get('view-counts')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '查询任职管理视图计数' })
  getViewCounts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryEmploymentViewCountsDto,
  ) {
    return this.service.getViewCounts(user, query);
  }
}
