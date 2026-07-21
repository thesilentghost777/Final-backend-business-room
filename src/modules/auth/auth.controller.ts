import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthService } from './auth.service';
import { CompleteProfileDto, FirebaseLoginDto, LoginDto, RegisterDto, UpdateMeDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';

const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const photoInterceptorOptions = {
  storage: diskStorage({
    destination: './uploads/profile',
    filename: (_req: any, file: any, cb: any) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: IMAGE_MAX_BYTES },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new BadRequestException('Format image non supporté'), false);
    }
    cb(null, true);
  },
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private users: UsersService) {}

  @Public()
  @ApiConsumes('multipart/form-data')
  @Post('register')
  @UseInterceptors(FileInterceptor('photo', photoInterceptorOptions))
  register(@Body() dto: RegisterDto, @UploadedFile() file?: Express.Multer.File) {
    const photoUrl = file ? `/uploads/profile/${file.filename}` : dto.photoUrl;
    return this.auth.register({ ...dto, photoUrl });
  }

  @Public() @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto); }
  @Public() @Post('firebase') firebase(@Body() dto: FirebaseLoginDto) { return this.auth.firebaseLogin(dto); }
  @Public() @Post('refresh') refresh(@Body('refreshToken') t: string) { return this.auth.refresh(t); }

  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Post('complete-profile')
  complete(@CurrentUser() u: any, @Body() dto: CompleteProfileDto) { return this.auth.completeProfile(u.id, dto); }

  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get('me')
  me(@CurrentUser() u: any) { return this.users.me(u.id); }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @Patch('me')
  @UseInterceptors(FileInterceptor('photo', photoInterceptorOptions))
  update(@CurrentUser() u: any, @Body() dto: UpdateMeDto, @UploadedFile() file?: Express.Multer.File) {
    const photoUrl = file ? `/uploads/profile/${file.filename}` : dto.photoUrl;
    return this.users.updateMe(u.id, { ...dto, photoUrl });
  }
}