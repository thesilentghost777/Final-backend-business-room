import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AssistanceService {
  constructor(private prisma: PrismaService, private notifs: NotificationsService) {}
  categories() { return this.prisma.assistanceCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }); }
  createCategory(name: string) { return this.prisma.assistanceCategory.create({ data: { name } }); }
  send(userId: string, dto: { categoryId: string; subject: string; content: string }) {
    return this.prisma.assistanceMessage.create({ data: { userId, ...dto } });
  }
  mine(userId: string) { return this.prisma.assistanceMessage.findMany({ where: { userId }, include: { category: true }, orderBy: { createdAt: 'desc' } }); }
  updateStatus(id: string, status: any) { return this.prisma.assistanceMessage.update({ where: { id }, data: { status } }); }

  adminList() {
    return this.prisma.assistanceMessage.findMany({
      include: { category: true, user: { select: { id: true, fullName: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async reply(messageId: string, adminId: string, content: string) {
    const m = await this.prisma.assistanceMessage.findUnique({ where: { id: messageId } });
    if (!m) throw new NotFoundException();
    await this.notifs.push(m.userId, `Réponse - ${m.subject}`, content);
    return this.prisma.assistanceMessage.update({
      where: { id: messageId },
      data: { status: 'RESOLVED' },
    });
  }
}
