import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MoneyFusionInitResponse {
  statut: boolean;
  token: string;
  message: string;
  url: string;
}

export interface MoneyFusionStatusResponse {
  statut: boolean;
  message: string;
  data?: {
    _id: string;
    tokenPay: string;
    numeroSend?: string;
    nomclient?: string;
    numeroTransaction?: string;
    Montant?: number;
    frais?: number;
    statut: 'pending' | 'paid' | 'failure' | 'no paid' | string;
    moyen?: string;
    createdAt?: string;
    personal_Info?: any;
  };
}

/**
 * Thin wrapper around the MoneyFusion PayIn Web API.
 * https://docs.moneyfusion.net
 */
@Injectable()
export class MoneyFusionService {
  private readonly logger = new Logger(MoneyFusionService.name);

  constructor(private cfg: ConfigService) {}

  private apiUrl(): string {
    const url = this.cfg.get<string>('MONEY_FUSION_API_URL');
    if (!url) throw new ServiceUnavailableException('MoneyFusion API URL not configured');
    return url;
  }

  private statusBaseUrl(): string {
    return this.cfg.get<string>('MONEY_FUSION_STATUS_URL') ?? 'https://pay.moneyfusion.net/paiementNotif';
  }

  async initiatePayment(params: {
    totalPrice: number;
    nomclient: string;
    numeroSend: string;
    userId: string;
    walletTxId: string;
    returnUrl?: string;
    webhookUrl?: string;
  }): Promise<MoneyFusionInitResponse> {
    const body = {
      totalPrice: params.totalPrice,
      article: [{ 'Recharge Wallet Business Room': params.totalPrice }],
      personal_Info: [{ userId: params.userId, walletTxId: params.walletTxId }],
      numeroSend: params.numeroSend,
      nomclient: params.nomclient,
      return_url: params.returnUrl ?? this.cfg.get<string>('MONEY_FUSION_RETURN_URL'),
      webhook_url: params.webhookUrl ?? this.cfg.get<string>('MONEY_FUSION_WEBHOOK_URL'),
    };
    try {
      const res = await fetch(this.apiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as MoneyFusionInitResponse;
      if (!res.ok || !data?.statut) {
        this.logger.error(`MoneyFusion init failed: ${JSON.stringify(data)}`);
        throw new BadGatewayException(data?.message ?? 'MoneyFusion payment init failed');
      }
      return data;
    } catch (err: any) {
      if (err instanceof BadGatewayException || err instanceof ServiceUnavailableException) throw err;
      this.logger.error(`MoneyFusion init error: ${err.message}`);
      throw new BadGatewayException('Unable to reach MoneyFusion');
    }
  }

  async checkStatus(token: string): Promise<MoneyFusionStatusResponse> {
    try {
      const res = await fetch(`${this.statusBaseUrl()}/${token}`);
      const data = (await res.json()) as MoneyFusionStatusResponse;
      return data;
    } catch (err: any) {
      this.logger.error(`MoneyFusion status error: ${err.message}`);
      throw new BadGatewayException('Unable to check MoneyFusion status');
    }
  }
}