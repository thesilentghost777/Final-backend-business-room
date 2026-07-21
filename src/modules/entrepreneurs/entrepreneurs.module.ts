import { Module } from '@nestjs/common';
import { EntrepreneursController } from './entrepreneurs.controller';
import { EntrepreneursService } from './entrepreneurs.service';
@Module({ controllers: [EntrepreneursController], providers: [EntrepreneursService] })
export class EntrepreneursModule {}
