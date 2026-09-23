import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { QueryReportingRelationshipsDto } from './dto/query-reporting-relationships.dto';
import { ReportingRelationshipsService } from './reporting-relationships.service';

@ApiTags('任职管理')
@ApiBearerAuth()
@Controller('employment')
export class ReportingRelationshipsController {
  constructor(private readonly service: ReportingRelationshipsService) {}

  @Get('reporting-relationships')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '查询授权范围内的显式汇报关系及完整关系图' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryReportingRelationshipsDto,
  ) {
    return this.service.findAll(user, query);
  }
}
