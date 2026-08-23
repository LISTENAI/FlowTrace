# FlowTrace

FlowTrace 是公司内部、自部署、AI 友好的研发项目进度管理工具。它围绕需求
展开阶段、Bug、等待、阻塞、排期基线、实际执行和跨项目依赖，让项目当前
状态和真实历史都能被人和 Agent 准确理解。

## 开始开发

```bash
docker compose up -d --build
```

- Web：<http://localhost:5173>
- API：<http://localhost:3100/api>
- OpenAPI UI：<http://localhost:3100/api/docs>
- OpenAPI JSON：<http://localhost:3100/api/openapi.json>

容器将源码挂载进开发环境并启用热更新，SQLite 数据保存在命名卷中。查看
日志可运行 `docker compose logs -f`，停止环境可运行 `docker compose down`。

也可以在主机安装依赖并运行：

```bash
npm install
npm run dev
```

## 常用检查

```bash
npm run typecheck
npm test
npm run build
```

MCP Server 默认连接 `http://localhost:3100/api`：

```bash
npm run build -w @flowtrace/shared
npm run dev -w @flowtrace/mcp
```

可通过 `FLOWTRACE_API_URL` 覆盖 API 地址。产品需求归档见
[`docs/product/requirements-v0.2.md`](docs/product/requirements-v0.2.md)。
