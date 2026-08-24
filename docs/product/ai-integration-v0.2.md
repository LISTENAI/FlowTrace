# FlowTrace AI Integration — 增量需求与原 PRD 覆盖说明

> 文档版本：v0.2  
> 文档性质：**在既有 FlowTrace MVP PRD 基础上的增量需求**  
> 适用阶段：基础 Web 与核心项目管理功能已经完成并基本可用  
> 目标：在不重构既有业务模型的前提下，为 FlowTrace 增加 AI 原生接入能力  
> 目标读者：继续开发当前 FlowTrace 的 Coding Agent

---

# 0. 本文与原 PRD 的关系

Coding Agent 已经阅读并归档原 FlowTrace MVP PRD。

**不要重新实现原 PRD 已完成的基础功能。**

原 PRD 中以下核心业务模型继续有效：

- Project 是长期研发对象；
- Version 是一次计划交付；
- Requirement 属于 Project，并可选属于一个 Version；
- Requirement 下包含 Stage 和 Bug；
- Stage 与 Status 分离；
- Waiting 与 Blocked 分离；
- 支持多人负责人；
- 支持 Baseline / Current Plan / Actual；
- 保留状态历史和排期调整历史；
- Requirement 可以跨 Version 移动且 ID 不变；
- 支持同项目和跨项目依赖；
- 依赖默认用于表达事实和风险，不作为强制门禁；
- Bug 独立记录；
- 返工、再次打样、再次验证等过程应保留真实历史；
- 允许补录实际发生时间。

本文只新增或调整 **AI / 机器接口相关要求**。

---

# 1. 优先级与覆盖规则

如果本文与原 PRD 在 AI 集成相关内容上存在冲突：

> **以本文为准。**

需要特别覆盖原 PRD 中以下四点。

## 1.1 Version / Release 已属于现有核心模型

如果原 PRD 的“未来功能”章节仍然残留：

- 项目版本；
- Release；

等表述，视为旧文本残留，忽略。

当前正确模型仍然是：

```text
Project
└─ Version
   └─ Requirement
      ├─ Stage
      └─ Bug
```

不要因为本阶段开发 AI 功能重新设计 Version。

---

## 1.2 Batch / Preview 不是 MCP 第一阶段硬性要求

原 PRD 如果把批量更新描述为 AI MVP 的必须能力，现调整为：

### 必须

- 单项可靠读取；
- 单项可靠写入；
- Snapshot；
- Changes Since；
- MCP Tool；
- Skill；
- AI 写入来源；
- 正确保留业务历史。

### 推荐但不阻塞首版 MCP 上线

- `preview_changes`
- `apply_changes`
- 批量事务式更新

Agent 可以先通过多个业务 Tool 连续完成多项修改。

---

## 1.3 “匿名操作”重新定义

原 PRD 中：

> 不记录操作者身份

继续成立，但仅指：

> **不要求记录具体人工操作者是谁。**

本阶段必须增加或确认存在变更来源：

```text
source:
  manual
  api
  agent
```

推荐语义：

```text
Web 人工操作:
source = manual
actor = null

普通程序接口:
source = api
actor = optional

MCP Agent:
source = agent
actor = optional agent/client name
```

因此：

> 没有用户系统 ≠ 不记录变更来源。

本阶段仍然不要求：

- 用户账号；
- 登录；
- RBAC；
- 人工操作者实名审计。

---

## 1.4 不再强制“完整 REST/OpenAPI 必须先于 MCP”

原 PRD 曾把：

> HTTP API + OpenAPI + MCP

都列为硬性 MVP 能力。

本阶段修正为：

### 必须

- 核心业务逻辑不能只存在于 Web UI 中；
- MCP 必须复用现有业务逻辑；
- Web 和 MCP 对同一业务动作必须得到一致结果；
- 必须存在可复用的 Domain / Application / Service 层，或等价结构。

### MCP 是本阶段必须交付的 AI 接口

### HTTP API / OpenAPI

如果现有系统已经有：

- REST；
- RPC；
- OpenAPI；
- 可复用 HTTP API；

