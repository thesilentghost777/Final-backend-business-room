import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  Prisma,
  WalletTxCategory,
  WalletTxStatus,
  WalletTxType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { generateMatricule } from '../../common/utils/matricule.util';
import { MoneyFusionService } from './money-fusion.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private prisma: PrismaService,
    private cfg: ConfigService,
    private moneyFusion: MoneyFusionService,
  ) {}

  // ---------- Core wallet ops ----------
  async ensureWallet(userId: string, tx: Tx | PrismaService = this.prisma) {
    const client: any = tx;
    let wallet = await client.wallet.findUnique({ where: { userId } });
    if (!wallet) wallet = await client.wallet.create({ data: { userId } });
    return wallet;
  }

  async balance(userId: string) {
    const w = await this.ensureWallet(userId);
    return { walletId: w.id, balanceXof: w.balanceXof.toString(), currency: w.currency };
  }

  async transactions(userId: string, params: { limit?: number; cursor?: string } = {}) {
    const w = await this.ensureWallet(userId);
    const items = await this.prisma.walletTransaction.findMany({
      where: { walletId: w.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(params.limit ?? 50, 200),
      ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
    });
    return items;
  }

  /** Atomic credit. Returns updated wallet + tx. */
  async credit(
    userId: string,
    amountXof: bigint,
    opts: {
      category?: WalletTxCategory;
      type?: WalletTxType;
      provider?: PaymentProvider;
      reference?: string;
      description?: string;
      metadata?: any;
      tx?: Tx;
    } = {},
  ) {
    if (amountXof <= 0n) throw new BadRequestException('Amount must be > 0');
    const run = async (t: Tx) => {
      const wallet = await this.ensureWallet(userId, t);
      const newBalance = wallet.balanceXof + amountXof;
      const updated = await t.wallet.update({ where: { id: wallet.id }, data: { balanceXof: newBalance } });
      const walletTx = await t.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: opts.type ?? WalletTxType.TOPUP,
          category: opts.category ?? WalletTxCategory.TOPUP,
          amountXof,
          balanceAfterXof: newBalance,
          status: WalletTxStatus.SUCCESS,
          provider: opts.provider,
          reference: opts.reference,
          description: opts.description,
          metadata: opts.metadata,
        },
      });
      return { wallet: updated, tx: walletTx };
    };
    return opts.tx ? run(opts.tx) : this.prisma.$transaction(run);
  }

  /** Atomic debit. Throws if insufficient balance. */
  async debit(
    userId: string,
    amountXof: bigint,
    opts: {
      category: WalletTxCategory;
      description?: string;
      metadata?: any;
      reference?: string;
      tx?: Tx;
    },
  ) {
    if (amountXof <= 0n) throw new BadRequestException('Amount must be > 0');
    const run = async (t: Tx) => {
      const wallet = await this.ensureWallet(userId, t);
      if (wallet.balanceXof < amountXof) {
        throw new ForbiddenException(
          `Solde insuffisant (solde: ${wallet.balanceXof.toString()}, requis: ${amountXof.toString()})`,
        );
      }
      const newBalance = wallet.balanceXof - amountXof;
      const updated = await t.wallet.update({ where: { id: wallet.id }, data: { balanceXof: newBalance } });
      const walletTx = await t.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTxType.DEBIT,
          category: opts.category,
          amountXof,
          balanceAfterXof: newBalance,
          status: WalletTxStatus.SUCCESS,
          reference: opts.reference,
          description: opts.description,
          metadata: opts.metadata,
        },
      });
      return { wallet: updated, tx: walletTx };
    };
    return opts.tx ? run(opts.tx) : this.prisma.$transaction(run);
  }

  // ---------- Top-up (MoneyFusion) ----------
  async initiateTopup(
    userId: string,
    dto: { amountXof: number; phone?: string; fullName?: string; returnUrl?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User');
    const wallet = await this.ensureWallet(userId);

    // Create a PENDING wallet tx to reserve idempotency (settle when webhook fires).
    const pending = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTxType.TOPUP,
        category: WalletTxCategory.TOPUP,
        amountXof: BigInt(dto.amountXof),
        balanceAfterXof: wallet.balanceXof,
        status: WalletTxStatus.PENDING,
        provider: PaymentProvider.MONEY_FUSION,
        description: 'Recharge wallet via MoneyFusion',
      },
    });

    const numeroSend = dto.phone ?? user.phone ?? '';
    const nomclient = dto.fullName ?? user.fullName ?? user.email ?? 'Business Room User';
    if (!numeroSend) {
      await this.prisma.walletTransaction.update({
        where: { id: pending.id },
        data: { status: WalletTxStatus.FAILED, description: 'Numéro de téléphone requis' },
      });
      throw new BadRequestException('Numéro de téléphone requis (numeroSend)');
    }

    const init = await this.moneyFusion.initiatePayment({
      totalPrice: dto.amountXof,
      numeroSend,
      nomclient,
      userId,
      walletTxId: pending.id,
      returnUrl: dto.returnUrl,
    });

    await this.prisma.walletTransaction.update({
      where: { id: pending.id },
      data: { reference: init.token, metadata: { initUrl: init.url } },
    });

    return {
      walletTxId: pending.id,
      token: init.token,
      paymentUrl: init.url,
      status: 'PENDING',
      message: init.message,
    };
  }

  async checkTopupStatus(userId: string, token: string) {
    const tx = await this.prisma.walletTransaction.findFirst({
      where: { reference: token, wallet: { userId } },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.status === WalletTxStatus.SUCCESS) return { status: 'SUCCESS', tx };
    const remote = await this.moneyFusion.checkStatus(token);
    return this.settleFromRemote(token, remote?.data?.statut ?? 'pending', remote?.data);
  }

  /** Called by both the webhook (public) and the manual status endpoint. Idempotent. */
  async settleFromRemote(token: string, remoteStatus: string, metadata?: any) {
    const tx = await this.prisma.walletTransaction.findFirst({ where: { reference: token } });
    if (!tx) throw new NotFoundException('Wallet transaction for token not found');
    if (tx.status === WalletTxStatus.SUCCESS) {
      return { status: 'SUCCESS', message: 'Already credited', tx };
    }
    if (['paid', 'success', 'succeeded'].includes(remoteStatus.toLowerCase())) {
      const wallet = await this.prisma.wallet.findUnique({ where: { id: tx.walletId } });
      if (!wallet) throw new NotFoundException('Wallet');
      return this.prisma.$transaction(async (t) => {
        const newBalance = wallet.balanceXof + tx.amountXof;
        await t.wallet.update({ where: { id: wallet.id }, data: { balanceXof: newBalance } });
        const updated = await t.walletTransaction.update({
          where: { id: tx.id },
          data: { status: WalletTxStatus.SUCCESS, balanceAfterXof: newBalance, metadata },
        });
        return { status: 'SUCCESS', tx: updated };
      });
    }
    if (['failure', 'failed', 'no paid', 'cancelled'].includes(remoteStatus.toLowerCase())) {
      const updated = await this.prisma.walletTransaction.update({
        where: { id: tx.id },
        data: { status: WalletTxStatus.FAILED, metadata },
      });
      return { status: 'FAILED', tx: updated };
    }
    return { status: 'PENDING', tx };
  }

  // ---------- Wallet-funded feature payments ----------
  /** Pay membership fee from wallet: debit + activate + assign matricule. */
  async payMembership(userId: string) {
    const fee = BigInt(this.cfg.getOrThrow<number>('MEMBERSHIP_FEE_XOF'));
    return this.prisma.$transaction(async (t) => {
      let membership = await t.membership.findUnique({ where: { userId } });
      if (!membership) {
        membership = await t.membership.create({ data: { userId, amountXof: Number(fee) } });
      }
      if (membership.status === 'ACTIVE') throw new BadRequestException('Membership already active');
      await this.debit(userId, fee, {
        category: WalletTxCategory.MEMBERSHIP,
        description: 'Paiement adhésion Business Room',
        metadata: { membershipId: membership.id },
        tx: t,
      });
      const activated = await t.membership.update({
        where: { id: membership.id },
        data: { status: 'ACTIVE', paidAt: new Date() },
      });
      const user = await t.user.findUnique({ where: { id: userId } });
      if (user && !user.matricule) {
        await t.user.update({ where: { id: user.id }, data: { matricule: generateMatricule() } });
      }
      return activated;
    });
  }

  async paySavingsContribution(userId: string, savingsId: string, amountXof: number) {
    return this.prisma.$transaction(async (t) => {
      const s = await t.savings.findUnique({ where: { id: savingsId } });
      if (!s || s.userId !== userId) throw new NotFoundException('Savings');
      if (s.status !== 'ACTIVE') throw new BadRequestException('Savings not active');
      if (s.type === 'BLOCKED') throw new BadRequestException('Blocked savings cannot receive extra contributions');
      await this.debit(userId, BigInt(amountXof), {
        category: WalletTxCategory.SAVINGS,
        description: `Contribution épargne ${s.type}`,
        metadata: { savingsId },
        tx: t,
      });
      return t.savingsContribution.create({ data: { savingsId, amountXof: BigInt(amountXof) } });
    });
  }

  async payLoanRepayment(userId: string, loanId: string, amountXof: number) {
    return this.prisma.$transaction(async (t) => {
      const l = await t.loan.findUnique({ where: { id: loanId } });
      if (!l || l.userId !== userId) throw new NotFoundException('Loan');
      if (l.status !== 'DISBURSED') throw new BadRequestException('Loan not disbursed');
      await this.debit(userId, BigInt(amountXof), {
        category: WalletTxCategory.LOAN_REPAYMENT,
        description: 'Remboursement microcrédit',
        metadata: { loanId },
        tx: t,
      });
      return t.loanRepayment.create({ data: { loanId, amountXof: BigInt(amountXof) } });
    });
  }

  async paySharePack(userId: string, packId: string) {
    return this.prisma.$transaction(async (t) => {
      const pack = await t.sharePack.findUnique({ where: { id: packId } });
      if (!pack || !pack.active) throw new NotFoundException('Pack');
      const total = pack.unitPriceXof * BigInt(pack.sharesIncluded);
      await this.debit(userId, total, {
        category: WalletTxCategory.SHARE_BUY,
        description: `Achat pack CFPAM ${pack.name}`,
        metadata: { packId },
        tx: t,
      });
      // Payment settled → create a SETTLED share tx and update holdings immediately.
      const holding = await t.shareHolding.upsert({
        where: { userId }, update: {}, create: { userId, shares: 0 },
      });
      await t.shareHolding.update({
        where: { userId }, data: { shares: holding.shares + pack.sharesIncluded },
      });
      return t.shareTransaction.create({
        data: {
          userId, packId: pack.id, type: 'BUY',
          shares: pack.sharesIncluded, unitPriceXof: pack.unitPriceXof, totalXof: total,
          status: 'SETTLED', processedAt: new Date(),
        },
      });
    });
  }

  // ---------- Admin ----------
  async adminAdjust(adminId: string, userId: string, amountXof: number, reason?: string) {
    const abs = BigInt(Math.abs(amountXof));
    if (abs === 0n) throw new BadRequestException('Amount required');
    if (amountXof > 0) {
      return this.credit(userId, abs, {
        category: WalletTxCategory.ADJUSTMENT,
        type: WalletTxType.ADJUSTMENT,
        description: reason ?? 'Ajustement manuel (admin)',
        metadata: { adminId },
      });
    }
    return this.debit(userId, abs, {
      category: WalletTxCategory.ADJUSTMENT,
      description: reason ?? 'Ajustement manuel (admin)',
      metadata: { adminId },
    });
  }
}