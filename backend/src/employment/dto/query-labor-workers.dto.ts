import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class QueryLaborWorkersDto {
  @ApiPropertyOptional({ enum: ['on_duty', 'conversion_pending', 'converted', 'resigned'] })
  @IsOptional()
  @IsIn(['on_duty', 'conversion_pending', 'converted', 'resigned'])
  view?: 'on_duty' | 'conversion_pending' | 'converted' | 'resigned';

  @ApiPropertyOptional({ description: '劳务人员姓名或工号关键字' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  keyword?: string;

  @ApiPropertyOptional({ description: '入职日期起（含）' })
  @IsOptional()
  @IsDateString()
  entryDateFrom?: string;

  @ApiPropertyOptional({ description: '入职日期止（含）' })
  @IsOptional()
  @IsDateString()
  entryDateTo?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
