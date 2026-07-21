import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssistanceService } from './assistance.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MembershipActiveGuard } from '../../common/guards/membership-active.guard';
import { AssistanceStatus, Role } from '@prisma/client';
import { IsString } from 'class-validator';

class MsgDto {
  @IsString() categoryId!: string;
  @IsString() subject!: string;
  @IsString() content!: string;
}
class ReplyDto { @IsString() content!: string; }

@ApiTags('assistance') @ApiBearerAuth() @Controller('assistance')
export class AssistanceController {
  constructor(private svc: AssistanceService) {}
  @Get('categories') cats() { return this.svc.categories(); }
  @Post('categories') @Roles(Role.ADMIN, Role.SUPER_ADMIN_CFPAM) create(@Body('name') name: string) { return this.svc.createCategory(name); }
  @UseGuards(MembershipActiveGuard) @Post('messages') send(@CurrentUser() u: any, @Body() dto: MsgDto) { return this.svc.send(u.id, dto); }
  @Get('messages') mine(@CurrentUser() u: any) { return this.svc.mine(u.id); }
  @Patch('messages/:id/status') @Roles(Role.ADMIN, Role.SUPER_ADMIN_CFPAM) status(@Param('id') id: string, @Body('status') s: AssistanceStatus) { return this.svc.updateStatus(id, s); }
  @Post('messages/:id/reply') @Roles(Role.ADMIN, Role.SUPER_ADMIN_CFPAM) reply(@Param('id') id: string, @Body() dto: ReplyDto, @CurrentUser() u: any) {
    return this.svc.reply(id, u.id, dto.content);
  }
}
