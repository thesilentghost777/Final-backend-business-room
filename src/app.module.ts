import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MembershipModule } from './modules/membership/membership.module';
import { ReferralModule } from './modules/referral/referral.module';
import { SavingsModule } from './modules/savings/savings.module';
import { InvestorsModule } from './modules/investors/investors.module';
import { EntrepreneursModule } from './modules/entrepreneurs/entrepreneurs.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { PartnershipModule } from './modules/partnership/partnership.module';
import { CashbookModule } from './modules/cashbook/cashbook.module';
import { LoansModule } from './modules/loans/loans.module';
import { AssistanceModule } from './modules/assistance/assistance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { envValidationSchema } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { MatchingModule }from './modules/matching/matching.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: envValidationSchema }),
    ThrottlerModule.forRootAsync({
      useFactory: () => [{
        ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT ?? 100),
      }],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule, UsersModule, MembershipModule, ReferralModule,
    SavingsModule, InvestorsModule, EntrepreneursModule, MarketplaceModule,
    PartnershipModule, CashbookModule, LoansModule, AssistanceModule,
    NotificationsModule, AdminModule, WalletModule, MatchingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
