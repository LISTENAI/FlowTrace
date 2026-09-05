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
会话，业务数据仍由应用连接的 PostgreSQL 持久化。当 FlowTrace 通过
多个 Host 访问时，可用逗号分隔的 `FLOWTRACE_MCP_ALLOWED_HOSTS`
启用 Host 白名单校验。

每个请求都必须携带当前用户在“AI 接入”页面创建的个人密钥：

```text
Authorization: Bearer ft_...
```

也可以使用 `X-API-Key` 请求头。服务会以密钥所属用户的身份执行 MCP 调用，
并把同一凭证传递给内部 HTTP API；`/mcp` 不存在匿名访问路径。

## Tool 与返回值

MCP 提供有明确业务语义的 Tool（实时清单以 tools/list 为准）：

- 查询：对象搜索，项目和版本快照，需求完整详情，按时间的
  增量变化、人员跨项目工作、零碎待办，以及当前 Agent 交底与交底修订历史。
- 写入：创建、修改和删除空版本，创建和修改需求，独立分配负责人，移动版本，增加
  阶段，修改阶段资料与顺序，更新阶段或 Bug 状态，调整排期，报告 Bug，
  建立和解除依赖，维护 Agent 交底，审计式删除误建事项。
- 零碎待办：创建、读取和修改待办，更新状态、分配负责人及调整排期。
- 协调修改：`preview_changes` 在回滚事务中演练完整计划并返回确认令牌，
  `apply_changes` 原子执行同一计划并返回实际变化和对账结果。

对于服务声明支持的已有工作流调整，取消旧阶段、迁移依赖或三项以上关联
写入必须使用协调修改。创建需求、报告 Bug、移动版本和待办操作当前不在
原子操作集合内；跨这些操作的导入按明确边界执行并报告已完成范围，不能
声称整批原子成功。预演不要求重复确认已授权的相同具体计划；新业务选择或
影响范围变化须先展示并确认。计划内操作以 `operation_id` 命名，后续
操作可以引用先前新建的阶段。服务端要求先建立替代结构和正确关系，再停用
旧项；项目在预览后发生变化时会拒绝旧令牌。依赖仍只能来自用户明示或权威
来源，协调接口不会把 Agent 的流程猜测变成事实。

`create_requirement` 可省略 `stages` 以复制项目模板，也可直接提供
按顺序排列的真实阶段。后者用于外部计划已经给出实际工作分解的
场景，避免先复制通用模板、再批量取消造成无意义历史。
Requirement 必须归属 Project，但目标 Version 可选；`create_requirement`
不传 `version_id`、传 `null` 或空白值都会稳定进入需求池。MCP 在
边界归一化这些缺省形式，不应将 Harness 产生的空字符串透传为非法
UUID，也不应为了写入而虚构 Version。
创建或修改阶段时可传 `work_domain`，其值用于跨不同项目流程聚焦产品、
设计、研发、验证与交付等同类工作；省略时服务端会按阶段名称给出初始
分类，调用方不应为了分类而改写真实阶段名称。

Project / Version Snapshot 中，每个需求的 `activeStages` 给出全部并行
活跃阶段，`nextStages` 给出紧邻的下一阶段；顶层 `reviewItems` 聚合待
补负责人、排期或目标版本等管理缺口。`currentStage` 仅保留为兼容的
注意力提示，不代表需求的全部当前工作。

Project / Version Snapshot 同时返回 `agentHandoff`。它是跨 Agent 会话的项目
交底，与人类项目说明和结构化业务事实分离。专门的 Tool 可读取、按当前修订号
更新和追溯历史；并发修订冲突必须重新读取，不能盲目覆盖。

读 Tool 返回 `success` 和结构化 `data`。写 Tool 至少返回：

```text
success
entity
history
warnings
```

依赖未满足时操作仍然成功，具体问题放入 `warnings`，不会被
当成工具失败。所有 MCP 写入自动附带 `source = agent`、调用方
名称、可选的自报模型标识与原因，并产生与 Web 操作相同的状态、排期、版本或
变化历史。模型标识只能在运行时准确提供时填写，不能猜测。

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
覆盖，并通过 `FLOWTRACE_API_KEY` 提供个人访问密钥。stdio 是调试便利入口，
正式集成应使用镜像内置的远程 Endpoint。

## v0.6 接入约定

- `get_capabilities` 查询能力与推荐 Skill 版本；`get_current_identity` 确定“我”。
- `get_changes_since` 保持 `data` 数组，新增 `pagination`。沿 `nextCursor` 翻页，
  保留原查询范围与 `until`，直到 `hasMore=false`。`search` 支持项目/版本范围与
  `offset`，返回 `total`、`hasMore`、`nextOffset`，不能把第一页当作全部。
- 写 Tool 可传 `request_id`、`source_ref`、`reported_at`。省略请求标识时 MCP
  客户端生成一个；网络错误信息携带该标识。使用 `get_operation_result` 核验，
  或保持全部原参数和标识重放。不要在结果未知时换标识重建。
- 写结果新增 `mutation`，包含本次事件、真实调用者与新增历史数组。
  原 `entity/history/warnings` 保持兼容；完整历史以 `mutation.history` 为准。
- Multica 等宿主负责凭据传递、会话和授权状态。共享服务账号的 actor 只代表该
  服务账号；不得把模型传入的姓名当作真实委托人身份。需要逐人审计时传递各人的
  凭据，或另行实现经过认证的委托协议。
