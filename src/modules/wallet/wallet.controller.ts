import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MembershipActiveGuard } from '../../common/guards/membership-active.guard';
import { Role } from '@prisma/client';
import { WalletService } from './wallet.service';
import {
  AdjustBalanceDto,
  MoneyFusionWebhookDto,
  PayLoanDto,
  PaySavingsDto,
  TopupDto,
} from './dto/wallet.dto';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private wallet: WalletService, private cfg: ConfigService) {}

  // -- Read --
  @Get() balance(@CurrentUser() u: any) { return this.wallet.balance(u.id); }

  @Get('transactions')
  transactions(@CurrentUser() u: any, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.wallet.transactions(u.id, { limit: limit ? Number(limit) : undefined, cursor });
  }

  // -- Top-up --
  @Post('topup')
  topup(@CurrentUser() u: any, @Body() dto: TopupDto) {
    return this.wallet.initiateTopup(u.id, dto);
  }

  @Get('topup/:token/status')
  topupStatus(@CurrentUser() u: any, @Param('token') token: string) {
    return this.wallet.checkTopupStatus(u.id, token);
  }

  // -- Pay from wallet --
  // Intentionally NOT membership-gated (used to pay the fee itself).
  @Post('pay/membership')
  payMembership(@CurrentUser() u: any) { return this.wallet.payMembership(u.id); }

  @Post('pay/savings/:id')
  paySavings(@CurrentUser() u: any, @Param('id') id: string, @Body() dto: PaySavingsDto) {
    return this.wallet.paySavingsContribution(u.id, id, dto.amountXof);
  }

  @Post('pay/loans/:id/repayment')
  payLoan(@CurrentUser() u: any, @Param('id') id: string, @Body() dto: PayLoanDto) {
    return this.wallet.payLoanRepayment(u.id, id, dto.amountXof);
  }

  @Post('pay/share-packs/:packId')
  paySharePack(@CurrentUser() u: any, @Param('packId') packId: string) {
    return this.wallet.paySharePack(u.id, packId);
  }

  // -- Admin --
  @Roles(Role.ADMIN, Role.SUPER_ADMIN_CFPAM)
  @Post('admin/:userId/adjust')
  adjust(@CurrentUser() admin: any, @Param('userId') userId: string, @Body() dto: AdjustBalanceDto) {
    return this.wallet.adminAdjust(admin.id, userId, dto.amountXof, dto.reason);
  }

  // -- Public webhook (MoneyFusion → us) --
  @Public()
  @Post('webhook/moneyfusion')
  @HttpCode(200)
  async webhook(@Body() body: MoneyFusionWebhookDto, @Headers('x-webhook-secret') secret?: string) {
    const expected = this.cfg.get<string>('MONEY_FUSION_WEBHOOK_SECRET');
    if (expected && secret !== expected) throw new UnauthorizedException('Invalid webhook secret');
    const token = body.tokenPay ?? body.token;
    if (!token) return { received: true, ignored: 'missing token' };
    const status = (body.statut ?? '').toString();
    return this.wallet.settleFromRemote(token, status, body);
  }
}