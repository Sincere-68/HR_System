import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class StartProbationEvaluationsDto {
  @ApiProperty({ type: [String], description: '待发起考核的试用记录 ID，最多 100 条' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  probationIds: string[];

  @ApiPropertyOptional({
    description: '试用考核类型',
    enum: ['IN_PROBATION', 'REGULARIZATION'],
    default: 'REGULARIZATION',
  })
  @IsOptional()
  @IsIn(['IN_PROBATION', 'REGULARIZATION'])
  evaluationType?: 'IN_PROBATION' | 'REGULARIZATION';
}
