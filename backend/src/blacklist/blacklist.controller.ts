import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { BlacklistService } from './blacklist.service';
import { QueryBlacklistDto } from './dto/query-blacklist.dto';

@ApiTags('黑名单')
@ApiBearerAuth()
@Controller('blacklist')
export class BlacklistController {
  constructor(private readonly service: BlacklistService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询黑名单（仅 MySQL 模式）' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryBlacklistDto) {
    return this.service.findAll(user, query);
  }
}
