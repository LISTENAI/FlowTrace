# MCP Server

`@flowtrace/mcp` 是第一方 stdio MCP Server。它通过 FlowTrace HTTP API 调用
正常业务服务，不读取数据库，也不维护第二套状态或历史规则。

## 启动

先确保 API 已运行，再执行：

```bash
npm run build -w @flowtrace/shared
npm run dev -w @flowtrace/mcp
```

默认 API 地址为 `http://localhost:3100/api`，可用 `FLOWTRACE_API_URL` 覆盖。
在 MCP 客户端中可将命令配置为：

```json
{
  "command": "node",
  "args": ["/absolute/path/to/FlowTrace/packages/mcp/dist/index.js"],
  "env": {
    "FLOWTRACE_API_URL": "http://localhost:3100/api"
  }
}
```

## 业务工具

读取工具包括项目和版本列表、项目和版本快照、需求详情、按时间增量变化。
写入工具包括创建需求、移动版本、增加阶段、更新阶段或 Bug 状态、调整排期、
报告 Bug 和建立依赖。

所有写入自动提交：

- `source = agent`
- MCP 输入的 `agent_name`
- 可选修改原因 `reason`

工具输入采用业务语义，例如 `update_stage_status`，不会向 Agent 暴露表名、
字段更新器或通用数据库 CRUD。
