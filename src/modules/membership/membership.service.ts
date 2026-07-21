import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { generateMatricule } from '../../common/utils/matricule.util';
import { MembershipStatus } from '@prisma/client';

@Injectable()
export class MembershipService {
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  async request(userId: string) {
    const existing = await this.prisma.membership.findUnique({ where: { userId } });
    if (existing) return existing;
    const fee = Number(this.cfg.getOrThrow('MEMBERSHIP_FEE_XOF'));
    return this.prisma.membership.create({ data: { userId, amountXof: fee } });
  }

  async validate(membershipId: string, adminId: string) {
    const m = await this.prisma.membership.findUnique({ where: { id: membershipId } });
    if (!m) throw new NotFoundException();
    if (m.status === 'ACTIVE') throw new BadRequestException('Already active');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.membership.update({
        where: { id: membershipId },
        data: { status: 'ACTIVE', paidAt: new Date(), validatedById: adminId },
      });
      const user = await tx.user.findUnique({ where: { id: m.userId } });
      if (user && !user.matricule) {
        await tx.user.update({ where: { id: user.id }, data: { matricule: generateMatricule() } });
      }
      return updated;
    });
  }

  reject(id: string) { return this.prisma.membership.update({ where: { id }, data: { status: 'REJECTED' } }); }

  async status(userId: string) {
    // Return null (not 404) when the user hasn't started membership yet.
    return this.prisma.membership.findUnique({ where: { userId } });
  }

  listPending() { return this.prisma.membership.findMany({ where: { status: 'PENDING' }, include: { user: true } }); }

  async adminSetStatus(membershipId: string, status: MembershipStatus, adminId: string) {
    const m = await this.prisma.membership.findUnique({ where: { id: membershipId } });
    if (!m) throw new NotFoundException();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.membership.update({
        where: { id: membershipId },
        data: {
          status,
          ...(status === 'ACTIVE' ? { paidAt: m.paidAt ?? new Date(), validatedById: adminId } : {}),
        },
      });
      if (status === 'ACTIVE') {
        const user = await tx.user.findUnique({ where: { id: m.userId } });
        if (user && !user.matricule) {
          await tx.user.update({ where: { id: user.id }, data: { matricule: generateMatricule() } });
        }
      }
      return updated;
    });
  }
}
