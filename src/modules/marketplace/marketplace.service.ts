import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MarketplaceService {
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  async create(userId: string, dto: any) {
    const max = await this.prisma.marketPost.aggregate({ _max: { queuePosition: true }, where: { status: 'ACTIVE' } });
    const position = (max._max.queuePosition ?? 0) + 1;
    const post = await this.prisma.marketPost.create({
      data: {
        userId, title: dto.title, description: dto.description, category: dto.category,
        priceXof: dto.priceXof ? BigInt(dto.priceXof) : null,
        whatsappNumber: dto.whatsappNumber, imageUrl: dto.imageUrl,
        queuePosition: position,
      },
    });
    return this.toDto(post);
  }

  async listMine(userId: string) {
    // IMPORTANT : on exclut les annonces supprimées (status REMOVED),
    // sinon elles restent affichées dans "Mes annonces" après suppression.
    const posts = await this.prisma.marketPost.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    return posts.map((p) => this.toDto(p));
  }

  async browse() {
    const posts = await this.prisma.marketPost.findMany({ where: { status: 'ACTIVE' }, orderBy: { queuePosition: 'asc' } });
    return posts.map((p) => this.toDto(p));
  }

  async featured() {
    const posts = await this.prisma.marketPost.findMany({
      where: { status: 'ACTIVE', featuredToday: true },
      include: { user: { select: { fullName: true, photoUrl: true } } },
    });
    return posts.map((p) => this.toDto(p));
  }

  async remove(userId: string, id: string) {
    const p = await this.prisma.marketPost.findUnique({ where: { id } });
    if (!p || p.userId !== userId) throw new NotFoundException();
    const updated = await this.prisma.marketPost.update({ where: { id }, data: { status: 'REMOVED' } });
    return this.toDto(updated);
  }

  async rotate() {
    const count = Number(this.cfg.getOrThrow('MARKETPLACE_DAILY_FEATURED'));
    await this.prisma.marketPost.updateMany({ where: { featuredToday: true }, data: { featuredToday: false } });
    const next = await this.prisma.marketPost.findMany({
      where: { status: 'ACTIVE' }, orderBy: { queuePosition: 'asc' }, take: count,
    });
    if (!next.length) return { rotated: 0 };
    const max = await this.prisma.marketPost.aggregate({ _max: { queuePosition: true }, where: { status: 'ACTIVE' } });
    let nextPos = (max._max.queuePosition ?? 0) + 1;
    for (const p of next) {
      await this.prisma.marketPost.update({
        where: { id: p.id },
        data: { featuredToday: true, lastFeaturedAt: new Date(), queuePosition: nextPos++ },
      });
    }
    return { rotated: next.length };
  }

  // Convertit un enregistrement Prisma en DTO exposé au frontend :
  // - `imageUrl` (DB) -> `photoUrl` (frontend)
  // - `featuredToday` (DB) -> `featured` (frontend), attendu par MarketPost.featured
  private toDto(p: any) {
    const { imageUrl, featuredToday, ...rest } = p;
    return { ...rest, photoUrl: imageUrl, featured: featuredToday };
  }
}