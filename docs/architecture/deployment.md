# 正式部署

FlowTrace 的应用交付物是单一镜像。NestJS 在同一端口提供 Web 静态资源、
前端路由回退、HTTP API、Swagger 和远程 MCP，状态持久化到独立的
PostgreSQL 实例。

```text
浏览器 / MCP 调用方 ──> :3100 ──> FlowTrace 镜像 ──> PostgreSQL
                                ├─ Web 与前端路由
                                ├─ /api
                                ├─ /mcp
                                └─ /api/docs
```

在源码目录构建和启动：

```bash
docker compose -f compose.production.yml up -d --build
```

可使用 `FLOWTRACE_PUBLISH_PORT` 修改宿主机端口，使用 `FLOWTRACE_IMAGE` 指定
已经构建或从镜像仓库拉取的镜像。容器内部端口固定为 3100。

Compose 默认同时启动 PostgreSQL 16。正式使用前至少应设置数据库密码：

```bash
export FLOWTRACE_POSTGRES_PASSWORD='请替换为强密码'
docker compose -f compose.production.yml up -d --build
```

应用也可以接入外部 PostgreSQL。直接运行应用镜像时，可提供
`FLOWTRACE_DATABASE_URL`；也可以分别提供 `FLOWTRACE_DATABASE_HOST`、
`FLOWTRACE_DATABASE_PORT`、`FLOWTRACE_DATABASE_NAME`、
`FLOWTRACE_DATABASE_USER` 和 `FLOWTRACE_DATABASE_PASSWORD`。如数据库要求
TLS，可将 `FLOWTRACE_DATABASE_SSL` 设为 `require` 或 `verify-full`。

正式镜像默认设置 `FLOWTRACE_SEED_DEMO=false`。空库会创建基础项目节奏，但
不会创建演示项目、人员、需求或 Bug。若要启动一次性的体验环境，可在首次
启动前显式设置 `FLOWTRACE_SEED_DEMO=true`；项目库中已有项目后不会再次补齐
演示内容。

当前版本没有账号、登录和权限隔离，只能部署在可信内网或受控的私有网络中，
不得直接暴露到公网。升级前应使用 `pg_dump` 创建一致性备份，并验证备份可以
恢复；不得仅把正在运行的 PostgreSQL 数据目录作为逻辑备份复制。
