import { Body, Controller, Get, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
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

  private sendExport(response: Response, dto: EmployeeExportDto, result: { contentType: string; filename: string; buffer: Buffer }) {
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
