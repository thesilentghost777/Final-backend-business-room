import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
// import { AdminGuard } from '../../common/guards/admin.guard';
import { IsDateString, IsOptional, IsString } from 'class-validator';

class ScheduleMeetingDto {
  @IsDateString() scheduledAt!: string;
  @IsString() location!: string;
  @IsOptional() @IsString() notes?: string;
}

@Controller('admin/matching')
// @UseGuards(AdminGuard)
export class MatchingAdminController {
  constructor(private svc: MatchingService) {}

  @Get('pending-meetings')
  pending() { return this.svc.adminPendingMeetings(); }

  @Patch(':id/schedule-meeting')
  schedule(@CurrentUser() u: any, @Param('id') id: string, @Body() dto: ScheduleMeetingDto) {
    return this.svc.scheduleMeeting(u.id, id, dto);
  }
}