则继续保留并复用。

如果当前系统没有完整的对外 HTTP API：

> **不要求仅为了满足旧 PRD 而额外实现一整套 REST/OpenAPI。**

也就是说，本阶段的 “API-first” 应理解为：

> **业务能力必须可被机器调用，不能绑死在 UI。**

而不是：

> **必须 REST-first。**

---

# 2. 本阶段目标

FlowTrace 已经有基本可用 Web。

下一阶段不是：

> 在 Web 中增加一个聊天框。

而是：

> **让外部 AI Agent 能原生理解、读取和操作 FlowTrace。**

目标包括：

- 查询项目状态；
- 查询版本状态；
- 总结延期、Waiting、Blocked；
- 查询某个 Requirement 为什么还没完成；
- 总结某个时间点以来发生的变化；
- 创建 Requirement；
- 创建 Bug；
- 动态增加 Stage；
- 更新 Stage / Bug 状态；
- 补录实际发生时间；
- 调整 Current Plan；
- 移动 Requirement 到其他 Version；
- 创建跨项目依赖；
- 正确保留所有历史。

---

# 3. AI 集成总体理念

FlowTrace AI 集成分为两层：

```text
MCP        = 能力 + 事实
Agent Skill = 方法论 + 行为策略
```

可以理解为：

```text
MCP        给 AI 眼睛和手
Skill      教 AI 怎么当 FlowTrace 项目经理
```

两者职责不能混淆。

---

# 4. 核心验收原则

## 4.1 MCP-only 必须正确可用

一个完全没有安装 FlowTrace Skill 的通用 Agent，只获得 MCP Server 后，必须能够：

- 发现核心能力；
- 理解 Tool 参数；
- 查询真实数据；
- 执行明确的用户要求；
- 正确保留 Status History；
- 正确保留 Schedule History；
- 正确保留 Version History；
- 不覆盖 Baseline；
- 不直接操作数据库；
- 不依赖知道 FlowTrace 内部代码结构。

因此：

> **Skill 不能成为系统正确性的补丁。**

---

## 4.2 MCP + Skill 应表现得像熟悉 FlowTrace 方法论的人

安装官方 Skill 后，Agent 应进一步理解：

- Project 与 Version 的边界；
- Stage 与 Status 的区别；
- Waiting 与 Blocked 的区别；
- 独立缺陷为什么应该建立 Bug；
- 什么时候应该新增返工 Stage；
- 为什么不能覆盖历史；
- 如何表达 PCB / 固件交叉协作；
- 查询项目整体时应该优先使用 Snapshot；
- 查询最近变化时应该优先使用 Changes Since。

目标：

> **MCP-only：不会明显用错。**  
> **MCP + Skill：知道为什么这么做。**

---

# 5. 推荐总体架构

```text
                     Web UI
                        │
                        ▼
               Shared Business Logic
                / Domain / Service
                   │            │
                   │            │
                Web Flow    MCP Server
                                │
                                ▼
                            AI Agent
                                │
                         FlowTrace Skill
```

必须满足：

1. Web 与 MCP 共享业务规则；
2. MCP 不直接访问数据库绕过 Service；
3. MCP 写操作与 Web 写操作产生同样的历史；
4. 不为 MCP 复制一套状态机；
5. 不为 Skill 复制一套 API 定义；
6. 不要求为了本阶段重写整个现有后端。

如果当前业务逻辑过度耦合在 route/controller 中，可以做必要的最小重构以便复用。

---

# 6. MCP 连接与上下文原则

FlowTrace 的 AI 接入不应依赖：

- 永久保持 WebSocket；
- 永久保持 SSE；
- 长期 MCP 会话；
- 把整个 FlowTrace 文档长期塞入模型上下文。

本阶段 MCP 应采用当前远程 MCP 的 request/response 思路设计。

客户端是否把 Tool schema 放入模型上下文属于 Agent Harness 行为，服务端不能完全控制。

因此服务端应主动降低 Tool 上下文成本：

