import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, MaxLength } from 'class-validator';

export class StartProbationConfirmationsDto {
  @ApiProperty({ type: [String], description: '待发起转正申请的试用记录 ID，最多 100 条' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  probationIds: string[];

  @ApiProperty({ description: '转正审批人账号 ID' })
  @IsString()
  @MaxLength(64)
  approverUserId: string;
}
