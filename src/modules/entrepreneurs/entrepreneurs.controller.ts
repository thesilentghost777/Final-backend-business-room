import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EntrepreneursService } from './entrepreneurs.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MembershipActiveGuard } from '../../common/guards/membership-active.guard';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

class EntrepreneurDto {
  @IsString() projectTitle!: string;
  @IsString() description!: string;
  @IsString() sector!: string;
  @IsInt() @Min(1) amountRequestedXof!: number;
  @IsOptional() @IsInt() @Min(0) personalContributionXof?: number;
  @IsString() need!: string;
}

@ApiTags('entrepreneurs') @ApiBearerAuth() @UseGuards(MembershipActiveGuard) @Controller('entrepreneurs')
export class EntrepreneursController {
  constructor(private svc: EntrepreneursService) {}
  @Post() upsert(@CurrentUser() u: any, @Body() dto: EntrepreneurDto) { return this.svc.upsert(u.id, dto); }
  @Get('me') me(@CurrentUser() u: any) { return this.svc.me(u.id); }
  @Patch('visibility') vis(@CurrentUser() u: any, @Body('visible') v: boolean) { return this.svc.toggleVisibility(u.id, v); }
  @Get('investors') browse() { return this.svc.browse(); }
}
