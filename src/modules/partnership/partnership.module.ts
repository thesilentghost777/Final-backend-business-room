import { Module } from '@nestjs/common';
import { PartnershipController } from './partnership.controller';
import { PartnershipService } from './partnership.service';
@Module({ controllers: [PartnershipController], providers: [PartnershipService], exports: [PartnershipService] })
export class PartnershipModule {}
