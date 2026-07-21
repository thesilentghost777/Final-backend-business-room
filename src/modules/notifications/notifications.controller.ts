import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('notifications') @ApiBearerAuth() @Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}
  @Get() list(@CurrentUser() u: any) { return this.svc.list(u.id); }
  @Get('unread-count') unread(@CurrentUser() u: any) { return this.svc.unreadCount(u.id); }
  @Post(':id/read') read(@CurrentUser() u: any, @Param('id') id: string) { return this.svc.markRead(u.id, id); }
  @Post('broadcast') @Roles(Role.ADMIN) broadcast(@Body() b: { title: string; body: string }) { return this.svc.broadcast(b.title, b.body); }
}
