import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { AssistanceService } from '../assistance/assistance.service';
import { MembershipService } from '../membership/membership.service';
import { PartnershipService } from '../partnership/partnership.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { LoanStatus, MembershipStatus, ProfileStatus, Role } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private wallet: WalletService,
    private assistance: AssistanceService,
    private membership: MembershipService,
    private partnership: PartnershipService,
    private marketplace: MarketplaceService,
  ) {}

  async dashboard() {
    const [users, activeMembers, pendingMemberships, loans, savings, marketPosts, wallets] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.membership.count({ where: { status: 'ACTIVE' } }),
      this.prisma.membership.count({ where: { status: 'PENDING' } }),
      this.prisma.loan.count(),
      this.prisma.savings.count(),
      this.prisma.marketPost.count({ where: { status: 'ACTIVE' } }),
      this.prisma.wallet.aggregate({ _sum: { balanceXof: true } }),
    ]);
    return {
      users, activeMembers, pendingMemberships, loans, savings, marketPosts,
      totalWalletBalanceXof: (wallets._sum.balanceXof ?? 0n).toString(),
    };
  }

  users(q?: string) {
    return this.prisma.user.findMany({
      where: q
        ? { OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { matricule: { contains: q } },
          ] }
        : undefined,
      include: { membership: true, wallet: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async userDetail(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        membership: true, wallet: true, investorProfile: true, entrepreneurProfile: true,
        savings: true, loans: true, shareHoldings: true,
      },
    });
    if (!u) throw new NotFoundException();
    return u;
  }

  async updateUser(id: string, body: any) {
    const allowed: any = {};
    for (const k of ['fullName', 'email', 'phone', 'address', 'profession', 'photoUrl', 'isActive']) {
      if (body?.[k] !== undefined) allowed[k] = body[k];
    }
    return this.prisma.user.update({ where: { id }, data: allowed });
  }

  setRoles(userId: string, roles: Role[]) { return this.prisma.user.update({ where: { id: userId }, data: { roles } }); }
  setActive(userId: string, isActive: boolean) { return this.prisma.user.update({ where: { id: userId }, data: { isActive } }); }
  walletAdjust(adminId: string, userId: string, amountXof: number, reason?: string) {
    return this.wallet.adminAdjust(adminId, userId, amountXof, reason);
  }

  memberships(status?: MembershipStatus) {
    return this.prisma.membership.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { id: true, fullName: true, email: true, phone: true, matricule: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  setMembershipStatus(id: string, status: MembershipStatus, adminId: string) {
    return this.membership.adminSetStatus(id, status, adminId);
  }

  investorQueue() { return this.prisma.investorProfile.findMany({ where: { status: 'SUBMITTED' }, include: { user: true } }); }
  entrepreneurQueue() { return this.prisma.entrepreneurProfile.findMany({ where: { status: 'SUBMITTED' }, include: { user: true } }); }
  setInvestorStatus(id: string, status: ProfileStatus) {
    return this.prisma.investorProfile.update({ where: { id }, data: { status, visible: status === 'APPROVED' } });
  }
  setEntrepreneurStatus(id: string, status: ProfileStatus) {
    return this.prisma.entrepreneurProfile.update({ where: { id }, data: { status, visible: status === 'APPROVED' } });
  }

  pendingWithdrawals() {
    return this.prisma.savingsWithdrawal.findMany({
      where: { status: 'PENDING' },
      include: { savings: { include: { user: { select: { id: true, fullName: true, email: true, matricule: true } } } } },
      orderBy: { requestedAt: 'desc' },
    });
  }
  async approveWithdrawal(id: string, adminId: string) {
    const w = await this.prisma.savingsWithdrawal.findUnique({ where: { id }, include: { savings: true } });
    if (!w) throw new NotFoundException();
    return this.prisma.$transaction(async (t) => {
      const updated = await t.savingsWithdrawal.update({
        where: { id }, data: { status: 'APPROVED', processedAt: new Date(), processedById: adminId },
      });
      await t.savings.update({ where: { id: w.savingsId }, data: { status: 'WITHDRAWN' } });
      return updated;
    });
  }
  rejectWithdrawal(id: string) {
    return this.prisma.savingsWithdrawal.update({ where: { id }, data: { status: 'REJECTED', processedAt: new Date() } });
  }

  loans(status?: LoanStatus) {
    return this.prisma.loan.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { id: true, fullName: true, email: true, matricule: true } },
        team: { include: { user: { select: { id: true, fullName: true } } } },
        repayments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  approveLoan(id: string, adminId: string) {
    return this.prisma.loan.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date(), approvedById: adminId } });
  }
  disburseLoan(id: string) {
    return this.prisma.loan.update({ where: { id }, data: { status: 'DISBURSED', disbursedAt: new Date() } });
  }
  setLoanStatus(id: string, status: LoanStatus) {
    return this.prisma.loan.update({ where: { id }, data: { status } });
  }

  shareTransactions() { return this.partnership.adminTransactions(); }
  approveShareTx(id: string, adminId: string) { return this.partnership.approveTx(id, adminId); }
  rejectShareTx(id: string, adminId: string) { return this.partnership.rejectTx(id, adminId); }

  assistanceMessages() { return this.assistance.adminList(); }
  assistanceReply(id: string, adminId: string, content: string) { return this.assistance.reply(id, adminId, content); }

  marketPosts() {
    return this.prisma.marketPost.findMany({
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  removeMarketPost(id: string) { return this.prisma.marketPost.update({ where: { id }, data: { status: 'REMOVED' } }); }
  rotateMarketplace() { return this.marketplace.rotate().then((r) => ({ ok: true, ...r })); }
}
