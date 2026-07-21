import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

// Permet à JSON.stringify() de sérialiser les BigInt (non supporté nativement par JS)
// Nécessaire car le schéma Prisma utilise BigInt pour tous les montants en XOF
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const prefix = config.get<string>('API_PREFIX', 'api/v1');
  const port = config.get<number>('PORT', 3000);
  const origins = (config.get<string>('CORS_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  // Limite augmentée pour les payloads JSON classiques (les images passent en multipart, pas ici)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // IMPORTANT : helmet + cors AVANT useStaticAssets, sinon les headers
  // de sécurité posés ici n'ont aucun effet cohérent sur les fichiers statiques.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Désactivé car il peut bloquer le chargement de ressources cross-origin
      // qui n'ont pas de CORP/CORS explicite (utile en dev avec frontend séparé).
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.enableCors({ origin: origins.length ? origins : true, credentials: true });

  // Sert les fichiers uploadés (ex: /uploads/marketplace/xxx.jpg)
  // On utilise process.cwd() (dossier depuis lequel "node dist/..." est lancé)
  // plutôt que __dirname, car ce dernier dépend de la structure de compilation
  // (dist/main.js vs dist/src/main.js) et cassait la résolution du chemin.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  });

  app.setGlobalPrefix(prefix);
  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new PrismaExceptionFilter(), new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const swaggerCfg = new DocumentBuilder()
    .setTitle('Business Room API')
    .setDescription('Épargne, investissement, marketplace, microcrédit')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup(`${prefix}/docs`, app, doc);

  await app.listen(port);
  Logger.log(`Business Room API running on :${port}/${prefix}`, 'Bootstrap');
}
bootstrap();