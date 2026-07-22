import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { MatchingService } from './matching.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class RequestMatchDto {
  @IsString() targetProfileId!: string;
  @IsOptional() @IsString() message?: string;
}

@ApiTags('matching') @ApiBearerAuth()  @Controller('matching')
export class MatchingController {
  constructor(private svc: MatchingService) {}

  @Post('investor-request')
  fromInvestor(@CurrentUser() u: any, @Body() dto: RequestMatchDto) {
    return this.svc.requestFromInvestor(u.id, dto.targetProfileId, dto.message);
  }

  @Post('entrepreneur-request')
  fromEntrepreneur(@CurrentUser() u: any, @Body() dto: RequestMatchDto) {
    return this.svc.requestFromEntrepreneur(u.id, dto.targetProfileId, dto.message);
  }

  @Get('mine')
  mine(@CurrentUser() u: any) {
    return this.svc.myRequests(u.id);
  }

  @Patch(':id/accept')
  accept(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.respond(u.id, id, true);
  }

  @Patch(':id/decline')
  decline(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.respond(u.id, id, false);
  }
}