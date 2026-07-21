import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PartnershipService {
  constructor(private prisma: PrismaService) {}

  async packs() {
    const packs = await this.prisma.sharePack.findMany({ where: { active: true } });
    return packs.map(({ sharesIncluded, ...rest }) => ({
      ...rest,
      sharesPerPack: sharesIncluded,
    }));
  }

  createPack(dto: { name: string; unitPriceXof: number; sharesIncluded: number }) {
    return this.prisma.sharePack.create({ data: { name: dto.name, unitPriceXof: BigInt(dto.unitPriceXof), sharesIncluded: dto.sharesIncluded } });
  }

  async currentValue() {
    const last = await this.prisma.shareValueHistory.findFirst({ orderBy: { effectiveAt: 'desc' } });
    return last ?? { valueXof: 0n, effectiveAt: null };
  }

  setValue(adminId: string, valueXof: number, note?: string) {
    return this.prisma.shareValueHistory.create({ data: { valueXof: BigInt(valueXof), setById: adminId, note } });
  }

  async buy(userId: string, packId: string) {
    const pack = await this.prisma.sharePack.findUnique({ where: { id: packId } });
    if (!pack || !pack.active) throw new NotFoundException('Pack not found');
    const total = pack.unitPriceXof * BigInt(pack.sharesIncluded);
    return this.prisma.shareTransaction.create({
      data: { userId, packId: pack.id, type: 'BUY', shares: pack.sharesIncluded, unitPriceXof: pack.unitPriceXof, totalXof: total },
    });
  }

  async approveTx(txId: string, adminId: string) {
    const tx = await this.prisma.shareTransaction.findUnique({ where: { id: txId } });
    if (!tx) throw new NotFoundException();
    if (tx.status !== 'PENDING') throw new BadRequestException('Already processed');
    return this.prisma.$transaction(async (t) => {
      const holding = await t.shareHolding.upsert({
        where: { userId: tx.userId }, update: {}, create: { userId: tx.userId, shares: 0 },
      });
      const delta = tx.type === 'BUY' ? tx.shares : -tx.shares;
      const newShares = holding.shares + delta;
      if (newShares < 0) throw new BadRequestException('Insufficient shares');
      await t.shareHolding.update({ where: { userId: tx.userId }, data: { shares: newShares } });
      return t.shareTransaction.update({
        where: { id: txId },
        data: { status: 'SETTLED', processedAt: new Date(), processedById: adminId },
      });
    });
  }

  async rejectTx(txId: string, adminId: string) {
    return this.prisma.shareTransaction.update({
      where: { id: txId },
      data: { status: 'REJECTED', processedAt: new Date(), processedById: adminId },
    });
  }

  async sell(userId: string, shares: number) {
    const holding = await this.prisma.shareHolding.findUnique({ where: { userId } });
    if (!holding || holding.shares < shares) throw new BadRequestException('Insufficient shares');
    const value = await this.currentValue();
    return this.prisma.shareTransaction.create({
      data: { userId, type: 'SELL', shares, unitPriceXof: value.valueXof, totalXof: value.valueXof * BigInt(shares) },
    });
  }

  async portfolio(userId: string) {
    const holding = await this.prisma.shareHolding.findUnique({ where: { userId } });
    const value = await this.currentValue();
    const sharesOwned = holding?.shares ?? 0;
    const shareValueXof = value.valueXof;
    return {
      sharesOwned,
      shareValueXof: shareValueXof.toString(),
      totalValueXof: (shareValueXof * BigInt(sharesOwned)).toString(),
    };
  }

  adminTransactions() {
    return this.prisma.shareTransaction.findMany({
      include: { pack: true, user: { select: { id: true, fullName: true, email: true, matricule: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}