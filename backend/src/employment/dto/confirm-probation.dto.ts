import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ConfirmProbationDto {
  @ApiProperty({ description: '实际转正日期' })
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '转正日期必须为 YYYY-MM-DD' })
  confirmedDate: string;
}
