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

在源码目录设置数据库密码，然后构建和启动：

```bash
export FLOWTRACE_POSTGRES_PASSWORD='请替换为随机生成的强密码'
export FLOWTRACE_AUTH_SECRET='请替换为至少32字符的随机密钥'
export FLOWTRACE_AUTH_BASE_URL='https://flowtrace.example.com'
export FLOWTRACE_AUTH_PROVIDER='oidc'
export FLOWTRACE_OIDC_ISSUER='https://id.example.com'
export FLOWTRACE_OIDC_CLIENT_ID='flowtrace'
export FLOWTRACE_OIDC_CLIENT_SECRET='请替换为OIDC客户端密钥'
docker compose -f compose.production.yml up -d --build
```

可使用 `FLOWTRACE_PUBLISH_PORT` 修改宿主机端口，使用 `FLOWTRACE_IMAGE` 指定
已经构建或从镜像仓库拉取的镜像。容器内部端口固定为 3100。服务默认只发布到
`127.0.0.1`；确需从可信网络直接访问时，可显式设置
`FLOWTRACE_PUBLISH_HOST`。Compose 默认同时启动 PostgreSQL 16，不提供默认
数据库密码。

应用也可以接入外部 PostgreSQL。直接运行应用镜像时，可提供
`FLOWTRACE_DATABASE_URL`；也可以分别提供 `FLOWTRACE_DATABASE_HOST`、
`FLOWTRACE_DATABASE_PORT`、`FLOWTRACE_DATABASE_NAME`、
`FLOWTRACE_DATABASE_USER` 和 `FLOWTRACE_DATABASE_PASSWORD`。如数据库要求
TLS，可将 `FLOWTRACE_DATABASE_SSL` 设为 `require` 或 `verify-full`。

正式镜像默认设置 `FLOWTRACE_SEED_DEMO=false`。空库会创建基础项目节奏，但
不会创建演示项目、人员、需求或 Bug。若要启动一次性的体验环境，可在首次
启动前显式设置 `FLOWTRACE_SEED_DEMO=true`；项目库中已有项目后不会再次补齐
演示内容。

身份认证是必需能力，未选择登录适配器时应用会拒绝启动。生产环境支持本地
账号、标准 OIDC 和企业微信适配器，详细变量、回调地址和人员关联规则见
[身份认证](authentication.md)。`FLOWTRACE_AUTH_BASE_URL` 必须是用户实际访问
的 HTTPS 地址。

当前版本尚无 RBAC，登录后的组织成员可以读取和维护整个实例的数据。升级前应
使用 `pg_dump` 创建一致性备份并验证可恢复；不得仅复制正在运行的 PostgreSQL
数据目录作为逻辑备份。
