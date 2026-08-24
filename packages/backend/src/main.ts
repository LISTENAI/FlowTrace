import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '@/app.module';
import { configureApp } from '@/configure-app';
import { configureStaticWeb } from '@/configure-static-web';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
  });
  configureApp(app);
  configureStaticWeb(app);

  const host = process.env.FLOWTRACE_HOST ?? '0.0.0.0';
  const port = Number(process.env.FLOWTRACE_PORT ?? 3100);
  await app.listen(port, host);
}

void bootstrap();
