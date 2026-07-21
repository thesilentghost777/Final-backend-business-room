import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SavingsType, SavingsStatus } from '@prisma/client';
import { WalletService } from '../wallet/wallet.service';
import { WalletTxCategory, WalletTxType } from '@prisma/client';

@Injectable()
export class SavingsService {
  private readonly logger = new Logger(SavingsService.name);
  constructor(
    private prisma: PrismaService,
    private cfg: ConfigService,
    private wallet: WalletService, // nécessaire pour créditer le bonus bloqué à la création
  ) {}

  private ceilDiv(a: bigint, b: bigint) { return (a + b - 1n) / b; }

  multipleFor(type: SavingsType): bigint | null {
    if (type === 'DAILY') return BigInt(this.cfg.getOrThrow('DAILY_SAVINGS_MULTIPLE'));
    if (type === 'WEEKLY') return BigInt(this.cfg.getOrThrow('WEEKLY_SAVINGS_MULTIPLE'));
    return null;
  }

  computePlan(type: SavingsType, goalXof: number, installmentXof: number) {
    const goal = BigInt(goalXof);
    const inst = BigInt(installmentXof);
    if (inst <= 0n) throw new BadRequestException('Installment must be > 0');
    if (type === 'BLOCKED') {
      const bonusPct = BigInt(this.cfg.getOrThrow('BLOCKED_SAVINGS_BONUS_PCT'));
      return { totalToContribute: goal, installment: goal, numberOfInstallments: 1, bonus: (goal * bonusPct) / 100n };
    }
    let totalToContribute: bigint;
    if (type === 'DAILY') totalToContribute = (goal + (goal * 20n) / 100n) / 2n;
    else totalToContribute = goal + (goal * 10n) / 100n;
    const multiple = this.multipleFor(type)!;
    if (inst % multiple !== 0n) throw new BadRequestException(`Installment must be multiple of ${multiple}`);
    return {
      totalToContribute,
      installment: inst,
      numberOfInstallments: Number(this.ceilDiv(totalToContribute, inst)),
      bonus: 0n,
    };
  }

  /**
   * Règle métier : un utilisateur ne peut pas avoir 2 épargnes du même type
   * en cours simultanément. "En cours" = statut ACTIVE.
   * Si l'ancienne est COMPLETED, WITHDRAWN, CANCELLED (supprimée) -> ok d'en recréer une.
   */
  private async assertNoActiveDuplicate(userId: string, type: SavingsType) {
    const existing = await this.prisma.savings.findFirst({
      where: { userId, type, status: SavingsStatus.ACTIVE },
    });
    if (existing) {
      throw new BadRequestException(
        `Vous avez déjà une épargne ${type} en cours. Terminez-la ou supprimez-la avant d'en créer une nouvelle.`,
      );
    }
  }

  async create(userId: string, dto: { type: SavingsType; goalXof: number; installmentXof: number }) {
    await this.assertNoActiveDuplicate(userId, dto.type);

    const plan = this.computePlan(dto.type, dto.goalXof, dto.installmentXof);
    const days = Number(this.cfg.getOrThrow('BLOCKED_SAVINGS_DAYS'));

    const savings = await this.prisma.savings.create({
      data: {
        userId,
        type: dto.type,
        goalXof: BigInt(dto.goalXof),
        totalToContributeXof: plan.totalToContribute,
        installmentXof: plan.installment,
        numberOfInstallments: plan.numberOfInstallments,
        bonusXof: plan.bonus,
        maturesAt: dto.type === 'BLOCKED' ? new Date(Date.now() + days * 86400000) : null,
      },
    });

    // Règle : pour une épargne BLOQUÉE, les 25% sont reversés IMMÉDIATEMENT à la création,
    // pas dans un an. Dans un an, seul le capital bloqué (goalXof) est restitué, sans bonus.
    if (dto.type === 'BLOCKED' && plan.bonus > 0n) {
      await this.wallet.credit(userId, plan.bonus, {
        category: WalletTxCategory.SAVINGS,
        type: WalletTxType.REFUND,
        description: 'Bonus 25% versé immédiatement pour épargne bloquée',
        metadata: { savingsId: savings.id, reason: 'BLOCKED_BONUS_UPFRONT' },
      });
    }

    return savings;
  }

  async assertContributionValid(savingsId: string, userId: string, amountXof: number) {
    const s = await this.prisma.savings.findUnique({ where: { id: savingsId } });
    if (!s || s.userId !== userId) throw new NotFoundException();
    if (s.status !== 'ACTIVE') throw new BadRequestException('Savings not active');
    if (s.type === 'BLOCKED') throw new BadRequestException('Blocked savings cannot receive extra contributions');
    const mult = this.multipleFor(s.type);
    if (mult && BigInt(amountXof) % mult !== 0n) {
      throw new BadRequestException(`Le montant doit être un multiple de ${mult} FCFA`);
    }
    return s;
  }

