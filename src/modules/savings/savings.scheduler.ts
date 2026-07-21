import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SavingsService } from './savings.service';
import { WalletService } from '../wallet/wallet.service';
import { WalletTxCategory, WalletTxType } from '@prisma/client';

@Injectable()
export class SavingsScheduler {
  private readonly logger = new Logger(SavingsScheduler.name);
  constructor(private savings: SavingsService, private wallet: WalletService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async unlockMatured() {
    const res = await this.savings.autoUnlockMatured(async (userId, amount, meta) => {
      await this.wallet.credit(userId, amount, {
        category: WalletTxCategory.SAVINGS,
        type: WalletTxType.REFUND,
        description: 'Déblocage épargne bloquée + bonus 25%',
        metadata: meta,
      });
    });
    if (res.unlocked > 0) this.logger.log(`Auto-unlocked ${res.unlocked} blocked savings`);
  }
}
