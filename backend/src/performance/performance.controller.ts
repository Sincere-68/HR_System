import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AddPerformanceCycleParticipantsDto, ArchivePerformanceCycleDto, ArchivePerformanceTemplateDto, PerformanceCycleParticipantsActionDto, CreateEmployeePerformanceAmountBaseDto, CreateCycleParticipantAmountBaseDto, CreatePerformanceCycleDto, CreatePerformanceTemplateDto, ModifyPerformanceResultDto, ParsePerformanceTemplateDto, PerformanceFeishuTaskSessionExchangeDto, PerformanceTaskSubmissionDto, PerformanceWorkflowTaskSubmissionDto, QueryEmployeePerformanceAmountBaseDto, QueryPerformanceDto, UpdatePerformanceCycleParticipantTemplateDto } from './dto/performance.dto';
import { FeishuTask } from './feishu-task.decorator';
import { FeishuTaskAuthGuard } from './feishu-task-auth.guard';
import type { FeishuTaskPrincipal } from './feishu-task-session.service';
import { PerformanceService } from './performance.service';

@ApiTags('绩效管理')
@ApiBearerAuth()
@Controller('performance')
export class PerformanceController {
  constructor(private readonly service: PerformanceService) {}

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  getDashboard() { return this.service.getDashboard(); }

