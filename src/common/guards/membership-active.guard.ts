import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembershipActiveGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext) {
    const { user } = ctx.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException();
    const m = await this.prisma.membership.findUnique({ where: { userId: user.id } });
    if (!m || m.status !== 'ACTIVE') throw new ForbiddenException('Membership not active');
    return true;
  }
}
