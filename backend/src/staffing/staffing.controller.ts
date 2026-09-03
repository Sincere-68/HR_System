import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { QueryTransferTypesDto } from './dto/query-transfer-types.dto';
import { StaffingService } from './staffing.service';

@ApiTags('编制管理')
@ApiBearerAuth()
@Controller('staffing')
export class StaffingController {
  constructor(private readonly service: StaffingService) {}

  @Get('transfer-types')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询调动类型（仅数据库模式，只读）' })
  findTransferTypes(@Query() query: QueryTransferTypesDto) {
    return this.service.findTransferTypes(query);
  }
}