  private sumContributions(contributions: { amountXof: bigint }[]): bigint {
    return contributions.reduce((acc, c) => acc + c.amountXof, 0n);
  }

  /**
   * Enrichit une épargne avec le solde réellement cotisé et le solde manquant,
   * et bascule automatiquement le statut à COMPLETED si l'objectif est atteint.
   */
  private async withComputedFields(s: any) {
    const contributedXof = this.sumContributions(s.contributions ?? []);
    const remainingXof =
      s.totalToContributeXof > contributedXof ? s.totalToContributeXof - contributedXof : 0n;
    const progressPct =
      s.totalToContributeXof > 0n
        ? Math.min(100, Number((contributedXof * 10000n) / s.totalToContributeXof) / 100)
        : 0;

    // Auto-complétion si l'objectif est atteint et que ce n'est pas une épargne bloquée
    if (s.status === 'ACTIVE' && s.type !== 'BLOCKED' && contributedXof >= s.totalToContributeXof) {
      await this.prisma.savings.update({ where: { id: s.id }, data: { status: 'COMPLETED' } });
      s = { ...s, status: 'COMPLETED' };
    }

    return {
      ...s,
      contributedXof,
      remainingXof,
      progressPct,
      unlockAt: s.maturesAt,
    };
  }

  async contribute(userId: string, savingsId: string, amountXof: number) {
    await this.assertContributionValid(savingsId, userId, amountXof);
    await this.prisma.savingsContribution.create({ data: { savingsId, amountXof: BigInt(amountXof) } });

    // Retourne l'état à jour (avec solde cotisé et solde manquant réels)
    return this.detail(userId, savingsId);
  }

  async list(userId: string) {
    const rows = await this.prisma.savings.findMany({
      where: { userId },
      include: { contributions: true, withdrawal: true },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(rows.map((s) => this.withComputedFields(s)));
  }

  async detail(userId: string, id: string) {
    const s = await this.prisma.savings.findUnique({
      where: { id },
      include: { contributions: true, withdrawal: true },
    });
    if (!s || s.userId !== userId) throw new NotFoundException();
    return this.withComputedFields(s);
  }

  /**
   * Règle : suppression possible UNIQUEMENT si la cotisation est encore à 0%
   * (aucune contribution enregistrée). Sinon impossible.
   */
  async remove(userId: string, savingsId: string) {
    const s = await this.prisma.savings.findUnique({
      where: { id: savingsId },
      include: { contributions: true },
    });
    if (!s || s.userId !== userId) throw new NotFoundException();

    const contributedXof = this.sumContributions(s.contributions);
    if (contributedXof > 0n) {
      throw new ForbiddenException(
        "Impossible de supprimer : cette cotisation a déjà commencé (progression > 0%).",
      );
    }

    // Si un bonus a déjà été versé (cas bloqué), il faudrait idéalement le débiter ici.
    // -> à décider avec le métier : reprendre le bonus si on annule avant terme.
    await this.prisma.savings.delete({ where: { id: savingsId } });
    return { deleted: true };
  }

  async requestWithdrawal(userId: string, savingsId: string) {
    const s = await this.detail(userId, savingsId);
    if (s.type === 'BLOCKED' && s.maturesAt && s.maturesAt > new Date()) {
      throw new ForbiddenException('Blocked savings not yet mature');
    }
    // Bonus déjà versé à la création pour BLOCKED -> on ne le recompte pas ici.
    const total =
      s.type === 'BLOCKED'
        ? s.goalXof
        : s.contributions.reduce((a: bigint, c: any) => a + c.amountXof, 0n);
    return this.prisma.savingsWithdrawal.create({ data: { savingsId, amountXof: total } });
  }

  /**
   * Cron : à maturité, une épargne BLOQUÉE reverse uniquement le capital bloqué
   * (le bonus a déjà été versé à la création). Sans intérêt supplémentaire.
   */
  async autoUnlockMatured(creditFn: (userId: string, amount: bigint, meta: any) => Promise<any>) {
    const matured = await this.prisma.savings.findMany({
      where: { type: 'BLOCKED', status: 'ACTIVE', maturesAt: { lte: new Date() } },
    });
    for (const s of matured) {
      const total = s.goalXof; // pas de bonus ici, déjà versé à la création, pas d'intérêt
      try {
        await creditFn(s.userId, total, { savingsId: s.id, reason: 'BLOCKED_UNLOCK_PRINCIPAL' });
        await this.prisma.savings.update({ where: { id: s.id }, data: { status: 'COMPLETED' } });
      } catch (e: any) {
        this.logger.error(`Auto-unlock failed for savings ${s.id}: ${e.message}`);
      }
    }
    return { unlocked: matured.length };
  }
}