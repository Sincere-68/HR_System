import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class StartProbationEvaluationDto {
  @ApiPropertyOptional({
    description: '试用考核类型',
    enum: ['IN_PROBATION', 'REGULARIZATION'],
    default: 'REGULARIZATION',
  })
  @IsOptional()
  @IsIn(['IN_PROBATION', 'REGULARIZATION'])
  evaluationType?: 'IN_PROBATION' | 'REGULARIZATION';
}
