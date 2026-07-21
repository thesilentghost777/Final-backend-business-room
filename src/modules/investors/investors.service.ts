import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class InvestorsService {
  constructor(private prisma: PrismaService) {}
  upsert(userId: string, dto: any) {
    return this.prisma.investorProfile.upsert({
      where: { userId },
      update: { ...dto, capacityXof: BigInt(dto.capacityXof) },
      create: { userId, ...dto, capacityXof: BigInt(dto.capacityXof) },
    });
  }
  me(userId: string) { return this.prisma.investorProfile.findUnique({ where: { userId } }); }
  async toggleVisibility(userId: string, visible: boolean) {
    const p = await this.prisma.investorProfile.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException();
    return this.prisma.investorProfile.update({ where: { userId }, data: { visible } });
  }
  browse() {
    return this.prisma.entrepreneurProfile.findMany({
      where: { visible: true, status: 'APPROVED' },
      select: { id: true, projectTitle: true, description: true, sector: true, amountRequestedXof: true, personalContributionXof: true, need: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
