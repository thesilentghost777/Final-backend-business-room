import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}
  list(userId: string) { return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }); }
  unreadCount(userId: string) { return this.prisma.notification.count({ where: { userId, readAt: null } }); }
  markRead(userId: string, id: string) { return this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } }); }
  push(userId: string, title: string, body: string) { return this.prisma.notification.create({ data: { userId, title, body } }); }
  broadcast(title: string, body: string) {
    return this.prisma.$transaction(async (t) => {
      const users = await t.user.findMany({ select: { id: true } });
      return t.notification.createMany({ data: users.map((u) => ({ userId: u.id, title, body })) });
    });
  }
}
