# MCP Server

`@flowtrace/mcp` 是 FlowTrace 的第一方 MCP Server。它只调用 HTTP API
和正常业务服务，不直接读写数据库，也不维护第二套状态或
历史规则。

## 远程 Endpoint

正式镜像在与 Web 和 API 相同的端口提供 Streamable HTTP Endpoint：

```text
POST /mcp
```

Endpoint 使用无会话状态的请求/响应模式。MCP 协议层不保留 Agent
会话，业务数据仍由应用的 SQLite 数据卷持久化。当 FlowTrace 通过
多个 Host 访问时，可用逗号分隔的 `FLOWTRACE_MCP_ALLOWED_HOSTS`
启用 Host 白名单校验。

当前没有账号和权限隔离，`/mcp` 只能部署在可信内网或受控私有
网络中，不得直接暴露到公网。

## Tool 与返回值

MCP 提供 21 个有明确业务语义的 Tool：

- 查询：对象搜索，项目和版本快照，需求完整详情，按时间的
  增量变化。
- 写入：创建和修改版本，创建和修改需求，独立分配负责人，移动版本，增加
  阶段，更新阶段或 Bug 状态，调整排期，报告 Bug，建立和解除
  依赖，审计式删除误建事项。

`create_requirement` 可省略 `stages` 以复制项目模板，也可直接提供
按顺序排列的真实阶段。后者用于外部计划已经给出实际工作分解的
场景，避免先复制通用模板、再批量取消造成无意义历史。

Project / Version Snapshot 中，每个需求的 `activeStages` 给出全部并行
活跃阶段，`nextStages` 给出紧邻的下一阶段；顶层 `reviewItems` 聚合待
补负责人、排期或目标版本等管理缺口。`currentStage` 仅保留为兼容的
注意力提示，不代表需求的全部当前工作。

读 Tool 返回 `success` 和结构化 `data`。写 Tool 至少返回：

```text
success
entity
history
warnings
```

依赖未满足时操作仍然成功，具体问题放入 `warnings`，不会被
当成工具失败。所有 MCP 写入自动附带 `source = agent`、调用方
名称和可选原因，并产生与 Web 操作相同的状态、排期、版本或变化
历史。

Server Instructions 只保留 MCP-only 调用方必须知道的核心规则。
`flowtrace://guide` 以及 `flowtrace://concepts/*` 资源按需提供对象、
状态、排期、依赖和返工概念，但读取这些 Resource 不是正确调用
Tool 的前置条件。

## 本地 stdio 调试

为了本地开发保留 stdio 入口：

```bash
npm run build -w @flowtrace/shared
npm run build -w @flowtrace/mcp
npm run dev -w @flowtrace/mcp
```

默认 API 地址为 `http://127.0.0.1:3100/api`，可用 `FLOWTRACE_API_URL`
覆盖。stdio 是调试便利入口，正式集成应使用镜像内置的远程
Endpoint。
