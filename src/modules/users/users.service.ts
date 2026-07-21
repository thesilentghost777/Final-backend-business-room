import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  async me(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { membership: true },
    });
    if (!u) throw new NotFoundException();
    const [activeReferrals, totalReferrals, wallet] = await Promise.all([
      this.prisma.user.count({ where: { referredById: id, membership: { status: 'ACTIVE' } } }),
      this.prisma.user.count({ where: { referredById: id } }),
      this.prisma.wallet.findUnique({ where: { userId: id } }),
    ]);
    const unit = Number(this.cfg.get('LOAN_REFERRAL_UNIT_XOF', 50000));
    const { passwordHash, ...rest } = u as any;
    return {
      ...rest,
      activeReferrals,
      totalReferrals,
      membershipStatus: u.membership?.status ?? 'INACTIVE',
      loanCeilingXof: (BigInt(activeReferrals) * BigInt(unit)).toString(),
      walletBalanceXof: (wallet?.balanceXof ?? 0n).toString(),
    };
  }

  async updateMe(id: string, data: any) {
    const allowed: any = {};
    for (const k of ['fullName', 'phone', 'address', 'profession', 'photoUrl']) {
      if (data?.[k] !== undefined) allowed[k] = data[k];
    }
    if (Object.keys(allowed).length) {
      const hasProfile = Boolean(
        (allowed.fullName ?? (await this.prisma.user.findUnique({ where: { id } }))?.fullName) &&
          (allowed.address ?? true) &&
          (allowed.profession ?? true),
      );
      await this.prisma.user.update({
        where: { id },
        data: { ...allowed, ...(hasProfile ? { profileCompleted: true } : {}) },
      });
    }
    return this.me(id);
  }
}
