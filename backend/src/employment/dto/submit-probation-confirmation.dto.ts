import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

function trim({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class SubmitProbationConfirmationDto {
  @ApiProperty({ description: '试用考核评价' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  evaluation: string;

  @ApiProperty({ description: '转正审批人账号 ID' })
  @IsString()
  @MaxLength(64)
  approverUserId: string;
}
