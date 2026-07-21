import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoanCategory } from '@prisma/client';

// Statuts considérés comme "prêt en cours" : tant qu'un prêt est dans un de ces
// états, l'utilisateur ne peut pas soumettre une nouvelle demande.
const ONGOING_LOAN_STATUSES = ['SUBMITTED', 'APPROVED', 'DISBURSED'] as const;

@Injectable()
export class LoansService {
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  private pct(v: bigint, p: number) { return v * BigInt(Math.round(p * 100)) / 10000n; }

  simulate(amountXof: number, durationMonths: number) {
    const amount = BigInt(amountXof);
    const interest = this.pct(amount, Number(this.cfg.get('LOAN_INTEREST_PCT', 5)));
    const insurance = this.pct(amount, Number(this.cfg.get('LOAN_INSURANCE_PCT', 6.5)));
    const total = amount + interest + insurance;
    const monthly = durationMonths > 0 ? (total + BigInt(durationMonths) - 1n) / BigInt(durationMonths) : total;
    return {
      amountXof: amount.toString(), interestXof: interest.toString(), insuranceXof: insurance.toString(),
      totalDueXof: total.toString(), monthlyPaymentXof: monthly.toString(),
    };
  }

  async activeReferrals(userId: string) {
    return this.prisma.user.count({ where: { referredById: userId, membership: { status: 'ACTIVE' } } });
  }

  async ceiling(userId: string) {
    const n = await this.activeReferrals(userId);
    const unit = Number(this.cfg.getOrThrow('LOAN_REFERRAL_UNIT_XOF'));
    return { activeReferrals: n, ceilingXof: (n * unit).toString() };
  }

  // Vérifie qu'aucun prêt "en cours" n'existe déjà pour cet utilisateur.
  private async assertNoOngoingLoan(userId: string) {
    const ongoing = await this.prisma.loan.findFirst({
      where: { userId, status: { in: [...ONGOING_LOAN_STATUSES] } },
    });
    if (ongoing) {
      throw new BadRequestException('Vous avez déjà une demande de prêt en cours');
    }
  }

  async apply(userId: string, dto: { category: LoanCategory; amountXof: number; durationMonths: number; projectDescription?: string; teamUserIds?: string[] }) {
    await this.assertNoOngoingLoan(userId);

    const c = await this.ceiling(userId);
    if (BigInt(dto.amountXof) > BigInt(c.ceilingXof)) {
      throw new BadRequestException(`Amount exceeds referral ceiling ${c.ceilingXof}`);
    }
    if (dto.category === 'JSE') {
      if (!dto.projectDescription) throw new BadRequestException('Project description required for JSE');
      const referrals = await this.activeReferrals(userId);
      if (referrals < 3) throw new ForbiddenException('At least 3 active referrals required for JSE');
      const team = dto.teamUserIds ?? [];
      if (team.length < 2 || team.length > 4) throw new BadRequestException('JSE team must be 3 to 5 members total (2 to 4 additional)');
      const activeTeam = await this.prisma.user.count({ where: { id: { in: team }, membership: { status: 'ACTIVE' } } });
      if (activeTeam !== team.length) throw new BadRequestException('All team members must be active members');
    }
    const sim = this.simulate(dto.amountXof, dto.durationMonths);
    return this.prisma.loan.create({
      data: {
        userId, category: dto.category, amountXof: BigInt(dto.amountXof), durationMonths: dto.durationMonths,
        interestXof: BigInt(sim.interestXof), insuranceXof: BigInt(sim.insuranceXof),
        totalDueXof: BigInt(sim.totalDueXof), monthlyPaymentXof: BigInt(sim.monthlyPaymentXof),
        projectDescription: dto.projectDescription,
        team: dto.teamUserIds?.length ? { create: dto.teamUserIds.map((uid) => ({ userId: uid })) } : undefined,
      },
    });
  }

  list(userId: string) { return this.prisma.loan.findMany({ where: { userId }, include: { repayments: true, team: true }, orderBy: { createdAt: 'desc' } }); }

  async repay(userId: string, loanId: string, amountXof: number) {
    const l = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!l || l.userId !== userId) throw new NotFoundException();
    if (l.status !== 'DISBURSED') throw new BadRequestException('Loan not disbursed');
    return this.prisma.loanRepayment.create({ data: { loanId, amountXof: BigInt(amountXof) } });
  }

  async approve(loanId: string, adminId: string) {
    return this.prisma.loan.update({ where: { id: loanId }, data: { status: 'APPROVED', approvedAt: new Date(), approvedById: adminId } });
  }
  disburse(loanId: string) { return this.prisma.loan.update({ where: { id: loanId }, data: { status: 'DISBURSED', disbursedAt: new Date() } }); }
  reject(loanId: string) { return this.prisma.loan.update({ where: { id: loanId }, data: { status: 'REJECTED' } }); }
}