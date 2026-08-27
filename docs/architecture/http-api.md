# HTTP API

后端统一挂载在 `/api`，Swagger UI 位于 `/api/docs`，原始 OpenAPI 文档位于
`/api/openapi.json`。接口使用 JSON，时间均为 ISO 8601 字符串。

## 业务入口

- `/project-rhythms`：维护新建项目可选的节奏及其默认环节。
- `/projects`、`/people`、`/versions`：维护项目边界、负责人目录和交付版本。
- `/requirements`：创建需求时可复制项目当前模板，也可直接提交按顺序排列的
  真实阶段，并支持排期和版本迁移。
- `/stages`、`/bugs`：维护独立工作项、计划和可补录的状态历史。
- `/history/status/:id`：指向一条已有状态历史进行显式修正，并在
  变化事件中保留修正前后的值和原因。
- `/dependencies`：连接需求、阶段或 Bug；未满足关系只产生提示。
- `/search`：搜索或按类型列举可被 Agent 稳定引用的业务对象。
- `/snapshots`：一次读取项目、版本或需求的结构化事实与风险聚合。
- `/changes`：按时间获取增量事件，支持全局、项目、版本和需求
  范围过滤。
- `/batch`：对少量相互独立的维护操作逐项返回成功或失败；当前不是事务式
  导入接口，调用方不得把部分成功解释成整批完成。

## 写入来源

写请求可携带：

```json
{
  "source": "agent",
  "agentName": "PM Assistant",
  "reason": "根据项目例会结论调整"
}
```

`source` 可选值为 `manual`、`api`、`agent`。Agent 修改状态、排期和目标版本
仍调用正常业务接口，因此会产生与 Web 操作相同的历史和增量事件。

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
