import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CashbookService } from './cashbook.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CashOpType } from '@prisma/client';

class CreateCashbookDto {
  @IsString() name!: string;
  @IsOptional() @IsInt() @Min(0) openingBalanceXof?: number;
}
class OpDto {
  @IsIn(['INCOME','EXPENSE']) type!: CashOpType;
  @IsString() label!: string;
  @IsInt() @Min(1) amountXof!: number;
}

@ApiTags('cashbook') @ApiBearerAuth() @Controller('cashbook')
export class CashbookController {
  constructor(private svc: CashbookService) {}
  @Post() create(@CurrentUser() u: any, @Body() dto: CreateCashbookDto) { return this.svc.create(u.id, dto.name, dto.openingBalanceXof ?? 0); }
  @Get() list(@CurrentUser() u: any) { return this.svc.list(u.id); }
  @Get(':id') detail(@CurrentUser() u: any, @Param('id') id: string) { return this.svc.detail(u.id, id); }
  @Post(':id/operations') addOp(@CurrentUser() u: any, @Param('id') id: string, @Body() dto: OpDto) { return this.svc.addOp(u.id, id, dto); }
  @Get(':id/journal') journal(@CurrentUser() u: any, @Param('id') id: string) { return this.svc.journal(u.id, id); }
  @Get(':id/today') today(@CurrentUser() u: any, @Param('id') id: string) { return this.svc.todayStats(u.id, id); }
}
