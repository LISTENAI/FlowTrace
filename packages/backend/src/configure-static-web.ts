import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

interface WebRequest {
  method: string;
  path: string;
}

interface WebResponse {
  sendFile(path: string): void;
}

export function configureStaticWeb(app: NestExpressApplication) {
  const configuredRoot = process.env.FLOWTRACE_WEB_ROOT;
  if (!configuredRoot) return;

  const webRoot = resolve(configuredRoot);
  const indexFile = join(webRoot, 'index.html');
  if (!existsSync(indexFile)) {
    throw new Error(`未找到 Web 入口文件：${indexFile}`);
  }

  app.useStaticAssets(webRoot, { index: false });
  app.use((request: WebRequest, response: WebResponse, next: () => void) => {
    const isPageRequest =
      request.method === 'GET' &&
      !request.path.startsWith('/api') &&
      request.path !== '/mcp' &&
      !extname(request.path);
    if (!isPageRequest) {
      next();
      return;
    }
    response.sendFile(indexFile);
  });
}
