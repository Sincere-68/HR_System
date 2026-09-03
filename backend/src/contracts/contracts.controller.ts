import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ContractsService } from './contracts.service';
import { QueryContractsDto } from './dto/query-contracts.dto';

@ApiTags('合同协议')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询当前有效合同（仅数据库模式，只读）' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryContractsDto) {
    return this.service.findAll(user, query);
  }
}
