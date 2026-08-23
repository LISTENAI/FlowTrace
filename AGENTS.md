# FlowTrace 维护交底

## 项目背景

FlowTrace 是面向内部研发团队的轻量项目进度管理工具。它要低成本、真实地
记录一个需求经历的阶段、等待、阻塞、Bug、返工、排期变化和跨项目依赖，
而不是实现通用 Jira。产品需求的归档版本位于
`docs/product/requirements-v0.2.md`，业务取舍以该文档为准。

## 工程结构

- `packages/shared`：前后端和 MCP 共用的类型、枚举与 API 数据结构。
- `packages/backend`：NestJS HTTP API、领域服务和 SQLite 持久化。
- `packages/web`：Vite + Vue SFC + Tailwind 的 Web 界面。
- `packages/mcp`：第一方 MCP Server，只调用 HTTP API，不直接访问数据库。
- `docs/product`：产品需求等不会随实现细节漂移的原始产品档案。
- `docs/architecture`：实现架构、业务约束与机器接口说明。

跨包引用使用 `@flowtrace/` 包名，包内引用使用 `@/`。业务规则应集中在后端
应用服务中；Web 和 MCP 不得复制状态、历史或删除规则。新增核心 UI 操作时，
同时检查 HTTP API、OpenAPI 和 MCP 是否需要覆盖。

## 不可破坏的业务规则

- 软件、固件、硬件只是预置的项目节奏，不是封闭的项目类型枚举。节奏应可
  全局维护，并只在创建项目时复制，不能与既有项目动态绑定。
- 项目模板只在创建需求时复制，之后不追随模板变化。
- 状态、排期和目标版本修改必须追加历史，不能只覆盖当前字段。
- 等待中与阻塞含义不同，必须分别记录原因和持续区间。
- 已产生状态历史、排期历史或依赖的数据不可无痕物理删除，应取消并保留。
- 依赖未满足时只警告，不阻止推进；跨项目双向协作也不能简单以环为由拒绝。
- 人员是负责人目录而非账号；停用后保留历史关联。
- Agent 写入必须携带 `source=agent` 及调用方标识，并走同一业务服务。
- 需求、Bug 等可读 ID 一经创建不可因改名或移动版本而变化。

## 开发与验证

首选容器开发：`docker compose up -d --build`。Web 默认在 5173 端口，API 和
Swagger 默认在 3100 端口。主机执行 `npm install` 也是允许的。

依赖必须使用 `npm install --save` 或 `npm install --save-dev` 增删，严禁手工
修改 `package.json` 的依赖字段。提交前至少执行与改动有关的 `typecheck`、
`test` 和 `build`。修改界面时还应验证桌面和窄屏布局。

不要提交数据库文件、构建产物、依赖目录或本地环境文件。

## Git 归档规则

- 自动按完整、可解释的功能单元提交，不把临时试错过程写进历史。
- 提交标题和正文使用中文，例如 `feat(api): 保留阶段状态变更历史`。
- 正文只解释最终设计及必要原因，在约 75 个半角字符处硬换行。
- 不覆盖仓库已有 committer 配置。
- 提交末尾添加当前 Coding Agent 的模型名称与版本作为 co-author。
- 推送到 `origin/master` 前，若同一功能经过多轮调整，应 amend 或 rebase 到
  对应提交，保留清晰的最终叙事。除非用户明确要求，不主动推送。
