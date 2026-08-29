import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  type NestExpressApplication,
} from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from '@/app.module';
import { getAuthRuntime } from '@/auth/auth-runtime';
import { configureApp } from '@/configure-app';
import { configureStaticWeb } from '@/configure-static-web';

async function bootstrap() {
  const adapter = new ExpressAdapter();
  const runtime = getAuthRuntime();
  adapter.getInstance().all('/api/auth/*splat', toNodeHandler(runtime.auth));
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    adapter,
    { cors: true },
  );
  configureApp(app);
  configureStaticWeb(app);

  const host = process.env.FLOWTRACE_HOST ?? '0.0.0.0';
  const port = Number(process.env.FLOWTRACE_PORT ?? 3100);
  await app.listen(port, host);
}

void bootstrap();
