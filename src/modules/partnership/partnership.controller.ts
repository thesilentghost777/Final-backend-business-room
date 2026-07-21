import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PartnershipService } from './partnership.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

class PackDto {
  @IsString() name!: string;
  @IsInt() @Min(1) unitPriceXof!: number;
  @IsInt() @Min(1) sharesIncluded!: number;
}
class ValueDto { @IsInt() @Min(1) valueXof!: number; @IsOptional() @IsString() note?: string; }
class SellDto { @IsInt() @Min(1) shares!: number; }

@ApiTags('partnership') @ApiBearerAuth() @Controller('partnership')
export class PartnershipController {
  constructor(private svc: PartnershipService) {}
  @Get('packs') packs() { return this.svc.packs(); }
  @Post('packs') @Roles(Role.SUPER_ADMIN_CFPAM, Role.ADMIN) createPack(@Body() dto: PackDto) { return this.svc.createPack(dto); }
  @Get('share-value') value() { return this.svc.currentValue(); }
  @Post('share-value') @Roles(Role.SUPER_ADMIN_CFPAM, Role.ADMIN) setValue(@CurrentUser() u: any, @Body() dto: ValueDto) { return this.svc.setValue(u.id, dto.valueXof, dto.note); }
  @Post('buy/:packId') buy(@CurrentUser() u: any, @Param('packId') p: string) { return this.svc.buy(u.id, p); }
  @Post('sell') sell(@CurrentUser() u: any, @Body() dto: SellDto) { return this.svc.sell(u.id, dto.shares); }
  @Post('tx/:id/approve') @Roles(Role.ADMIN, Role.SUPER_ADMIN_CFPAM) approve(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.approveTx(id, u.id); }
  @Post('tx/:id/reject') @Roles(Role.ADMIN, Role.SUPER_ADMIN_CFPAM) reject(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.rejectTx(id, u.id); }
  @Get('portfolio') portfolio(@CurrentUser() u: any) { return this.svc.portfolio(u.id); }
}
