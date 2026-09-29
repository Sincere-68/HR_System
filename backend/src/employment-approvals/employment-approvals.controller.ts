import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { OptionalApprovalCommentDto, RequiredApprovalCommentDto } from './dto/approval-comment.dto';
import { QueryEmploymentApprovalsDto } from './dto/query-employment-approvals.dto';
import { EmploymentApprovalRuntimeService } from './employment-approval-runtime.service';

@ApiTags('任职审批')
@ApiBearerAuth()
@Controller('employment-approvals')
export class EmploymentApprovalsController {
  constructor(private readonly service: EmploymentApprovalRuntimeService) {}

  @Get('my')
  @ApiOperation({ summary: '查询本人发起的任职审批申请' })
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmploymentApprovalsDto) {
    return this.service.findMine(user, query);
  }

  @Get('current')
  @ApiOperation({ summary: '查询本人当前待处理的任职审批节点' })
  findCurrent(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmploymentApprovalsDto) {
    return this.service.findCurrent(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '查看本人参与或 HR 可读的任职审批详情' })
  findDetail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.findDetail(user, id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: '审批当前任职审批节点' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: OptionalApprovalCommentDto,
  ) {
    return this.service.approveCurrentStep(user, id, dto.comment);
  }

  @Post(':id/return')
  @ApiOperation({ summary: '退回当前任职审批申请供修订（修订后新建申请）' })
  returnForRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RequiredApprovalCommentDto,
  ) {
    return this.service.returnForRevision(user, id, dto.comment);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: '驳回当前任职审批申请' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RequiredApprovalCommentDto,
  ) {
    return this.service.reject(user, id, dto.comment);
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: '在尚无节点决定时撤回本人任职审批申请' })
  withdraw(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.withdraw(user, id);
  }
}
