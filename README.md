# FlowTrace

FlowTrace 是面向研发团队的自部署项目进度管理工具。它以需求为中心，记录每个
阶段的负责人、排期基线、实际执行、等待、阻塞、Bug、返工与跨项目依赖，让
团队成员和 AI Agent 都能理解项目当前状态及其变化过程。

## 核心能力

- 使用可维护的项目节奏初始化需求阶段，并允许需求建立后独立调整阶段。
- 为需求的每个阶段分别安排负责人，保留状态和排期变化历史。
- 在多层级时间线中查看版本、需求、阶段与 Bug，并直接调整计划。
- 区分等待、阻塞和取消，记录原因、生效时间与实际持续区间。
- 使用稳定可读 ID 表达需求和 Bug，支持跨项目依赖且不阻断业务推进。
- 通过 HTTP API、远程 MCP 和官方 Skill 接入自动化与 AI Agent。

## 快速开始

正式环境使用一个镜像提供 Web、HTTP API、OpenAPI 文档和远程 MCP，SQLite
数据库单独保存在 Docker 数据卷中：

```bash
docker compose -f compose.production.yml up -d --build
```

启动后可访问：

- FlowTrace：<http://localhost:3100>
- OpenAPI UI：<http://localhost:3100/api/docs>
- OpenAPI JSON：<http://localhost:3100/api/openapi.json>
- MCP Endpoint：`POST http://localhost:3100/mcp`

可通过 `FLOWTRACE_PUBLISH_PORT` 修改宿主机端口。正式环境空库只会创建软件、
固件和硬件三套可编辑的基础节奏，不会创建演示项目、人员、需求或 Bug。数据
保存在 `flowtrace_data` 卷的 `/data/flowtrace.db` 中，升级前应备份该文件或
整个数据卷。

> [!WARNING]
> 当前版本没有账号、登录和权限隔离，只能部署在可信内网或受控私有网络中，
> 不能直接暴露到公网。

完整的镜像、数据卷、演示数据和升级说明见
[`docs/architecture/deployment.md`](docs/architecture/deployment.md)。

## AI 接入

FlowTrace 在正式应用端口提供无会话状态的远程 MCP Endpoint：

```text
POST http://localhost:3100/mcp
```

MCP 提供自描述的查询与写入工具，写入仍经过与 Web 相同的业务规则和历史记录。
连接 MCP 的 Agent 应与 FlowTrace 部署在同一可信网络中。

官方 FlowTrace Skill 提供项目管理判断、对象消歧和写入安全策略，可从 Git
仓库安装：

```bash
npx skills add LISTENAI/FlowTrace
```

Skill 与 MCP 独立配置：Skill 指导 Agent 如何工作，MCP 负责访问真实数据和
执行操作。MCP 的资源、工具和调用约定见
[`docs/architecture/mcp.md`](docs/architecture/mcp.md)。

## 参与开发

推荐使用 Docker Compose 开发，避免在主机安装运行时服务：

```bash
docker compose up -d --build
```

开发环境默认启用热更新，并在空项目库中注入一次虚构演示数据：

- Web：<http://localhost:5173>
- API：<http://localhost:3100/api>
- OpenAPI UI：<http://localhost:3100/api/docs>
- MCP Endpoint：`POST http://localhost:3100/mcp`

查看日志可运行 `docker compose logs -f`，停止环境可运行
`docker compose down`。也可以使用 Node.js 22 及 npm 10 在主机运行：

```bash
npm install
npm run dev
```

提交改动前至少执行与改动相关的检查：

```bash
npm run typecheck
npm test
npm run build
```

本地调试 MCP 的 stdio 入口时，它默认连接
`http://127.0.0.1:3100/api`：

```bash
npm run build -w @flowtrace/shared
npm run dev -w @flowtrace/mcp
```

可通过 `FLOWTRACE_API_URL` 覆盖 API 地址。

## 工程结构

```text
packages/
├── web/       Vite、Vue SFC 与 Tailwind Web 界面
├── backend/   NestJS HTTP API、领域服务与 SQLite 持久化
├── shared/    前后端和 MCP 共用的类型与 API 数据结构
└── mcp/       只通过 HTTP API 访问业务能力的第一方 MCP Server
skills/
└── flowtrace/ 官方 Agent Skill
docs/
├── architecture/ 实现架构与机器接口说明
└── product/      归档的产品需求
```

领域模型和 HTTP API 约定分别见：

- [`docs/architecture/domain-model.md`](docs/architecture/domain-model.md)
- [`docs/architecture/http-api.md`](docs/architecture/http-api.md)

产品需求归档位于：

- [`docs/product/requirements-v0.2.md`](docs/product/requirements-v0.2.md)
- [`docs/product/ai-integration-v0.2.md`](docs/product/ai-integration-v0.2.md)

面向 Coding Agent 的工程约束和维护规则位于 [`AGENTS.md`](AGENTS.md)，不属于
用户使用文档。

## 许可证

FlowTrace 采用 [Apache License 2.0](LICENSE) 开源，版权归
Anhui Listenai Co., Ltd. 所有。归属声明见 [`NOTICE`](NOTICE)。
