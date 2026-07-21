import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ReferralService {
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  async summary(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { referralCode: true, membership: { select: { status: true } } },
    });
    const total = await this.prisma.user.count({ where: { referredById: userId } });
    const active = await this.prisma.user.count({
      where: { referredById: userId, membership: { status: 'ACTIVE' } },
    });
    const unit = Number(this.cfg.get('LOAN_REFERRAL_UNIT_XOF', 50000));
    return {
      code: user.referralCode,
      referralCode: user.referralCode,
      totalReferrals: total,
      activeReferrals: active,
      loanCeilingXof: (BigInt(active) * BigInt(unit)).toString(),
      membershipStatus: user.membership?.status ?? 'INACTIVE',
    };
  }

  list(userId: string) {
    return this.prisma.user.findMany({
      where: { referredById: userId },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        matricule: true,
        createdAt: true,
        membership: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
    }).then((rows) =>
      rows.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        photoUrl: r.photoUrl,
        matricule: r.matricule,
        createdAt: r.createdAt,
        membershipStatus: r.membership?.status ?? 'INACTIVE',
      })),
    );
  }
}
