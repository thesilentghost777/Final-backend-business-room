import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class EntrepreneursService {
  constructor(private prisma: PrismaService) {}
  upsert(userId: string, dto: any) {
    const data = {
      projectTitle: dto.projectTitle, description: dto.description, sector: dto.sector,
      amountRequestedXof: BigInt(dto.amountRequestedXof),
      personalContributionXof: BigInt(dto.personalContributionXof ?? 0),
      need: dto.need,
    };
    return this.prisma.entrepreneurProfile.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  }
  me(userId: string) { return this.prisma.entrepreneurProfile.findUnique({ where: { userId } }); }
  async toggleVisibility(userId: string, visible: boolean) {
    const p = await this.prisma.entrepreneurProfile.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException();
    return this.prisma.entrepreneurProfile.update({ where: { userId }, data: { visible } });
  }
  browse() {
    return this.prisma.investorProfile.findMany({
      where: { visible: true, status: 'APPROVED' },
      select: { id: true, capacityXof: true, sectors: true, horizonMonths: true, expectations: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
