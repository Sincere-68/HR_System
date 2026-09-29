import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Request } from 'express';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { QueryEmployeeMovementsDto } from './dto/query-employee-movements.dto';
import { QueryEmploymentRecordsDto } from './dto/query-employment-records.dto';
import { QueryInternsDto } from './dto/query-interns.dto';
import { QueryLaborWorkersDto } from './dto/query-labor-workers.dto';
import { QueryPartTimeDto } from './dto/query-part-time.dto';
import { QueryProbationDto } from './dto/query-probation.dto';
import { ProbationExportDto, ProbationTransferFormatDto } from './dto/probation-transfer.dto';
import { UpdateProbationDto } from './dto/update-probation.dto';
import { SubmitProbationConfirmationDto } from './dto/submit-probation-confirmation.dto';
import { ConfirmProbationDto } from './dto/confirm-probation.dto';
import { StartProbationEvaluationsDto } from './dto/start-probation-evaluations.dto';
import { StartProbationEvaluationDto } from './dto/start-probation-evaluation.dto';
import { StartProbationConfirmationsDto } from './dto/start-probation-confirmations.dto';
import { TransferProbationApprovalDto } from './dto/transfer-probation-approval.dto';
import { QueryRetirementsDto } from './dto/query-retirements.dto';
import { QueryTrialPostDto } from './dto/query-trial-post.dto';
import { QueryTerminationsDto } from './dto/query-terminations.dto';
import { QueryPersonnelLaborWorkersDto } from './dto/query-personnel-labor-workers.dto';
import { QueryPersonnelResignedDto } from './dto/query-personnel-resigned.dto';
import { EmployeeExportDto } from '../employees/dto/employee-transfer.dto';
import { EmploymentService } from './employment.service';
import { PersonnelLaborWorkersService } from './personnel-labor-workers.service';
import { PersonnelResignedService } from './personnel-resigned.service';

@ApiTags('任职管理')
@ApiBearerAuth()
@Controller('employment')
export class EmploymentController {
  constructor(
    private readonly service: EmploymentService,
    private readonly personnelLaborWorkers: PersonnelLaborWorkersService,
    private readonly personnelResigned: PersonnelResignedService,
  ) {}

