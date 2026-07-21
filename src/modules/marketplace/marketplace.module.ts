import { Module } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceScheduler } from './marketplace.scheduler';
@Module({
  controllers: [MarketplaceController],
  providers: [MarketplaceService, MarketplaceScheduler],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
