import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class EndPartTimeRecordDto {
  @ApiProperty({ description: '结束日期，Asia/Shanghai 日历日' })
  @IsDateString()
  @Matches(DATE_ONLY_PATTERN, { message: '兼职结束日期必须为 YYYY-MM-DD' })
  endDate!: string;
}