  @Post('templates/parse')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE)
  parseTemplate(@Body() dto: ParsePerformanceTemplateDto) { return this.service.parseTemplate(dto); }

  @Get('templates')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  listTemplates(@CurrentUser() user: AuthenticatedUser) { return this.service.listTemplates(user); }

  @Get('templates/:id')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  getTemplate(@Param('id') id: string) { return this.service.getTemplate(id); }

  @Post('templates')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE)
  createTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePerformanceTemplateDto) { return this.service.createTemplate(user, dto); }

  @Post('templates/:id/copy')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE)
  copyTemplate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.copyTemplate(user, id); }

  @Post('templates/:id/archive')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE)
  archiveTemplate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ArchivePerformanceTemplateDto) { return this.service.archiveTemplate(user, id, dto); }

  @Post('templates/:id/versions')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE)
  createTemplateVersion(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreatePerformanceTemplateDto) { return this.service.createTemplateVersion(user, id, dto); }

  @Post('templates/:id/versions/:versionId/publish')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE)
  publishTemplateVersion(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('versionId') versionId: string) { return this.service.publishTemplateVersion(user, id, versionId); }

  @Get('options')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE)
  getOptions(@CurrentUser() user: AuthenticatedUser) { return this.service.getOptions(user); }

  @Get('cycles')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  listCycles(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryPerformanceDto) { return this.service.listCycles(user, query); }

  @Get('cycles/:id')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  getCycle(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.getCycle(id, user); }

  @Get('cycles/:cycleId/participants/:instanceId/workflow')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  getParticipantWorkflow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId') cycleId: string,
    @Param('instanceId') instanceId: string,
  ) { return this.service.getParticipantWorkflow(user, cycleId, instanceId); }

  @Get('cycles/:cycleId/participants/:instanceId/assessment-detail')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  getParticipantAssessmentDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cycleId') cycleId: string,
    @Param('instanceId') instanceId: string,
  ) { return this.service.getParticipantAssessmentDetail(user, cycleId, instanceId); }

  @Post('cycles')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE)
  createCycle(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePerformanceCycleDto) { return this.service.createCycle(user, dto); }

  @Post('cycles/:id/start')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE)
  startCycle(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.startCycle(user, id); }

  @Post('cycles/:id/restart')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE)
  restartCycle(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: PerformanceCycleParticipantsActionDto) { return this.service.restartCycle(user, id, dto); }

  @Post('cycles/:id/close-participants')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE)
  closeCycleParticipants(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: PerformanceCycleParticipantsActionDto) { return this.service.closeCycleParticipants(user, id, dto); }

  @Post('cycles/:id/archive')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE)
  archiveCycle(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ArchivePerformanceCycleDto) { return this.service.archiveCycle(user, id, dto); }

  @Post('cycles/:id/participants')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE)
  addCycleParticipants(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AddPerformanceCycleParticipantsDto) {
    return this.service.addCycleParticipants(user, id, dto);
  }

  @Delete('cycles/:cycleId/participants/:employeeId')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE)
  removeCycleParticipant(@CurrentUser() user: AuthenticatedUser, @Param('cycleId') cycleId: string, @Param('employeeId') employeeId: string) {
    return this.service.removeCycleParticipant(user, cycleId, employeeId);
  }

  @Patch('cycles/:cycleId/participants/:employeeId/template')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE)
  updateCycleParticipantTemplate(@CurrentUser() user: AuthenticatedUser, @Param('cycleId') cycleId: string, @Param('employeeId') employeeId: string, @Body() dto: UpdatePerformanceCycleParticipantTemplateDto) {
    return this.service.updateCycleParticipantTemplate(user, cycleId, employeeId, dto);
  }

  @Post('cycles/:cycleId/participants/:employeeId/amount-base')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE)
  createCycleParticipantAmountBase(@CurrentUser() user: AuthenticatedUser, @Param('cycleId') cycleId: string, @Param('employeeId') employeeId: string, @Body() dto: CreateCycleParticipantAmountBaseDto) {
    return this.service.createCycleParticipantAmountBase(user, cycleId, employeeId, dto);
  }

  @Post('feishu-task-inbox/session')
  @Public()
  exchangeFeishuTaskSession(@Body() dto: PerformanceFeishuTaskSessionExchangeDto) {
    return this.service.exchangeFeishuTaskSession(dto.state, dto.code);
  }

  @Get('feishu-task-inbox')
  @Public()
  @UseGuards(FeishuTaskAuthGuard)
  getFeishuTaskInbox(@FeishuTask() principal: FeishuTaskPrincipal) {
    return this.service.getFeishuTaskInbox(principal.employeeId, principal.cycleId);
  }

  @Post('feishu-task-inbox/assessment-tasks/:id/submit')
  @Public()
  @UseGuards(FeishuTaskAuthGuard)
  submitFeishuAssessmentTask(@FeishuTask() principal: FeishuTaskPrincipal, @Param('id') id: string, @Body() dto: PerformanceTaskSubmissionDto) {
    return this.service.submitFeishuAssessmentTask(principal, id, dto);
  }

  @Post('feishu-task-inbox/workflow-tasks/:id/submit')
  @Public()
  @UseGuards(FeishuTaskAuthGuard)
  submitFeishuWorkflowTask(@FeishuTask() principal: FeishuTaskPrincipal, @Param('id') id: string, @Body() dto: PerformanceWorkflowTaskSubmissionDto) {
    return this.service.submitFeishuWorkflowTask(principal, id, dto);
  }

  @Get('tasks')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  listTasks(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryPerformanceDto) { return this.service.listTasks(user, query); }

  @Get('my-tasks')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TASK_HANDLE)
  listMyTasks(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryPerformanceDto) { return this.service.listTasks(user, query, true); }

  @Get('tasks/:id')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  getTask(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.getTask(user, id); }

  @Post('tasks/:id/submit')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TASK_HANDLE)
  submitTask(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: PerformanceTaskSubmissionDto) { return this.service.submitTask(user, id, dto); }

  @Get('workflow-tasks')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  listWorkflowTasks(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryPerformanceDto) { return this.service.listWorkflowTasks(user, query); }

  @Get('my-workflow-tasks')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TASK_HANDLE)
  listMyWorkflowTasks(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryPerformanceDto) { return this.service.listWorkflowTasks(user, query, true); }

  @Post('workflow-tasks/:id/submit')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TASK_HANDLE)
  submitWorkflowTask(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: PerformanceWorkflowTaskSubmissionDto) { return this.service.submitWorkflowTask(user, id, dto); }

  @Post('feishu/card-actions')
  @Public()
  handleFeishuCardAction(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() request: Request,
  ) {
    return this.service.handleFeishuCardAction(body, headers, (request as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(body)));
  }

  @Get('results')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  listResults(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryPerformanceDto) { return this.service.listResults(user, query); }

  @Get('results/:id')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  getResult(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.getResult(id, user); }

  @Patch('results/:id')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_RESULT_MODIFY)
  modifyResult(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifyPerformanceResultDto) { return this.service.modifyResult(user, id, dto); }

  @Get('settings/employee-amount-bases')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  listEmployeeAmountBases(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeePerformanceAmountBaseDto) { return this.service.listEmployeeAmountBases(user, query); }

  @Get('settings/employee-amount-bases/:employeeId/history')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  listEmployeeAmountBaseHistory(@CurrentUser() user: AuthenticatedUser, @Param('employeeId') employeeId: string) { return this.service.listEmployeeAmountBaseHistory(user, employeeId); }

  @Post('settings/employee-amount-bases')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_AMOUNT_BASE_MANAGE)
  createEmployeeAmountBase(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEmployeePerformanceAmountBaseDto) { return this.service.createEmployeeAmountBase(user, dto); }
}
