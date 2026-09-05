# HTTP API

后端统一挂载在 `/api`，Swagger UI 位于 `/api/docs`，原始 OpenAPI 文档位于
`/api/openapi.json`。接口使用 JSON，时间均为 ISO 8601 字符串。

## 业务入口

- `/project-rhythms`：维护新建项目可选的节奏及其默认环节。
- `/projects`、`/people`、`/versions`：维护项目边界、负责人目录和交付版本；
  空版本可软删除，仍有需求归属时会拒绝。
- `/projects/:id/agent-handoff`：独立于项目说明维护跨 Agent 会话交底；使用
  修订号拒绝并发覆盖，并通过 `/history` 保留完整修订。
- `/requirements`：创建需求时可复制项目当前模板，也可直接提交按顺序排列的
  真实阶段，并支持排期和版本迁移。
- `/stages`、`/bugs`：维护独立工作项、计划和可补录的状态历史。
- `/action-items`：维护可选关联项目或需求的零碎待办及其状态、排期历史。
- `/people/:id/work`：汇总某个人跨项目负责的执行事项和协调中的需求。
- `/history/status/:id`：指向一条已有状态历史进行显式修正，并在
  变化事件中保留修正前后的值和原因。
- `/dependencies`：连接需求、阶段或 Bug；未满足关系只产生提示。
- `/search`：搜索或按类型列举可被 Agent 稳定引用的业务对象。
- `/snapshots`：一次读取项目、版本或需求的结构化事实与风险聚合。
- `/changes`：按时间获取增量事件，支持全局、项目、版本和需求
  范围过滤。
- `/changes/preview`、`/changes/apply`：先在事务中演练关联修改并完整回滚，
  再凭确认令牌原子应用同一计划。计划或项目状态变化后令牌失效；任一操作
  失败时整组不落库。计划内操作可以用稳定的操作名引用先前新建的阶段，
  不需要预先猜测 UUID。预演事务中生成的新对象 UUID 会随回滚失效，不能被
  后续请求引用。
- `/batch`：对少量相互独立的维护操作逐项返回成功或失败；当前不是事务式
  导入接口，调用方不得把部分成功解释成整批完成。

协调变更以 Project 为并发边界。服务端在应用前锁定项目及其工作项，检查预览
时的状态指纹，并要求替代阶段和新关系位于停用旧项之前。返回值同时包含实际
产生的变化事件和项目对账摘要，调用方应据此核验阶段数、活跃依赖数及待补全项。
明确由新阶段接替的旧阶段通过 `POST /stages/:id/supersede` 记录血缘；已完成
旧阶段保留原状态，尚未结束的旧阶段在同一事务中取消，历史不会迁移或丢失。

## 写入来源

写请求可携带：

```json
{
  "source": "agent",
  "agentName": "PM Assistant",
  "agentModel": "openai/gpt-5.6-sol",
  "reason": "根据项目例会结论调整"
}
```

`source` 可选值为 `manual`、`api`、`agent`。Agent 修改状态、排期和目标版本
仍调用正常业务接口，因此会产生与 Web 操作相同的历史和增量事件。
`agentModel` 是可选的自报模型标识与版本；调用方无法准确获知时应省略，服务端
不会根据 `agentName` 或请求来源猜测。

## 状态值

HTTP 内部值保持机器稳定，界面统一显示中文：

| API 值        | 中文含义 |
| ------------- | -------- |
| `not_started` | 待开始   |
| `in_progress` | 进行中   |
| `waiting`     | 等待中   |
| `blocked`     | 阻塞     |
| `done`        | 已完成   |
| `canceled`    | 已取消   |

进入等待中或阻塞时必须提交 `statusReason`。`effectiveAt` 可以是过去时间，
后端会按生效时间重排历史并重算实际开始、结束和各状态持续时间。

## 能力、分页与可恢复写入（v0.6）

`GET /capabilities` 返回协议版本、推荐 Skill 版本、功能标识及原子操作列表。
`GET /me` 返回当前认证身份。客户端应按能力判断流程，不能按 Skill 文案假定
服务支持整个导入计划。

原有 `/changes` 和 `/search` 仍返回数组。完整查询使用：

- `/changes/page?since=...&projectId=...&versionId=...&requirementId=...&limit=...`
  返回 `{items, hasMore, nextCursor, until}`。按事件发生时间和 ID 倒序，最多
  300 条；后续页保留原查询范围及 `until`，传回 `cursor=nextCursor`。
  迁移事件同时可从迁出和迁入版本查询，名称取发生时上下文。
- `/search/page?q=...&types=...&projectId=...&versionId=...&offset=0&limit=20`
  返回 `{items, total, hasMore, nextOffset}`，最多 50 条。搜索结果会随业务修改
  改变，不是数据库快照；写入前仍须重新读取目标。当前检索仍在内存排序。

游标固定查询时间上界，不跨请求持有数据库快照。持续同步应重叠查询近期窗口并
按事件 ID 去重，以覆盖查询时尚未提交的事务；不能把一次响应当作消息投递保证。

领域写请求可设置 `X-FlowTrace-Request-Id: <UUID>`。相同认证用户使用同一标识
和相同方法、路径、JSON 参数重放时返回原结果；参数改变返回 409。服务在同一
数据库事务内保存业务修改和回执；失败时两者均回滚。不同用户的相同标识互不
影响。不要修改重试时的 `effectiveAt`、原因或其他参数。

默认响应保持兼容；加 `X-FlowTrace-Result: receipt` 返回：

```json
{
  "data": {},
  "mutation": {
    "id": "服务端生成的内部变更 UUID",
    "requestId": "调用方执行 UUID",
    "status": "committed",
    "actor": {
      "userId": "认证用户",
      "personId": "人员 UUID",
      "name": "发生时姓名"
    },
    "changes": [],
    "history": { "status": [], "schedule": [], "version": [] }
  }
}
```

`history` 仅包含本次新增记录，补录过去状态时也不以当前最后一条历史冒充。
历史修正操作的前后差异在 `changes.details`。原 204 删除响应在回执模式下为
200。`GET /operations/:requestId` 仅返回当前认证用户的已提交结果；404 可能
表示事务仍在执行或已回滚，调用方应以原标识和参数重放，不应换标识重新创建。
回执当前永久保留；清理策略必须保留幂等墓碑，不能使旧请求再次执行。

预演 `/changes/preview` 不写入回执；旧 `/batch` 保持逐项成功/失败语义，
不提供整批幂等或事务承诺。认证管理端点不属于领域回执协议。

写入还可附带 `sourceRef`（最长 500 字符）和 `reportedAt`（ISO 时间）。
来源标识可跨多个写请求复用，用于业务证据关联，不自动替代请求幂等键。
`actor` 由认证上下文生成，客户端不能伪造；`agentModel` 仍是单独的自报字段。
