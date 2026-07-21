import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { MatchingAdminController } from './matching-admin.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MatchingController, MatchingAdminController],
  providers: [MatchingService],
})
export class MatchingModule {}