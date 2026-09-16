import { Controller, Get, Ip, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { EmployeeInfoApprovalService } from './employee-info-approval.service';
import { QueryEmployeeInfoApprovalDto } from './dto/query-employee-info-approval.dto';

@ApiTags('员工信息审批')
@ApiBearerAuth()
@Controller('employee-info-approvals')
export class EmployeeInfoApprovalController {
  constructor(private readonly service: EmployeeInfoApprovalService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询员工信息审批（仅数据库模式）' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeeInfoApprovalDto) {
    return this.service.findAll(user, query);
  }

  @Post(':id/reminders')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '向当前审批人发送飞书提醒' })
  sendReminder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Ip() ipAddress: string,
    @Req() request: Request,
  ) {
    return this.service.sendReminder(user, id, {
      userId: user.id,
      ipAddress,
      userAgent: request.get('user-agent'),
    });
  }
}
