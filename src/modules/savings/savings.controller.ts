import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SavingsService } from './savings.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsIn, IsInt, Min } from 'class-validator';
import { SavingsType } from '@prisma/client';

class CreateSavingsDto {
  @IsIn(['DAILY', 'WEEKLY', 'BLOCKED']) type!: SavingsType;
  @IsInt() @Min(1) goalXof!: number;
  @IsInt() @Min(1) installmentXof!: number;
}
class ContributeDto {
  @IsInt() @Min(1) amountXof!: number;
}

@ApiTags('savings')
@ApiBearerAuth()
@Controller('savings')
export class SavingsController {
  constructor(private svc: SavingsService) {}

  @Post('simulate')
  simulate(@Body() dto: CreateSavingsDto) {
    const p = this.svc.computePlan(dto.type, dto.goalXof, dto.installmentXof);
    return {
      ...p,
      totalToContribute: p.totalToContribute.toString(),
      installment: p.installment.toString(),
      bonus: p.bonus.toString(),
    };
  }

  @Post()
  create(@CurrentUser() u: any, @Body() dto: CreateSavingsDto) {
    return this.svc.create(u.id, dto);
  }

  @Get()
  list(@CurrentUser() u: any) {
    return this.svc.list(u.id);
  }

  @Get(':id')
  detail(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.detail(u.id, id);
  }

  @Post(':id/contri bute')
  contribute(@CurrentUser() u: any, @Param('id') id: string, @Body() dto: ContributeDto) {
    return this.svc.contribute(u.id, id, dto.amountXof);
  }

  @Post(':id/withdraw')
  withdraw(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.requestWithdrawal(u.id, id);
  }

  // Nouvel endpoint : suppression, autorisée seulement si progression = 0%
  @Delete(':id')
  remove(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.remove(u.id, id);
  }
}