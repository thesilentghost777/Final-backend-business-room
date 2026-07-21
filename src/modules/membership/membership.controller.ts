import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MembershipService } from './membership.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('membership') @ApiBearerAuth() @Controller('membership')
export class MembershipController {
  constructor(private svc: MembershipService) {}
  @Post('request') request(@CurrentUser() u: any) { return this.svc.request(u.id); }
  @Get('me') me(@CurrentUser() u: any) { return this.svc.status(u.id); }
  @Get('pending') @Roles(Role.ADMIN, Role.SUPER_ADMIN_CFPAM) pending() { return this.svc.listPending(); }
  @Post(':id/validate') @Roles(Role.ADMIN, Role.SUPER_ADMIN_CFPAM) validate(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.validate(id, u.id); }
  @Post(':id/reject') @Roles(Role.ADMIN, Role.SUPER_ADMIN_CFPAM) reject(@Param('id') id: string) { return this.svc.reject(id); }
}
