# 正式部署

FlowTrace 的正式交付物是单一应用镜像。NestJS 在同一端口提供 Web 静态资源、
前端路由回退、HTTP API、Swagger 和远程 MCP；SQLite 数据库位于
容器外的 `/data` 卷。

```text
浏览器 / MCP 调用方 ──> :3100 ──> FlowTrace 镜像 ──> /data/flowtrace.db
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

正式镜像默认设置 `FLOWTRACE_SEED_DEMO=false`。空库会创建基础项目节奏，但
不会创建演示项目、人员、需求或 Bug。若要启动一次性的体验环境，可在首次
启动前显式设置 `FLOWTRACE_SEED_DEMO=true`；项目库中已有项目后不会再次补齐
演示内容。

当前版本没有账号、登录和权限隔离，只能部署在可信内网或受控的私有网络中，
不得直接暴露到公网。升级前应备份 `/data/flowtrace.db`，并保留整个 `/data`
卷的可恢复副本。
