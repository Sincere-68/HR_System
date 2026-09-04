import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'administrator' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  username: string;

  @ApiProperty({ example: '<管理员密码>' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
