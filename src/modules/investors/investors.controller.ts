import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvestorsService } from './investors.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MembershipActiveGuard } from '../../common/guards/membership-active.guard';
import { IsArray, IsInt, IsString, Min } from 'class-validator';

class InvestorDto {
  @IsInt() @Min(1) capacityXof!: number;
  @IsArray() sectors!: string[];
  @IsInt() @Min(1) horizonMonths!: number;
  @IsString() expectations!: string;
}

@ApiTags('investors') @ApiBearerAuth() @UseGuards(MembershipActiveGuard) @Controller('investors')
export class InvestorsController {
  constructor(private svc: InvestorsService) {}
  @Post() upsert(@CurrentUser() u: any, @Body() dto: InvestorDto) { return this.svc.upsert(u.id, dto); }
  @Get('me') me(@CurrentUser() u: any) { return this.svc.me(u.id); }
  @Patch('visibility') vis(@CurrentUser() u: any, @Body('visible') v: boolean) { return this.svc.toggleVisibility(u.id, v); }
  @Get('opportunities') browse() { return this.svc.browse(); }
}
