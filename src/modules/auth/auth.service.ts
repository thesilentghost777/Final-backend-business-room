import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { CompleteProfileDto, FirebaseLoginDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { generateReferralCode } from '../../common/utils/matricule.util';
import { AuthProvider } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private cfg: ConfigService,
    private firebase: FirebaseAdminService,
  ) {}

  private sign(userId: string) {
    const access = this.jwt.sign({ sub: userId });
    const refresh = this.jwt.sign({ sub: userId, typ: 'refresh' }, {
      secret: this.cfg.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.cfg.get('JWT_REFRESH_EXPIRES_IN', '30d'),
    });
    return { accessToken: access, refreshToken: refresh };
  }

  private async resolveReferrer(code?: string) {
    if (!code) return null;
    const r = await this.prisma.user.findUnique({ where: { referralCode: code } });
    if (!r) throw new BadRequestException('Invalid referral code');
    if (!(await this.prisma.membership.findFirst({ where: { userId: r.id, status: 'ACTIVE' } }))) {
      throw new BadRequestException('Referrer has not paid membership');
    }
    return r;
  }

  async register(dto: RegisterDto & { photoUrl?: string }) {
    if (!dto.email && !dto.phone) throw new BadRequestException('Email or phone required');
    if (!dto.password) throw new BadRequestException('Password required');
    const rounds = Number(this.cfg.get('BCRYPT_ROUNDS', 12));
    const referrer = await this.resolveReferrer(dto.referralCode);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email, phone: dto.phone, fullName: dto.fullName,
        address: dto.address, profession: dto.profession,
        photoUrl: dto.photoUrl,
        passwordHash: await bcrypt.hash(dto.password, rounds),
        authProviders: [AuthProvider.EMAIL],
        referredById: referrer?.id,
        referralCode: generateReferralCode(),
        profileCompleted: Boolean(dto.fullName && dto.address && dto.profession),
      },
    });
    return { user: this.sanitize(user), ...this.sign(user.id) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email ?? undefined }, { phone: dto.phone ?? undefined }] },
    });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account disabled');
    return { user: this.sanitize(user), ...this.sign(user.id) };
  }

  async firebaseLogin(dto: FirebaseLoginDto) {
    const decoded = await this.firebase.verifyIdToken(dto.idToken);
    const providerKey = (decoded.firebase?.sign_in_provider ?? '').toUpperCase();
    const provider: AuthProvider =
      providerKey.includes('GOOGLE') ? AuthProvider.GOOGLE :
      providerKey.includes('APPLE') ? AuthProvider.APPLE :
      providerKey.includes('PHONE') ? AuthProvider.PHONE : AuthProvider.EMAIL;

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { firebaseUid: decoded.uid },
          decoded.email ? { email: decoded.email } : undefined,
          decoded.phone_number ? { phone: decoded.phone_number } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!user) {
      const referrer = await this.resolveReferrer(dto.referralCode);
      user = await this.prisma.user.create({
        data: {
          firebaseUid: decoded.uid,
          email: decoded.email ?? null,
          phone: decoded.phone_number ?? null,
          fullName: decoded.name ?? null,
          photoUrl: decoded.picture ?? null,
          authProviders: [provider],
          referralCode: generateReferralCode(),
          referredById: referrer?.id,
          profileCompleted: false,
        },
      });
    } else if (!user.authProviders.includes(provider) || !user.firebaseUid) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firebaseUid: user.firebaseUid ?? decoded.uid,
          authProviders: Array.from(new Set([...user.authProviders, provider])),
        },
      });
    }
    return { user: this.sanitize(user), ...this.sign(user.id), needsProfileCompletion: !user.profileCompleted };
  }

  async completeProfile(userId: string, dto: CompleteProfileDto) {
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: { ...dto, profileCompleted: true },
    });
    return this.sanitize(u);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, { secret: this.cfg.getOrThrow('JWT_REFRESH_SECRET') });
      return this.sign(payload.sub);
    } catch { throw new UnauthorizedException('Invalid refresh token'); }
  }

  private sanitize(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}