- Tool 数量克制；
- Tool 名称明确；
- description 简洁；
- 使用结构化 schema；
- 提供聚合查询；
- 避免 Agent N+1 调用；
- 长篇方法论放 Skill / Resource。

---

# 7. MCP Endpoint

必须提供远程 MCP Endpoint。

例如：

```text
/mcp
```

具体 URL 根据现有部署决定。

要求：

- 尽量与现有 FlowTrace 服务一起部署；
- 不维护额外业务状态；
- MCP 本身不直接持有 Agent 会话状态；
- 业务数据仍然正常持久化；
- 不为了 MCP 单独增加复杂账号体系。

如果现有系统只部署在公司可信网络内，可以继续沿用 MVP 的可信环境假设。

不要默认把 MCP 暴露到公共互联网。

---

# 8. MCP Server Instructions

Server 应提供一段短小的 Instructions。

只放 MCP-only Agent 必须知道的关键原则：

1. Project 是长期研发对象。
2. Version 是一次计划交付。
3. Requirement 下有 Stage 和 Bug。
4. Stage 与 Status 是不同概念。
5. 不覆盖 Baseline。
6. 不覆盖历史状态。
7. 独立缺陷优先创建 Bug。
8. Waiting 表示恢复条件明确。
9. Blocked 表示恢复条件不明确。
10. 查询整体状态优先 Snapshot。
11. 查询近期变化优先 Changes Since。
12. 所有写操作必须走业务 Tool。

不要把整份 PRD 塞进 Server Instructions。

---

# 9. MCP Tool 设计原则

## 9.1 Tool 必须体现业务语义

推荐：

```text
create_requirement
report_bug
update_stage_status
reschedule_stage
move_requirement_to_version
add_dependency
```

不要以数据库 CRUD 为中心设计：

```text
insert_record
set_field
update_row
create_relation_record
```

---

## 9.2 Tool Catalog 保持小而清晰

目标约：

> 10～18 个核心 Tool。

不要为每个对象机械生成完整 CRUD × 4。

也不要做一个万能 Tool：

```text
execute_action(type, object, fields)
```

业务语义比 Tool 数量极端压缩更重要。

---

# 10. 本阶段推荐 Tool Catalog

具体名称可按当前代码风格调整，但能力应覆盖以下内容。

## Read

### `search`

搜索：

- Project；
- Version；
- Requirement；
- Stage；
- Bug；
- Person。

返回稳定 ID 和消歧信息。

---

### `get_project_snapshot`

一次取得 Project 整体状态。

至少包含：

- 活跃 Version；
- Requirement 数量；
- In Progress；
- Waiting；
- Blocked；
- 延期；
- Open Bug；
- 外部依赖；
- 最近变化。

---

### `get_version_snapshot`

一次取得 Version 整体状态。

这是 Agent 回答：

> “2.8 现在怎么样？”

的首选 Tool。

至少包含：

- Version 计划；
- Requirement 状态统计；
- Waiting；
- Blocked；
- 延期；
- Open Bug；
- 跨项目依赖；
- 最近变化。

---

### `get_requirement`

返回一个 Requirement 的完整结构化详情。

至少可获得：

- 基本信息；
- Version；
- Stage；
- Bug；
- 负责人；
- Dependency；
- Current Plan；
- Baseline；
- Actual；
- 必要历史。

---

### `get_changes_since`

查询某时间点之后发生的变化。

支持按：

- 全局；
- Project；
- Version；
- Requirement；

过滤。

至少覆盖：

- 状态变化；
- 新增 Requirement；
- Version 移动；
- 新增 / 完成 Bug；
- Stage 新增 / 取消；
- Schedule 调整；
- Waiting / Blocked 进入或解除；
- Dependency 修改。

---

## Write

### `create_requirement`

创建 Requirement。

必须复用现有：

> 根据 Project 当前模板生成 Requirement Stage

的逻辑。

Agent 不应手动逐个复制模板。

---

### `update_requirement`

只修改普通基本字段，例如：

- title；
- description；
- assignees。

不要通过它偷偷修改：

- Version；
- Schedule；
- Status；
- Dependency。

---

### `move_requirement_to_version`

负责：

