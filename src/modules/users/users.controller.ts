import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users') @ApiBearerAuth() @Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}
  @Get('me') me(@CurrentUser() u: any) { return this.users.me(u.id); }
  @Patch('me') update(@CurrentUser() u: any, @Body() data: any) { return this.users.updateMe(u.id, data); }
}
