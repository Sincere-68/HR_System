import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateEmploymentConversionDto, QueryEmploymentConversionsDto } from './dto';
import { EmploymentConversionsService } from './employment-conversions.service';

@ApiTags('任职转换')
@ApiBearerAuth()
@Controller('employment/conversions')
export class EmploymentConversionsController {
  constructor(private readonly service: EmploymentConversionsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '提交实习或劳务转正式申请' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmploymentConversionDto,
  ) {
    return this.service.create(user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询任职转换申请' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryEmploymentConversionsDto,
  ) {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '查询任职转换申请详情' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.findOne(user, id);
  }

  @Post(':id/activate')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '生效已完成审批的任职转换' })
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.activate(user, id);
  }
}
