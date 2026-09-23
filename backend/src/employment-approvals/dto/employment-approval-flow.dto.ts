import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalFlowNodeAssigneeKind } from '@prisma/client';

export class EmploymentApprovalFlowNodeDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  stepOrder: number;

  @ApiProperty({ enum: ApprovalFlowNodeAssigneeKind })
  @IsEnum(ApprovalFlowNodeAssigneeKind)
  assigneeKind: ApprovalFlowNodeAssigneeKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  assigneeUserId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  assigneeRoleId?: string | null;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  assigneeRule?: Record<string, unknown> | null;
}

export class CreateEmploymentApprovalFlowDefinitionDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessType: string;

  @ApiProperty({ maxLength: 191 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  code: string;

  @ApiProperty({ maxLength: 191 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  name: string;

  @ApiProperty({ type: [EmploymentApprovalFlowNodeDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EmploymentApprovalFlowNodeDto)
  nodes: EmploymentApprovalFlowNodeDto[];
}

export class CreateEmploymentApprovalFlowVersionDto {
  @ApiProperty({ type: [EmploymentApprovalFlowNodeDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EmploymentApprovalFlowNodeDto)
  nodes: EmploymentApprovalFlowNodeDto[];
}

export class UpdateEmploymentApprovalFlowDefinitionDto {
  @ApiPropertyOptional({ maxLength: 191 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  name?: string;

  @ApiPropertyOptional({ type: [EmploymentApprovalFlowNodeDto], minItems: 1 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EmploymentApprovalFlowNodeDto)
  nodes?: EmploymentApprovalFlowNodeDto[];
}

export class UpdateEmploymentApprovalFlowVersionDto {
  @ApiProperty({ type: [EmploymentApprovalFlowNodeDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EmploymentApprovalFlowNodeDto)
  nodes: EmploymentApprovalFlowNodeDto[];
}
