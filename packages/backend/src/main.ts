import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { configureApp } from '@/configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  configureApp(app);

  const host = process.env.FLOWTRACE_HOST ?? '0.0.0.0';
  const port = Number(process.env.FLOWTRACE_PORT ?? 3100);
  await app.listen(port, host);
}

void bootstrap();
