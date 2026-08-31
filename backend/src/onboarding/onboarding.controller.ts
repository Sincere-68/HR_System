import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@hr-demo/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { OnboardingService } from './onboarding.service';
import { QueryOnboardingListDto } from './dto/query-onboarding-list.dto';
import { QueryOffersDto } from './dto/query-offers.dto';

@ApiTags('录用入职')
@ApiBearerAuth()
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Get('offers')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询录用列表（仅 MySQL 模式）' })
  findOffers(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOffersDto) {
    return this.service.findOffers(user, query);
  }

  @Get('entries')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询入职列表（仅 MySQL 模式）' })
  findEntries(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOnboardingListDto) {
    return this.service.findEntries(user, query);
  }

  @Get('integration')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询融入列表（仅 MySQL 模式）' })
  findIntegration(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOnboardingListDto) {
    return this.service.findIntegration(user, query);
  }

  @Get('introduction')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询入职介绍列表（仅 MySQL 模式）' })
  findIntroduction(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOnboardingListDto) {
    return this.service.findIntroduction(user, query);
  }

  @Get('id-card-reader')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiOperation({ summary: '分页查询身份证读取列表（仅 MySQL 模式）' })
  findIdCardReader(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryOnboardingListDto) {
    return this.service.findIdCardReader(user, query);
  }
}
