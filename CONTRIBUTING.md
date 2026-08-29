# 参与 FlowTrace 开发

感谢你愿意改进 FlowTrace。项目仍处于早期阶段，提交实现前先确认问题是否符合
FlowTrace 的定位：用尽量轻量的方式记录研发需求的计划、变化和真实过程，而
不是扩展成一套通用 Jira。

## 开始之前

- Bug 请使用 Bug 模板提交，并提供可复现步骤、预期结果和实际结果。
- 新功能请说明它解决的研发协作问题，而不只是描述期望增加的字段或按钮。
- 较大的模型、API 或交互改动，建议先创建 Issue 对齐边界再开始实现。
- 安全问题不要创建公开 Issue，请按 [`SECURITY.md`](SECURITY.md) 报告。

## 本地开发

推荐安装 Docker Engine 和 Docker Compose v2，然后运行：

```bash
docker compose up -d --build
```

Web 默认位于 <http://localhost:5173>，API 和 OpenAPI UI 位于
<http://localhost:3100> 与 <http://localhost:3100/api/docs>。开发环境仅在
空库中注入一次虚构演示数据。

也可以使用 Node.js 24、npm 10 或更高版本和 PostgreSQL 在主机运行：

```bash
npm ci
npm run dev
```

依赖变更应使用 `npm install --save` 或 `npm install --save-dev`，并提交同步更新
的 `package-lock.json`。

## 提交改动

提交 Pull Request 前运行：

```bash
npm run format:check
npm run typecheck
npm test
npm run build
```

界面改动还应人工检查桌面和窄屏布局，以及浅色和深色外观。新增核心 Web 操作
时，请同时检查 HTTP API、OpenAPI 和 MCP 是否需要提供等价能力。

Pull Request 应保持单一、可解释的目标，并在描述中说明：

1. 解决了什么问题；
2. 最终采用了什么设计；
3. 如何验证；
4. 是否涉及数据迁移、兼容性或安全边界变化。

更具体的工程结构、业务约束和提交规范见 [`AGENTS.md`](AGENTS.md)。

## 许可证

提交代码即表示你同意该贡献按照项目的
[Apache License 2.0](LICENSE) 发布，并确认自己有权提交这些内容。
