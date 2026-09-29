import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class OptionalApprovalCommentDto {
  @ApiPropertyOptional({ description: '审批意见', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  comment?: string;
}

export class RequiredApprovalCommentDto {
  @ApiProperty({ description: '审批意见', maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  comment: string;
}
