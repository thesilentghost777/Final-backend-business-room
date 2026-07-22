import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { MarketplaceService } from './marketplace.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MembershipActiveGuard } from '../../common/guards/membership-active.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

class PostDto {
  @IsString() title!: string;
  @IsString() description!: string;
  @IsString() category!: string;

  // Les champs multipart/form-data arrivent toujours en string côté serveur.
  // @Type(() => Number) force la conversion AVANT la validation @IsInt(),
  // sinon "5000" (string) fait systématiquement échouer @IsInt() -> 400 Bad Request.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceXof?: number;

  @IsString() whatsappNumber!: string;
}

const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

@ApiTags('marketplace')
@ApiBearerAuth()
@Controller('marketplace')
export class MarketplaceController {
  constructor(private svc: MarketplaceService) {}

  @ApiConsumes('multipart/form-data')
  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/marketplace',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: IMAGE_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          return cb(new BadRequestException('Format image non supporté'), false);
        }
        cb(null, true);
      },
    }),
  )
  create(
    @CurrentUser() u: any,
    @Body() dto: PostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const imageUrl = file ? `/uploads/marketplace/${file.filename}` : undefined;
    return this.svc.create(u.id, { ...dto, imageUrl });
  }

  @Get() list() {
    return this.svc.browse();
  }

  @Get('featured') feat() {
    return this.svc.featured();
  }

  @Get('mine') mine(@CurrentUser() u: any) {
    return this.svc.listMine(u.id);
  }

  @Delete(':id') remove(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.remove(u.id, id);
  }

  @Post('rotate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN_CFPAM)
  rotate() {
    return this.svc.rotate().then((r) => ({ ok: true, ...r }));
  }
}