  @Post('interns/export')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '导出人员页实习生列表' })
  async exportInterns(@CurrentUser() user: AuthenticatedUser, @Body() dto: EmployeeExportDto, @Res({ passthrough: true }) response: Response) {
    return this.sendExport(response, dto, await this.service.exportInterns(user, dto));
  }

  @Post('personnel-labor-workers/export')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '导出人员页劳务人员列表' })
  async exportPersonnelLaborWorkers(@CurrentUser() user: AuthenticatedUser, @Body() dto: EmployeeExportDto, @Res({ passthrough: true }) response: Response) {
    return this.sendExport(response, dto, await this.personnelLaborWorkers.exportAll(user, dto));
  }

  @Post('personnel-resigned/export')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '导出人员页离职人员列表' })
  async exportPersonnelResigned(@CurrentUser() user: AuthenticatedUser, @Body() dto: EmployeeExportDto, @Res({ passthrough: true }) response: Response) {
    return this.sendExport(response, dto, await this.personnelResigned.exportAll(user, dto));
  }

  private sendExport(
    response: Response,
    dto: { format: 'XLSX' | 'CSV' },
    result: { contentType: string; filename: string; buffer: Buffer },
  ) {
    response.setHeader('Content-Type', result.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="employment-export.${dto.format.toLocaleLowerCase()}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`);
    return new StreamableFile(result.buffer);
  }

  @Get('records')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询任职记录（仅数据库模式；默认当前有效记录）' })
  findEmploymentRecords(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmploymentRecordsDto) {
    return this.service.findEmploymentRecords(user, query);
  }

  @Get('interns')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询当前实习任职周期（仅数据库模式）' })
  findInterns(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryInternsDto) {
    return this.service.findInterns(user, query);
  }

  @Get('labor-workers')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询当前劳务人员任职周期（仅数据库模式）' })
  findLaborWorkers(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryLaborWorkersDto) {
    return this.service.findLaborWorkers(user, query);
  }

  @Get('personnel-labor-workers')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询人员页当前劳务人员（仅数据库模式，只读）' })
  findPersonnelLaborWorkers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryPersonnelLaborWorkersDto,
  ) {
    return this.personnelLaborWorkers.findAll(user, query);
  }

  @Get('personnel-resigned')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询人员页已完成离职人员（仅数据库模式，只读）' })
  findPersonnelResigned(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryPersonnelResignedDto,
  ) {
    return this.personnelResigned.findAll(user, query);
  }

  @Get('part-time')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询当前兼职任职关系（仅数据库模式）' })
  findPartTime(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryPartTimeDto) {
    return this.service.findPartTime(user, query);
  }

  @Get('probation')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询试用管理列表（仅数据库模式）' })
  findProbation(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryProbationDto) {
    return this.service.findProbation(user, query);
  }

  @Get('probation/approvers')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '查询可选的转正审批人' })
  findProbationApprovers(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findProbationApprovers(user);
  }

  @Post('probation/import-template')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '下载试用管理导入模板' })
  async probationImportTemplate(
    @Body() dto: ProbationTransferFormatDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.getProbationImportTemplate(dto.format);
    response.setHeader('Content-Type', result.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="probation-import-template.${dto.format.toLocaleLowerCase()}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    );
    return new StreamableFile(result.buffer);
  }

  @Post('probation/import')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: '导入试用记录并校验员工任职信息' })
  importProbation(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
    @Ip() ipAddress: string,
    @Req() request: Request,
  ) {
    return this.service.importProbation(user, file, {
      userId: user.id,
      ipAddress,
      userAgent: request.get('user-agent'),
    });
  }

  @Post('probation/export')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '按当前筛选或已勾选记录导出试用管理列表' })
  async exportProbation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProbationExportDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.sendExport(response, dto, await this.service.exportProbation(user, dto));
  }

  @Patch('probation/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '编辑试用开始日期或预计结束日期' })
  updateProbation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProbationDto,
  ) {
    return this.service.updateProbation(user, id, dto);
  }

  @Post('probation/evaluations')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '批量发起试用考核' })
  startProbationEvaluations(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartProbationEvaluationsDto,
  ) {
    return this.service.startProbationEvaluations(user, dto);
  }

  @Post('probation/:id/evaluation')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '发起单个试用考核' })
  startProbationEvaluation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: StartProbationEvaluationDto,
  ) {
    return this.service.startProbationEvaluation(user, id, dto);
  }

  @Post('probation/confirmations')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '批量发起员工转正申请' })
  startProbationConfirmations(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartProbationConfirmationsDto,
  ) {
    return this.service.startProbationConfirmations(user, dto);
  }

  @Post('probation/:id/submit-confirmation')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '提交试用考核评价并进入转正确认队列' })
  submitProbationConfirmation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitProbationConfirmationDto,
  ) {
    return this.service.submitProbationConfirmation(user, id, dto);
  }

  @Post('probation/:id/confirm')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '审批通过后生效员工转正并同步任职状态' })
  confirmProbation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConfirmProbationDto,
  ) {
    return this.service.confirmProbation(user, id, dto);
  }

  @Post('probation/:id/approval/approve')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '审批通过员工转正申请' })
  approveProbation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.approveProbation(user, id);
  }

  @Post('probation/:id/approval/reminders')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '记录对当前转正审批人的催办' })
  remindProbationApproval(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.remindProbationApproval(user, id);
  }

  @Post('probation/:id/approval/transfer')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '转交当前转正审批节点' })
  transferProbationApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransferProbationApprovalDto,
  ) {
    return this.service.transferProbationApproval(user, id, dto);
  }

  @Post('probation/:id/return-to-evaluation')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_UPDATE)
  @ApiOperation({ summary: '将待确认转正记录退回考核' })
  returnProbationToEvaluation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.returnProbationToEvaluation(user, id);
  }

  @Get('movements')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询员工异动记录（仅数据库模式）' })
  findMovements(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryEmployeeMovementsDto) {
    return this.service.findMovements(user, query);
  }

  @Get('trial-posts')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询试岗期记录（仅数据库模式）' })
  findTrialPosts(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryTrialPostDto) {
    return this.service.findTrialPosts(user, query);
  }

  @Get('terminations')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询离职记录（仅数据库模式）' })
  findTerminations(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryTerminationsDto) {
    return this.service.findTerminations(user, query);
  }

  @Get('retirements')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询退休记录（仅数据库模式）' })
  findRetirements(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryRetirementsDto) {
    return this.service.findRetirements(user, query);
  }
}
