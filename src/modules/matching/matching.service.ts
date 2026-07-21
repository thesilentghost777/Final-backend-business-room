import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  private getProfiles(userId: string) {
    return Promise.all([
      this.prisma.investorProfile.findUnique({ where: { userId } }),
      this.prisma.entrepreneurProfile.findUnique({ where: { userId } }),
    ]).then(([investor, entrepreneur]) => ({ investor, entrepreneur }));
  }

  async requestFromInvestor(userId: string, entrepreneurProfileId: string, message?: string) {
    const { investor } = await this.getProfiles(userId);
    if (!investor) throw new NotFoundException("Complétez d'abord votre profil investisseur.");

    const entrepreneur = await this.prisma.entrepreneurProfile.findUnique({ where: { id: entrepreneurProfileId } });
    if (!entrepreneur || !entrepreneur.visible || entrepreneur.status !== 'APPROVED') {
      throw new NotFoundException("Ce projet n'est plus disponible.");
    }

    return this.prisma.matchRequest.upsert({
      where: {
        investorProfileId_entrepreneurProfileId: { investorProfileId: investor.id, entrepreneurProfileId },
      },
      update: {},
      create: { investorProfileId: investor.id, entrepreneurProfileId, initiatedById: userId, message },
    });
  }

  async requestFromEntrepreneur(userId: string, investorProfileId: string, message?: string) {
    const { entrepreneur } = await this.getProfiles(userId);
    if (!entrepreneur) throw new NotFoundException("Complétez d'abord votre profil entrepreneur.");

    const investor = await this.prisma.investorProfile.findUnique({ where: { id: investorProfileId } });
    if (!investor || !investor.visible || investor.status !== 'APPROVED') {
      throw new NotFoundException("Cet investisseur n'est plus disponible.");
    }

    return this.prisma.matchRequest.upsert({
      where: {
        investorProfileId_entrepreneurProfileId: { investorProfileId, entrepreneurProfileId: entrepreneur.id },
      },
      update: {},
      create: { investorProfileId, entrepreneurProfileId: entrepreneur.id, initiatedById: userId, message },
    });
  }

  async myRequests(userId: string) {
    const { investor, entrepreneur } = await this.getProfiles(userId);
    const or: any[] = [];
    if (investor) or.push({ investorProfileId: investor.id });
    if (entrepreneur) or.push({ entrepreneurProfileId: entrepreneur.id });
    if (or.length === 0) return [];

    return this.prisma.matchRequest.findMany({
      where: { OR: or },
      include: {
        investorProfile: { select: { capacityXof: true, sectors: true, horizonMonths: true, expectations: true, userId: true } },
        entrepreneurProfile: { select: { projectTitle: true, sector: true, amountRequestedXof: true, userId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async respond(userId: string, matchId: string, accept: boolean) {
    const match = await this.prisma.matchRequest.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException();

    const { investor, entrepreneur } = await this.getProfiles(userId);
    const isRecipient =
      (investor?.id === match.investorProfileId && match.initiatedById !== userId) ||
      (entrepreneur?.id === match.entrepreneurProfileId && match.initiatedById !== userId);

    if (!isRecipient) throw new ForbiddenException("Vous n'êtes pas destinataire de cette demande.");
    if (match.status !== 'PENDING') throw new BadRequestException('Cette demande a déjà été traitée.');

    return this.prisma.matchRequest.update({
      where: { id: matchId },
      data: { status: accept ? 'ACCEPTED' : 'DECLINED' },
    });
  }

  // --- Côté admin : planifie la rencontre physique une fois le match accepté ---
  adminPendingMeetings() {
    return this.prisma.matchRequest.findMany({
      where: { status: 'ACCEPTED' },
      include: {
        investorProfile: { include: { user: { select: { fullName: true, phone: true, email: true } } } },
        entrepreneurProfile: { include: { user: { select: { fullName: true, phone: true, email: true } } } },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async scheduleMeeting(adminId: string, matchId: string, dto: { scheduledAt: string; location: string; notes?: string }) {
    const match = await this.prisma.matchRequest.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException();
    if (match.status !== 'ACCEPTED') {
      throw new BadRequestException('Le match doit être accepté avant de planifier la rencontre.');
    }
    return this.prisma.matchRequest.update({
      where: { id: matchId },
      data: {
        status: 'MEETING_SCHEDULED',
        meetingScheduledAt: new Date(dto.scheduledAt),
        meetingLocation: dto.location,
        meetingNotes: dto.notes,
        handledById: adminId,
      },
    });
  }
}