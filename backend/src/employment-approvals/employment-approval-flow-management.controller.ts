import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  CreateEmploymentApprovalFlowDefinitionDto,
  CreateEmploymentApprovalFlowVersionDto,
  UpdateEmploymentApprovalFlowDefinitionDto,
  UpdateEmploymentApprovalFlowVersionDto,
} from './dto/employment-approval-flow.dto';
import { EmploymentApprovalFlowManagementService } from './employment-approval-flow-management.service';
import { QueryEmploymentApprovalFlowsDto } from './dto/query-employment-approval-flows.dto';

@ApiTags('任职审批流程管理')
@ApiBearerAuth()
@Controller('employment-approval-flows')
export class EmploymentApprovalFlowManagementController {
  constructor(private readonly service: EmploymentApprovalFlowManagementService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYMENT_APPROVAL_FLOW_MANAGE)
  @ApiOperation({ summary: '分页查询任职审批流程定义' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryEmploymentApprovalFlowsDto,
  ) {
    return this.service.findAll(user, query);
  }

  @Get('options')
  @RequirePermissions(PERMISSIONS.EMPLOYMENT_APPROVAL_FLOW_MANAGE)
  @ApiOperation({ summary: '查询任职审批流程配置选项' })
  findOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findOptions(user);
  }

  @Get(':definitionId')
  @RequirePermissions(PERMISSIONS.EMPLOYMENT_APPROVAL_FLOW_MANAGE)
  @ApiOperation({ summary: '查询任职审批流程定义及版本' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('definitionId') definitionId: string,
  ) {
    return this.service.findOne(user, definitionId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYMENT_APPROVAL_FLOW_MANAGE)
  @ApiOperation({ summary: '创建任职审批流程定义及首个草稿版本' })
  createDefinition(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmploymentApprovalFlowDefinitionDto,
  ) {
    return this.service.createDefinition(user, dto);
  }

  @Post(':definitionId/versions')
  @RequirePermissions(PERMISSIONS.EMPLOYMENT_APPROVAL_FLOW_MANAGE)
  @ApiOperation({ summary: '创建任职审批流程草稿版本' })
  createVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('definitionId') definitionId: string,
    @Body() dto: CreateEmploymentApprovalFlowVersionDto,
  ) {
    return this.service.createVersion(user, definitionId, dto);
  }

  @Patch(':definitionId')
  @RequirePermissions(PERMISSIONS.EMPLOYMENT_APPROVAL_FLOW_MANAGE)
  @ApiOperation({ summary: '修改未发布任职审批流程定义' })
  updateDefinition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('definitionId') definitionId: string,
    @Body() dto: UpdateEmploymentApprovalFlowDefinitionDto,
  ) {
    return this.service.updateDefinition(user, definitionId, dto);
  }

  @Patch('versions/:versionId')
  @RequirePermissions(PERMISSIONS.EMPLOYMENT_APPROVAL_FLOW_MANAGE)
  @ApiOperation({ summary: '修改未发布任职审批流程版本' })
  updateVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('versionId') versionId: string,
    @Body() dto: UpdateEmploymentApprovalFlowVersionDto,
  ) {
    return this.service.updateVersion(user, versionId, dto);
  }

  @Post('versions/:versionId/publish')
  @RequirePermissions(PERMISSIONS.EMPLOYMENT_APPROVAL_FLOW_MANAGE)
  @ApiOperation({ summary: '发布任职审批流程版本并归档旧发布版本' })
  publishVersion(@CurrentUser() user: AuthenticatedUser, @Param('versionId') versionId: string) {
    return this.service.publishVersion(user, versionId);
  }

  @Post(':definitionId/archive')
  @RequirePermissions(PERMISSIONS.EMPLOYMENT_APPROVAL_FLOW_MANAGE)
  @ApiOperation({ summary: '归档任职审批流程定义' })
  archiveDefinition(@CurrentUser() user: AuthenticatedUser, @Param('definitionId') definitionId: string) {
    return this.service.archiveDefinition(user, definitionId);
  }
}
