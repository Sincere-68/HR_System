import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class TransferProbationApprovalDto {
  @ApiProperty({ description: '新的转正审批人账号 ID' })
  @IsString()
  @MaxLength(64)
  approverUserId: string;
}
