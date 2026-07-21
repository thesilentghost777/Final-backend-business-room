import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReferralService } from './referral.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('referral') @ApiBearerAuth() @Controller('referral')
export class ReferralController {
  constructor(private svc: ReferralService) {}
  @Get('summary') summary(@CurrentUser() u: any) { return this.svc.summary(u.id); }
  @Get('list') list(@CurrentUser() u: any) { return this.svc.list(u.id); }
}
