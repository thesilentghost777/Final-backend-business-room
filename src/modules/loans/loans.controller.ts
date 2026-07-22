import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LoansService } from './loans.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MembershipActiveGuard } from '../../common/guards/membership-active.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, LoanCategory } from '@prisma/client';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

class ApplyDto {
  @IsIn(['JSE','EXISTING_ACTIVITY']) category!: LoanCategory;
  @IsInt() @Min(1) amountXof!: number;
  @IsInt() @Min(1) durationMonths!: number;
  @IsOptional() @IsString() projectDescription?: string;
  @IsOptional() @IsArray() teamUserIds?: string[];
}
class RepayDto { @IsInt() @Min(1) amountXof!: number; }

@ApiTags('loans') @ApiBearerAuth() @Controller('loans')
export class LoansController {
  constructor(private svc: LoansService) {}
  @Get('simulate') simulate(@Query('amount') a: string, @Query('months') m: string) { return this.svc.simulate(Number(a), Number(m)); }
  @Get('ceiling')  ceiling(@CurrentUser() u: any) { return this.svc.ceiling(u.id); }
  @Post('apply')  apply(@CurrentUser() u: any, @Body() dto: ApplyDto) { return this.svc.apply(u.id, dto); }
  @Get() list(@CurrentUser() u: any) { return this.svc.list(u.id); }
  @Post(':id/repay') repay(@CurrentUser() u: any, @Param('id') id: string, @Body() dto: RepayDto) { return this.svc.repay(u.id, id, dto.amountXof); }
  @Post(':id/approve') @Roles(Role.ADMIN) approve(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.approve(id, u.id); }
  @Post(':id/disburse') @Roles(Role.ADMIN) disburse(@Param('id') id: string) { return this.svc.disburse(id); }
  @Post(':id/reject') @Roles(Role.ADMIN) reject(@Param('id') id: string) { return this.svc.reject(id); }
}