- Version 移动；
- 移入 Backlog；
- Version History；
- reason；
- effective_at；
- source。

Requirement ID 不能变化。

---

### `add_stage`

动态增加 Stage。

典型：

- 回归测试；
- 修复 #1；
- 二次打样；
- 再次验证。

---

### `update_stage_status`

负责：

- Not Started；
- In Progress；
- Waiting；
- Blocked；
- Done；
- Canceled。

必须：

- 支持 effective_at；
- 支持补录；
- 保留 Status History；
- 保存 Waiting / Blocked 原因；
- source = agent。

---

### `reschedule_stage`

负责修改 Current Plan。

必须：

- 不覆盖 Baseline；
- 保存 Schedule History；
- 保存 reason；
- source = agent。

---

### `report_bug`

在 Requirement 下创建独立 Bug。

支持：

- title；
- description；
- assignees；
- discovered_stage；
- discovered_version；
- target_fix_version；
- optional schedule。

---

### `update_bug_status`

语义与 Stage status 类似。

必须保留历史。

---

### `add_dependency`

支持：

- Requirement；
- Stage；
- Bug；

之间的关系。

必须支持跨 Project。

优先表达具体 Stage 触发关系。

前置依赖未满足时默认：

> Warning，而不是强制禁止后项开始。

---

### `remove_dependency`

如果 Web 当前已经支持删除 Dependency，则 MCP 同样支持。

删除应能被 Changes Since 看到。

---

### `list_people`

如果 `search` 已能可靠查 Person，可以不单独提供。

---

# 11. Snapshot 是硬性要求

Snapshot 不是 AI 生成的文字总结。

它是服务端产生的：

> **结构化事实聚合。**

目的：

> Agent 不需要为了回答“项目现在怎么样”遍历几十个 Requirement。

推荐包含：

```text
identity
schedule
counts
requirements summary
waiting items
blocked items
delayed items
open bugs
external dependencies
recent changes
```

自然语言总结由 Agent 完成。

---

# 12. Changes Since 是硬性要求

`get_changes_since` 是 FlowTrace AI 体验的重要能力。

目标回答：

> “昨天到今天发生了什么？”

而不是让 Agent 每次重新扫描全部项目。

每条 Change 最好包含：

```text
timestamp
event_type
entity_type
entity_id
project
version
before
after
reason
source
```

如果当前系统没有统一 Activity Stream：

- 可以从已有历史表聚合；
- 或增加统一 Activity / Domain Event 层。

不要为了实现 Changes Since 删除现有细粒度历史。

---

# 13. Tool 输出

读写 Tool 应优先返回结构化结果。

写操作成功不能只返回：

```text
success
```

至少应返回：

- entity ID；
- 修改后的关键值；
- effective_at；
- 产生的 History 摘要；
- warnings。

如果操作成功但依赖尚未满足：

```text
success = true
warnings = [...]
```

而不是失败。

---

# 14. 歧义处理

Agent 面对名称查找时：

### 唯一匹配

可以继续操作。

### 多个匹配

不得自动猜测。

返回：

- ID；
- title/name；
- Project；
- Version。

让 Agent 或用户消歧。

---

# 15. AI 写入来源

所有 MCP 写操作：

```text
source = agent
```

如果容易获得，可以附加：

```text
agent_name
client_name
trace_id
```

人工 Web 操作继续：

```text
source = manual
actor = null
```

不因此引入用户系统。

---

# 16. MCP 写操作必须复用现有历史机制

通过 MCP 执行：

- Stage Status；
- Bug Status；
- Schedule；
- Version 移动；
- Dependency；
- 新增 Stage；
- 新增 Bug；

必须产生与 Web 人工操作一致的结果。

必须能在 Web 中看到相同：

- Status History；
- Schedule History；
- Version History；
- Activity / Changes；
- source。

绝对禁止：

> Web 操作走历史，MCP 直接 UPDATE 当前字段。

---

# 17. MCP Resources

Resources 用来放：

> Agent 偶尔需要读取的 FlowTrace 概念说明。

建议：

