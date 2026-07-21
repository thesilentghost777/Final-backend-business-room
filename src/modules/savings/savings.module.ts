import { Module } from '@nestjs/common';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { SavingsScheduler } from './savings.scheduler';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [SavingsController],
  providers: [SavingsService, SavingsScheduler],
  exports: [SavingsService],
})
export class SavingsModule {}
