import { IsInt, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class TopupDto {
  @IsInt() @IsPositive() @Min(100) amountXof!: number;
  @IsOptional() @IsString() @MaxLength(64) phone?: string;
  @IsOptional() @IsString() @MaxLength(128) fullName?: string;
  @IsOptional() @IsString() returnUrl?: string;
}

export class PaySavingsDto {
  @IsInt() @IsPositive() amountXof!: number;
}

export class PayLoanDto {
  @IsInt() @IsPositive() amountXof!: number;
}

export class AdjustBalanceDto {
  @IsInt() amountXof!: number; // may be negative for debit adjustment
  @IsOptional() @IsString() reason?: string;
}

// Payload received by the webhook (MoneyFusion posts transaction details)
export class MoneyFusionWebhookDto {
  @IsOptional() @IsString() tokenPay?: string;
  @IsOptional() @IsString() token?: string;
  @IsOptional() @IsString() statut?: string;
  @IsOptional() @IsString() numeroTransaction?: string;
  @IsOptional() @IsString() moyen?: string;
  @IsOptional() @IsString() numeroSend?: string;
  @IsOptional() @IsString() nomclient?: string;
  @IsOptional() Montant?: number;
  @IsOptional() frais?: number;
  @IsOptional() personal_Info?: any;
}