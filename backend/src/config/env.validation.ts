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

  @Transform(({ value }) => ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase()), { toClassOnly: true })
  @IsBoolean()
  FEISHU_ENABLED = false;

  @IsOptional()
  @IsString()
  FEISHU_APP_ID?: string;

  @IsOptional()
  @IsString()
  FEISHU_APP_SECRET?: string;

  @Transform(({ value }) => ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase()), { toClassOnly: true })
  @IsBoolean()
  FEISHU_LONG_CONNECTION_ENABLED = false;

  /** Server-only verification secret configured in the Feishu callback settings. */
  @IsOptional()
  @IsString()
  FEISHU_VERIFICATION_TOKEN?: string;

  /** Server-only Encrypt Key configured in the Feishu callback settings. */
  @IsOptional()
  @IsString()
  FEISHU_ENCRYPT_KEY?: string;

  /** OAuth callback URL registered for the Feishu web login entry. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  FEISHU_OAUTH_REDIRECT_URI?: string;

  /** Public frontend URL used by the Feishu task inbox callback page. */
  @IsOptional()
  @IsUrl({ require_tld: false })
  FEISHU_TASK_INBOX_URL?: string;

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
  if (validated.FEISHU_ENABLED && (!validated.FEISHU_APP_ID || !validated.FEISHU_APP_SECRET)) {
    throw new Error('启用飞书推送后必须设置 FEISHU_APP_ID 和 FEISHU_APP_SECRET');
  }
  if (validated.FEISHU_ENCRYPT_KEY && !validated.FEISHU_VERIFICATION_TOKEN) {
    throw new Error('配置 FEISHU_ENCRYPT_KEY 时必须同时设置 FEISHU_VERIFICATION_TOKEN');
  }
  if (validated.FEISHU_TASK_INBOX_URL && !validated.FEISHU_OAUTH_REDIRECT_URI) {
    throw new Error('配置 FEISHU_TASK_INBOX_URL 时必须同时设置 FEISHU_OAUTH_REDIRECT_URI');
  }
  return validated;
}
