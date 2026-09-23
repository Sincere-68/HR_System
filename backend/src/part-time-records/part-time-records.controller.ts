import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreatePartTimeRecordDto } from './dto/create-part-time-record.dto';
import { EndPartTimeRecordDto } from './dto/end-part-time-record.dto';
import { QueryPartTimeRecordsDto } from './dto/query-part-time-records.dto';
import { PartTimeRecordsService } from './part-time-records.service';

@ApiTags('兼职职责记录')
@ApiBearerAuth()
@Controller('employment/part-time-records')
export class PartTimeRecordsController {
  constructor(private readonly service: PartTimeRecordsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '创建兼职职责记录并发起审批' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePartTimeRecordDto) {
    return this.service.create(user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询兼职职责记录' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryPartTimeRecordsDto) {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '查看兼职职责记录详情' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post(':id/activate')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '显式生效已最终审批的兼职职责记录' })
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.activate(user, id);
  }

  @Post(':id/end')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '结束兼职职责记录并保留历史' })
  end(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: EndPartTimeRecordDto,
  ) {
    return this.service.end(user, id, dto);
  }
}
