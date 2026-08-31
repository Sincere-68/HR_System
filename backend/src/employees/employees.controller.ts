import { Body, Controller, Get, Ip, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermission, RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { QueryRegularEmployeesDto } from './dto/query-regular-employees.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@ApiTags('人员')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get('form-options')
  @RequireAnyPermission(PERMISSIONS.EMPLOYEE_CREATE, PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '获取新增或编辑员工表单选项' })
  formOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('excludeEmployeeId') excludeEmployeeId?: string,
  ) {
    return this.service.getFormOptions(user, { excludeEmployeeId });
  }

  @Get('regular')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询当前正式人员（仅 MySQL 模式，只读）' })
  findRegularEmployees(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryRegularEmployeesDto,
  ) {
    return this.service.findRegularEmployees(user, query);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询员工' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeesDto) {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '查看员工详情并记录审计' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Ip() ipAddress: string,
    @Req() request: Request,
  ) {
    return this.service.findOne(user, id, {
      userId: user.id,
      ipAddress,
      userAgent: request.get('user-agent'),
    });
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_CREATE)
  @ApiOperation({ summary: '新增员工并记录审计' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmployeeDto,
    @Ip() ipAddress: string,
    @Req() request: Request,
  ) {
    return this.service.create(user, dto, {
      userId: user.id,
      ipAddress,
      userAgent: request.get('user-agent'),
    });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '编辑员工并记录审计' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @Ip() ipAddress: string,
    @Req() request: Request,
  ) {
    return this.service.update(user, id, dto, {
      userId: user.id,
      ipAddress,
      userAgent: request.get('user-agent'),
    });
  }
}
