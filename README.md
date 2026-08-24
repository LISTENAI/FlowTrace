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
- MCP：<http://localhost:3100/mcp>
- OpenAPI UI：<http://localhost:3100/api/docs>
- OpenAPI JSON：<http://localhost:3100/api/openapi.json>

容器将源码挂载进开发环境并启用热更新，SQLite 数据保存在命名卷中。查看
日志可运行 `docker compose logs -f`，停止环境可运行 `docker compose down`。
开发 Compose 会在空项目库中注入虚构演示数据。正式运行默认只创建软件、
固件和硬件三套基础节奏；仅当显式设置 `FLOWTRACE_SEED_DEMO=true` 时才会在
空项目库中注入一次演示项目，之后重启不会补回已删除的演示内容。

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

MCP Server 的正式远程 Endpoint 为 `POST /mcp`。本地调试也可启动
stdio 入口，它默认连接 `http://127.0.0.1:3100/api`：

```bash
npm run build -w @flowtrace/shared
npm run dev -w @flowtrace/mcp
```

可通过 `FLOWTRACE_API_URL` 覆盖 API 地址。产品基础需求见
[`docs/product/requirements-v0.2.md`](docs/product/requirements-v0.2.md)，AI 接入增量
需求见
[`docs/product/ai-integration-v0.2.md`](docs/product/ai-integration-v0.2.md)。

## Agent Skill

官方 FlowTrace Skill 位于 `skills/flowtrace`，可从 Git 仓库安装：

```bash
npx skills add LISTENAI/FlowTrace
```

Skill 教授项目管理判断和写入安全策略，MCP 负责提供自描述的
业务能力与真实数据。两者独立配置；未安装 Skill 时，MCP Tool 仍
必须能被正确使用。

## 正式运行

正式环境使用一个镜像同时提供 Web 和 API，SQLite 数据保存在独立数据卷中：

```bash
docker compose -f compose.production.yml up -d --build
```

默认访问地址为 <http://localhost:3100>。当前版本没有账号和权限隔离，只能
部署在可信内网或受控私有网络中，不能直接暴露到公网。详细说明见
[`docs/architecture/deployment.md`](docs/architecture/deployment.md)。
