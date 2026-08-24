export const flowTraceResources = [
  {
    name: 'flowtrace-guide',
    uri: 'flowtrace://guide',
    title: 'FlowTrace 使用导航',
    description: '选择查询和写入工具的最小指南。',
    text: `FlowTrace 记录长期项目中每次计划交付的真实过程。

查询对象时先用 search 取得稳定 ID；同名结果多于一个时不要猜测。
回答项目或版本整体状态时优先读取 Snapshot，回答近期变化时优先读取 Changes Since。
写入前读取目标当前值，只在用户明确要求改动时调用写工具。
所有状态、排期、版本和依赖修改必须经由业务工具，不要绕过历史机制。`,
  },
  {
    name: 'flowtrace-model',
    uri: 'flowtrace://concepts/model',
    title: '对象模型',
    description: 'Project、Version、Requirement、Stage 和 Bug 的职责。',
    text: `Project 是长期存在的研发对象。
Version 是 Project 中的一次计划交付，不是另一个项目。
Requirement 是一项可追踪的交付内容，可属于 Version 或需求池。
Stage 是 Requirement 内的实际工作环节，每个环节可有独立负责人、状态和排期。
Bug 是 Requirement 下需要独立追踪的缺陷，也有自己的负责人、状态和排期。`,
  },
  {
    name: 'flowtrace-status',
    uri: 'flowtrace://concepts/status',
    title: '阶段与状态',
    description: '工作环节和执行状态的区别。',
    text: `Stage 回答“正在做哪类工作”，Status 回答“这项工作现在处于什么情况”。

状态包括：待开始、进行中、等待中、阻塞、已完成和已取消。
等待中表示恢复条件已知，必须记录原因，能确定时可记录预计恢复时间。
阻塞表示恢复条件尚不明确，必须记录原因。
不要为了表达等待或阻塞而新增一个 Stage。`,
  },
  {
    name: 'flowtrace-schedule',
    uri: 'flowtrace://concepts/schedule',
    title: '排期语义',
    description: '初始基线、当前计划与实际过程。',
    text: `Baseline 是首次建立排期时的初始基线，不应被后续调整覆盖。
Current Plan 是当前有效计划，调整时必须保留排期历史和原因。
Actual 是真实开始和结束时间，应由状态历史或明确的事后补录产生。
补录过去发生的事情时传 effective_at；排期变化时传 reason。`,
  },
  {
    name: 'flowtrace-dependency',
    uri: 'flowtrace://concepts/dependency',
    title: '依赖关系',
    description: '事项依赖和跨项目协作。',
    text: `Dependency 记录后继事项需要的前置事项，可连接 Requirement、Stage 或 Bug，也可跨 Project。
依赖未满足时 FlowTrace 返回警告，但不强制阻止推进。
真正的跨项目依赖应优先指向具体 Stage；只有无法判断具体环节时才使用 Requirement 级依赖。
不要因为存在双向协作就拒绝建立依赖。`,
  },
  {
    name: 'flowtrace-rework',
    uri: 'flowtrace://concepts/rework',
    title: 'Bug 与返工',
    description: '独立缺陷与过程返工的取舍。',
    text: `可独立描述、分配、排期或验收的缺陷，应创建 Bug。
为了修复缺陷而发生一段需要单独追踪的返工流程时，可在 Requirement 中增加返工 Stage。
不要把每次返工都写成 Bug，也不要用一个含糊的“Bug 修复”Stage 取代所有独立缺陷。`,
  },
] as const;
