import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateEmployeePerformanceAmountBaseDto, CreatePerformanceCycleDto, CreatePerformanceTemplateDto, ModifyPerformanceResultDto, ParsePerformanceTemplateDto, PerformanceTaskSubmissionDto, QueryEmployeePerformanceAmountBaseDto, QueryPerformanceDto } from './dto/performance.dto';
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

  @Post('templates/:id/versions')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE)
  createTemplateVersion(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreatePerformanceTemplateDto) { return this.service.createTemplateVersion(user, id, dto); }

  @Post('templates/:id/versions/:versionId/publish')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE)
  publishTemplateVersion(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('versionId') versionId: string) { return this.service.publishTemplateVersion(user, id, versionId); }

  @Get('options')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE)
  getOptions() { return this.service.getOptions(); }

  @Get('cycles')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  listCycles(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryPerformanceDto) { return this.service.listCycles(user, query); }

  @Get('cycles/:id')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_READ)
  getCycle(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.getCycle(id, user); }

  @Post('cycles')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE)
  createCycle(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePerformanceCycleDto) { return this.service.createCycle(user, dto); }

  @Post('cycles/:id/start')
  @RequirePermissions(PERMISSIONS.PERFORMANCE_CYCLE_MANAGE)
  startCycle(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.startCycle(user, id); }

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
