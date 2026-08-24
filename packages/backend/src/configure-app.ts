import {
  RequestMethod,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'mcp', method: RequestMethod.ALL }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('FlowTrace API')
    .setDescription('FlowTrace 项目、版本、需求、阶段、Bug、依赖和历史接口')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: '/api/openapi.json',
  });
  return document;
}
