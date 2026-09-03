import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { OnboardingService } from './onboarding.service';
import { CreateInternOfferDto } from './dto/create-intern-offer.dto';
import { QueryOnboardingListDto } from './dto/query-onboarding-list.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { EmployeeExportDto } from '../employees/dto/employee-transfer.dto';

@ApiTags('录用入职')
@ApiBearerAuth()
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Post('entries/export')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '导出入职管理列表' })
  async exportEntries(@CurrentUser() user: AuthenticatedUser, @Body() dto: EmployeeExportDto, @Res({ passthrough: true }) response: Response) {
    return this.sendExport(response, dto, await this.service.exportEntries(user, dto));
  }

  @Post('integration/export')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '导出新员工融入列表' })
  async exportIntegration(@CurrentUser() user: AuthenticatedUser, @Body() dto: EmployeeExportDto, @Res({ passthrough: true }) response: Response) {
    return this.sendExport(response, dto, await this.service.exportIntegration(user, dto));
  }

  @Post('introduction/export')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '导出新员工入职介绍列表' })
  async exportIntroduction(@CurrentUser() user: AuthenticatedUser, @Body() dto: EmployeeExportDto, @Res({ passthrough: true }) response: Response) {
    return this.sendExport(response, dto, await this.service.exportIntroduction(user, dto));
  }

  @Post('id-card-reader/export')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '导出身份证读取列表' })
  async exportIdCardReader(@CurrentUser() user: AuthenticatedUser, @Body() dto: EmployeeExportDto, @Res({ passthrough: true }) response: Response) {
    return this.sendExport(response, dto, await this.service.exportIdCardReader(user, dto));
  }

  @Post('offers/export')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '导出当前 Offer 视图' })
  async exportOffers(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EmployeeExportDto,
    @Query('view') view: QueryOffersDto['view'],
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.sendExport(response, dto, await this.service.exportOffers(user, { ...dto, query: { view } }));
  }

  private sendExport(
    response: Response,
    dto: EmployeeExportDto,
    result: { contentType: string; filename: string; buffer: Buffer },
  ) {
    response.setHeader('Content-Type', result.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="onboarding-export.${dto.format.toLocaleLowerCase()}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`);
    return new StreamableFile(result.buffer);
  }

  @Get('intern-offer-form-options')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_CREATE)
  @ApiOperation({ summary: '获取新建实习 Offer 表单选项（仅数据库模式）' })
  getInternOfferFormOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getInternOfferFormOptions(user);
  }

  @Post('intern-offers')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_CREATE)
  @ApiOperation({ summary: '新建实习 Offer 草稿（仅数据库模式）' })
  createInternOffer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInternOfferDto) {
    return this.service.createInternOffer(user, dto);
  }

  @Get('intern-conversion-options')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_CREATE)
  @ApiOperation({ summary: '获取当前范围内可选的实习转正员工（仅数据库模式）' })
  getInternConversionOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getInternConversionOptions(user);
  }

  @Get('intern-conversion-options/:employeeId')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_CREATE)
  @ApiOperation({ summary: '读取当前实习生转正 Offer 预填值（仅数据库模式）' })
  getInternConversionOfferPrefill(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId') employeeId: string,
  ) {
    return this.service.getInternConversionOfferPrefill(user, employeeId);
  }

  @Get('offers')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询录用列表（仅数据库模式）' })
  findOffers(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOffersDto) {
    return this.service.findOffers(user, query);
  }

  @Get('entries')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询入职列表（仅数据库模式）' })
  findEntries(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOnboardingListDto) {
    return this.service.findEntries(user, query);
  }

  @Get('integration')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询融入列表（仅数据库模式）' })
  findIntegration(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOnboardingListDto) {
    return this.service.findIntegration(user, query);
  }

  @Get('introduction')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询入职介绍列表（仅数据库模式）' })
  findIntroduction(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOnboardingListDto) {
    return this.service.findIntroduction(user, query);
  }

  @Get('id-card-reader')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询身份证读取列表（仅数据库模式）' })
  findIdCardReader(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOnboardingListDto) {
    return this.service.findIdCardReader(user, query);
  }
}