```text
flowtrace://guide
flowtrace://concepts/model
flowtrace://concepts/status
flowtrace://concepts/schedule
flowtrace://concepts/dependency
flowtrace://concepts/rework
```

分别解释：

- Project / Version / Requirement / Stage / Bug；
- Stage 与 Status；
- Waiting / Blocked；
- Baseline / Current Plan / Actual；
- Stage-level 跨项目依赖；
- Bug 与返工。

Resources 不应成为 Tool 正确使用的前置条件。

---

# 18. Agent Skill

代码仓库中增加官方 Skill。

推荐：

```text
skills/
└── flowtrace/
    ├── SKILL.md
    └── references/
        ├── methodology.md
        └── examples.md
```

---

# 19. SKILL.md 目标

Skill 不重复 API 文档。

Skill 只教授：

> **面对真实研发管理场景应该怎么判断。**

建议 frontmatter：

```yaml
---
name: flowtrace
description: Manage and review FlowTrace engineering projects through the FlowTrace MCP server. Use when the user asks about FlowTrace projects, versions, requirements, stages, bugs, schedules, Waiting, Blocked, dependencies, recent changes, or asks to update FlowTrace.
---
```

正文保持短小。

---

# 20. Skill 必须教授的规则

## Project / Version

```text
Project = 长期研发对象
Version = 一次计划交付
```

不要因为 2.8 → 3.0 而创建新 Project。

---

## Stage / Status

```text
Stage  = 做什么
Status = 做到什么状态
```

不要重新混成：

- 开发中；
- 测试中；
- 打样中；

这种单字段工作流。

---

## Waiting / Blocked

### Waiting

恢复条件相对明确。

例如：

- 等 PCB；
- 等测试环境；
- 等账号；
- 等明确的外部交付。

### Blocked

存在尚未解决问题。

例如：

- 随机复位未定位；
- 技术路线不确定；
- 外部接口无法确定。

---

## Bug / Rework

独立缺陷：

> 优先创建 Bug。

不要因为发现 Bug 就机械重开已完成的开发 Stage。

真正新的过程：

- 修复；
- 二次打样；
- 回归；
- 再次验证；

可以动态新增 Stage。

---

## Schedule

必须理解：

```text
Baseline     = 最初计划
Current Plan = 当前计划
Actual       = 实际
```

延期不能通过覆盖 Baseline 来“消失”。

---

## Dependency

优先建立：

```text
HW / PCB 首次打样
→
FW / 板上验证
```

不要泛化为：

```text
整个固件 Requirement
依赖
整个硬件 Requirement 完成
```

现实协作允许：

```text
HW 打样
→ FW 验证
→ HW 修复
→ HW 再打样
→ FW 再验证
```

---

## 查询策略

用户问：

> 项目怎么样？

优先 Snapshot。

用户问：

> 2.8 怎么样？

优先 Version Snapshot。

用户问：

> FW-128 为什么没完成？

优先 Requirement Detail。

用户问：

> 昨天发生了什么？

优先 Changes Since。

---

# 21. Skill Reference

`references/methodology.md` 建议包含：

- Waiting / Blocked 边界；
- Bug vs Rework Stage；
- PCB / 固件反复协作；
- Version 延期；
- Baseline；
- 典型错误模式。

`references/examples.md` 放实际 Agent 操作案例。

---

# 22. MCP 与 Skill 的职责边界

| 内容 | MCP | Skill |
|---|---|---|
| 当前真实项目数据 | 是 | 否 |
| 写入项目 | 是 | 否 |
| Tool 参数 schema | 是 | 否 |
| FlowTrace 概念简述 | Resource / Instructions | 可引用 |
| 项目管理方法论 | 少量 | 是 |
| 什么时候优先调用哪个 Tool | 少量 | 是 |
| 长篇案例 | 否 | Reference |

核心原则：

> **MCP 是服务能力。Skill 是 Agent 行为指南。**

---

# 23. MCP-only 端到端验收

使用一个：

> 不知道 FlowTrace 代码、不访问数据库、没有安装 FlowTrace Skill 的通用 Agent

只给 MCP Endpoint。

