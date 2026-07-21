import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { LoanStatus, MembershipStatus, Role, ProfileStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN_CFPAM)
@Controller('admin')
export class AdminController {
  constructor(private svc: AdminService) {}

  // Dashboard + users
  @Get('dashboard') dashboard() { return this.svc.dashboard(); }
  @Get('users') users(@Query('q') q?: string) { return this.svc.users(q); }
  @Get('users/:id') user(@Param('id') id: string) { return this.svc.userDetail(id); }
  @Patch('users/:id') updateUser(@Param('id') id: string, @Body() body: any) { return this.svc.updateUser(id, body); }
  @Post('users/:id/roles') setRoles(@Param('id') id: string, @Body('roles') roles: Role[]) { return this.svc.setRoles(id, roles); }
  @Post('users/:id/deactivate') deactivate(@Param('id') id: string) { return this.svc.setActive(id, false); }
  @Post('users/:id/activate') activate(@Param('id') id: string) { return this.svc.setActive(id, true); }
  @Post('users/:id/wallet/adjust') walletAdjust(@CurrentUser() u: any, @Param('id') id: string, @Body() body: { amountXof: number; reason?: string }) {
    return this.svc.walletAdjust(u.id, id, body.amountXof, body.reason);
  }

  // Membership
  @Get('memberships') memberships(@Query('status') s?: MembershipStatus) { return this.svc.memberships(s); }
  @Post('memberships/:id/set-status') setMembership(@CurrentUser() u: any, @Param('id') id: string, @Body('status') s: MembershipStatus) {
    return this.svc.setMembershipStatus(id, s, u.id);
  }

  // Investors / Entrepreneurs queues
  @Get('queue/investors') invQ() { return this.svc.investorQueue(); }
  @Get('queue/entrepreneurs') entQ() { return this.svc.entrepreneurQueue(); }
  @Post('queue/investors/:id/approve') apI(@Param('id') id: string) { return this.svc.setInvestorStatus(id, 'APPROVED'); }
  @Post('queue/investors/:id/reject') rjI(@Param('id') id: string) { return this.svc.setInvestorStatus(id, 'REJECTED'); }
  @Post('queue/entrepreneurs/:id/approve') apE(@Param('id') id: string) { return this.svc.setEntrepreneurStatus(id, 'APPROVED'); }
  @Post('queue/entrepreneurs/:id/reject') rjE(@Param('id') id: string) { return this.svc.setEntrepreneurStatus(id, 'REJECTED'); }
  @Post('queue/investors/:id/set-status') setInvStatus(@Param('id') id: string, @Body('status') s: ProfileStatus) { return this.svc.setInvestorStatus(id, s); }
  @Post('queue/entrepreneurs/:id/set-status') setEntStatus(@Param('id') id: string, @Body('status') s: ProfileStatus) { return this.svc.setEntrepreneurStatus(id, s); }

  // Withdrawals
  @Get('withdrawals') w() { return this.svc.pendingWithdrawals(); }
  @Post('withdrawals/:id/approve') apW(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.approveWithdrawal(id, u.id); }
  @Post('withdrawals/:id/reject') rjW(@Param('id') id: string) { return this.svc.rejectWithdrawal(id); }

  // Loans
  @Get('loans') loans(@Query('status') s?: LoanStatus) { return this.svc.loans(s); }
  @Post('loans/:id/approve') apLoan(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.approveLoan(id, u.id); }
  @Post('loans/:id/reject') rjLoan(@Param('id') id: string) { return this.svc.setLoanStatus(id, 'REJECTED'); }
  @Post('loans/:id/disburse') dsLoan(@Param('id') id: string) { return this.svc.disburseLoan(id); }
  @Post('loans/:id/set-status') stLoan(@Param('id') id: string, @Body('status') s: LoanStatus) { return this.svc.setLoanStatus(id, s); }

  // Partnership
  @Get('partnership/transactions') pShares() { return this.svc.shareTransactions(); }
  @Post('partnership/transactions/:id/approve') apShare(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.approveShareTx(id, u.id); }
  @Post('partnership/transactions/:id/reject') rjShare(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.rejectShareTx(id, u.id); }

  // Assistance
  @Get('assistance/messages') aMsgs() { return this.svc.assistanceMessages(); }
  @Post('assistance/messages/:id/reply') aReply(@Param('id') id: string, @Body('content') content: string, @CurrentUser() u: any) {
    return this.svc.assistanceReply(id, u.id, content);
  }

  // Marketplace
  @Get('marketplace/posts') mPosts() { return this.svc.marketPosts(); }
  @Delete('marketplace/posts/:id') mRemove(@Param('id') id: string) { return this.svc.removeMarketPost(id); }
  @Post('marketplace/rotate') mRotate() { return this.svc.rotateMarketplace(); }
}
