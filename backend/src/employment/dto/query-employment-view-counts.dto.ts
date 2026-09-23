import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
  Validate,
} from 'class-validator';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isStrictBusinessDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

@ValidatorConstraint({ name: 'strictBusinessDate', async: false })
class StrictBusinessDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, _args: ValidationArguments) {
    return value === undefined || value === null || isStrictBusinessDate(value);
  }

  defaultMessage() {
    return 'businessDate must be a valid YYYY-MM-DD date';
  }
}

export class QueryEmploymentViewCountsDto {
  @ApiPropertyOptional({
    description: '统一统计业务日，必须为严格 YYYY-MM-DD 日历日期',
    example: '2026-09-18',
  })
  @IsOptional()
  @IsString()
  @Validate(StrictBusinessDateConstraint)
  businessDate?: string;

  @ApiPropertyOptional({
    description: '组织 ID；统计该组织及其下级组织',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  organizationId?: string;
}
