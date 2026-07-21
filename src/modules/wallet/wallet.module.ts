import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { MoneyFusionService } from './money-fusion.service';

@Module({
  providers: [WalletService, MoneyFusionService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}