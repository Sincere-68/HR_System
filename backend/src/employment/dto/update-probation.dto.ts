import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateProbationDto {
  @ApiPropertyOptional({ description: '试用开始日期' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '试用开始日期必须为 YYYY-MM-DD' })
  startDate?: string;

  @ApiPropertyOptional({ description: '预计试用结束日期' })
  @IsOptional()
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '预计试用结束日期必须为 YYYY-MM-DD' })
  plannedEndDate?: string;
}