必须完成：

### 查询

- “有哪些项目？”
- “小聆 AI 固件有哪些版本？”
- “2.8 现在怎么样？重点说延期、Waiting 和 Blocked。”
- “FW-128 为什么还没完成？”
- “昨天上午九点以来发生了什么？”

### 写入

- “给 FW-128 新增一个 Bug：二次配网可能失败，负责人张三，发现于测试阶段。”
- “这个 Bug 昨天下午三点已经开始修，补录一下。”
- “因为 PCB 延期，把 FW-128 板上验证的 Current Plan 从 25 日调整到 28 日。”
- “把 FW-142 从 2.8 移到 3.0。”
- “让固件板上验证依赖硬件项目的 PCB 首次打样。”

要求：

- Web 能立即看到结果；
- 所有历史正确；
- Baseline 不被改写；
- Requirement ID 不变化；
- source = agent。

---

# 24. Skill 增强验收

安装官方 FlowTrace Skill。

测试：

### “测试发现三个独立问题，要回开发修。”

Agent 应优先：

- 建三个 Bug；
- 保留原开发历史；
- 必要时新增回归 Stage。

而不是直接重开全部开发历史。

---

### “PCB 已下单，预计周五到，现在固件板上验证没法继续。”

应判断更接近：

> Waiting。

---

### “板子随机复位，还完全没找到原因，后面的验证没法继续。”

应判断更接近：

> Blocked。

---

### “PCB 第一版出来了，固件先开始测，后面发现硬件问题再改。”

Agent 应允许：

```text
HW 首次打样 Done
→ FW 首次验证 In Progress
```

而不是要求整个 HW Requirement Done。

---

# 25. 推荐但不阻塞首版的能力

以下能力有价值，但不是本阶段 MCP 首版验收阻塞项：

- `preview_changes`
- `apply_changes`
- 批量事务
- MCP Prompts
- stdio MCP
- AI Integration Web 页面
- 更完整 HTTP API
- OpenAPI
- Tool Search 专门优化
- 高级 Agent 审计
- Agent 对话历史

如果实现成本很低可以顺手完成。

---

# 26. 本阶段明确不做

不要因为加入 AI 而开发：

- FlowTrace 内置聊天机器人；
- 内置大模型；
- 通用 Agent Harness；
- RAG 平台；
- Vector Database；
- Prompt 管理平台；
- Skill 在线编辑器；
- 多 Agent 编排；
- 企业微信自动监听；
- Conversation 存储平台；
- MCP 长连接管理器。

FlowTrace 的职责是：

> **成为一个对人类和 Agent 都友好的真实项目状态系统。**

不是成为一个 AI 平台。

---

# 27. 推荐开发顺序

1. 阅读现有实现，确认 Web 写操作的业务入口；
2. 确认现有 History / Version / Schedule 逻辑；
3. 必要时抽取共享业务 Service；
4. 增加或确认 `source`；
5. 实现 Snapshot；
6. 实现 Changes Since；
7. 实现 MCP Server；
8. 先完成 read-only Tools；
9. 进行 MCP-only 查询验收；
10. 实现写 Tools；
11. 进行 MCP-only 写入验收；
12. 实现 MCP Resources / Server Instructions；
13. 编写官方 FlowTrace Skill；
14. 用真实 Agent 测试模糊场景；
15. 根据真实 Agent 犯错情况调整 Tool description 和 Skill；
16. 最后再决定是否值得实现 Batch / Preview。

---

# 28. 最终完成标准

本阶段完成后：

## MCP-only

> 一个通用 Agent 只接 MCP 就可以正确、安全地管理 FlowTrace。

## MCP + Skill

> Agent 进一步理解 FlowTrace 的方法论，并能合理处理返工、Bug、Waiting、Blocked、跨项目依赖等模糊场景。

## Web 与 Agent

> 两者操作同一套数据、同一套业务规则、同一套历史。

## 架构

> AI 接入不是建立在网页自动化、数据库直连或第二套业务逻辑之上。

满足以上条件，即认为 FlowTrace 的 AI 接入阶段完成。
