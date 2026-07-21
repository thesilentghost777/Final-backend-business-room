import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

class EnvVars {
  @IsIn(['development','production','test','staging']) NODE_ENV!: string;
  @IsInt() PORT!: number;
  @IsString() API_PREFIX!: string;
  @IsString() DATABASE_URL!: string;
  @IsString() @MinLength(32) JWT_SECRET!: string;
  @IsString() JWT_EXPIRES_IN!: string;
  @IsString() @MinLength(32) JWT_REFRESH_SECRET!: string;
  @IsString() JWT_REFRESH_EXPIRES_IN!: string;
  @IsInt() BCRYPT_ROUNDS!: number;
  @IsOptional() @IsString() FIREBASE_PROJECT_ID?: string;
  @IsOptional() @IsString() FIREBASE_CLIENT_EMAIL?: string;
  @IsOptional() @IsString() FIREBASE_PRIVATE_KEY?: string;
  @IsInt() MEMBERSHIP_FEE_XOF!: number;
  @IsInt() DAILY_SAVINGS_MULTIPLE!: number;
  @IsInt() WEEKLY_SAVINGS_MULTIPLE!: number;
  @IsInt() BLOCKED_SAVINGS_BONUS_PCT!: number;
  @IsInt() BLOCKED_SAVINGS_DAYS!: number;
  @IsInt() LOAN_REFERRAL_UNIT_XOF!: number;
  @IsInt() MARKETPLACE_DAILY_FEATURED!: number;
  @IsOptional() @IsString() MONEY_FUSION_API_URL?: string;
  @IsOptional() @IsString() MONEY_FUSION_STATUS_URL?: string;
  @IsOptional() @IsString() MONEY_FUSION_RETURN_URL?: string;
  @IsOptional() @IsString() MONEY_FUSION_WEBHOOK_URL?: string;
  @IsOptional() @IsString() MONEY_FUSION_WEBHOOK_SECRET?: string;
}

export function envValidationSchema(config: Record<string, unknown>) {
  const parsed = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length) throw new Error(`Invalid env: ${errors.toString()}`);
  return parsed;
}
