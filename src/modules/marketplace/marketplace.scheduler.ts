import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MarketplaceService } from './marketplace.service';

@Injectable()
export class MarketplaceScheduler {
  private readonly logger = new Logger(MarketplaceScheduler.name);
  constructor(private svc: MarketplaceService) {}
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async daily() { const r = await this.svc.rotate(); this.logger.log(`Marketplace rotation: ${r.rotated}`); }
}
