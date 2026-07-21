import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { WalletModule } from '../wallet/wallet.module';
import { AssistanceModule } from '../assistance/assistance.module';
import { MembershipModule } from '../membership/membership.module';
import { PartnershipModule } from '../partnership/partnership.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';

@Module({
  imports: [WalletModule, AssistanceModule, MembershipModule, PartnershipModule, MarketplaceModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
