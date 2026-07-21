import { Module } from '@nestjs/common';
import { AssistanceController } from './assistance.controller';
import { AssistanceService } from './assistance.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AssistanceController],
  providers: [AssistanceService],
  exports: [AssistanceService],
})
export class AssistanceModule {}
