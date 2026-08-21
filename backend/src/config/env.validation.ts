import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, Min, MinLength, validateSync } from 'class-validator';

export const DEMO_JWT_SECRET = 'hr-personnel-demo-local-secret-2026';

class EnvironmentVariables {
  @Transform(({ value }) => value === undefined || value === ''
    ? true
    : !['false', '0', 'no', 'off'].includes(String(value).toLowerCase()), { toClassOnly: true })
  @IsBoolean()
  DEMO_MODE = true;

  @IsOptional()
  @IsString()
  @MinLength(1)
  DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  @MinLength(32, { message: 'JWT_SECRET 至少需要 32 个字符' })
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN = '8h';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsOptional()
  @IsUrl({ require_tld: false })
  FRONTEND_URL = 'http://localhost:5173';
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(errors.map((error) => Object.values(error.constraints ?? {}).join(', ')).join('; '));
  }
  if (!validated.DEMO_MODE) {
    if (!validated.DATABASE_URL) throw new Error('关闭演示模式后必须设置 DATABASE_URL');
    if (!validated.JWT_SECRET) throw new Error('关闭演示模式后必须设置 JWT_SECRET');
  }
  return validated;
}
