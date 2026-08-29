# 身份认证

身份认证是 FlowTrace 的必需能力，不是部署时可以关闭的功能。Better Auth 负责
会话、账号、外部登录协议和个人 API Key；FlowTrace 在其上维护登录账号与业务
人员的绑定，并用同一身份保护 Web、HTTP API 和 MCP。

## 登录适配器

系统不把业务模型绑定到某一家身份平台。一个实例必须通过
`FLOWTRACE_AUTH_PROVIDER` 明确选择且只选择一种适配器：

- `local`：首次打开时创建唯一所有者账号，适合个人和小型私有实例；
- 标准 OIDC：通过 discovery、签名验证后的 ID Token 和 `sub` 建立稳定身份；
- 企业微信：通过自建应用网页授权取得 `(CorpID, UserId)`，应用
  `access_token` 只在服务端内存中短时缓存，不写入账号表。

本地模式完成初始化后不再提供注册入口，服务端也会拒绝后续注册请求。它不是
绕过认证的开发开关，可以用于正式部署。外部适配器不显示本地密码表单，也不
允许自行注册。本地所有者可以在个人资料中修改密码，修改后其他设备上的会话
会被撤销。

OIDC 的回调地址为
`<FLOWTRACE_AUTH_BASE_URL>/api/auth/callback/oidc`；企业微信为
`<FLOWTRACE_AUTH_BASE_URL>/api/auth/callback/wecom`。本地模式只需基础配置：

```text
FLOWTRACE_AUTH_PROVIDER=local
FLOWTRACE_AUTH_SECRET=<至少32字符的随机密钥>
FLOWTRACE_AUTH_BASE_URL=https://flowtrace.example.com
FLOWTRACE_AUTH_TRUSTED_ORIGINS=https://flowtrace.example.com
```

OIDC 模式配置为：

```text
FLOWTRACE_AUTH_PROVIDER=oidc
FLOWTRACE_AUTH_SECRET=<至少32字符的随机密钥>
FLOWTRACE_AUTH_BASE_URL=https://flowtrace.example.com
FLOWTRACE_AUTH_TRUSTED_ORIGINS=https://flowtrace.example.com

FLOWTRACE_OIDC_ISSUER=https://id.example.com
FLOWTRACE_OIDC_CLIENT_ID=flowtrace
FLOWTRACE_OIDC_CLIENT_SECRET=...
FLOWTRACE_OIDC_NAME=企业账号
```

企业微信模式配置为：

```text
FLOWTRACE_AUTH_PROVIDER=wecom
FLOWTRACE_WECOM_CORP_ID=...
FLOWTRACE_WECOM_AGENT_ID=...
FLOWTRACE_WECOM_SECRET=...
FLOWTRACE_WECOM_SCOPE=snsapi_privateinfo
```

不能只填写某组配置的一部分；适配器缺失、取值未知或配置不完整时应用会拒绝
启动。

## 人员绑定

Better Auth 的用户是登录账号，FlowTrace 的 Person 是历史中稳定的负责人身份，
两者不能合并成姓名字符串：企业内可能有同名成员，而且人员停用后仍需保留
历史关联。

外部身份首次登录时，系统优先用提供方确认的邮箱匹配预先建立的 Person；没有
同邮箱人员时自动创建 Person。提供方没有返回可信邮箱时也会创建独立 Person，
绝不按姓名猜测，更不允许用户从全员目录中自行认领。邮箱已被另一登录身份占用
等歧义会阻止登录，留给管理员核对数据。

绑定同时保存提供方稳定主键以及姓名、邮箱的字段管理权。企业微信等目录适配器
管理的字段会在登录时同步，在 FlowTrace 的个人资料和人员目录中只读。本地模式
由 FlowTrace 管理姓名，登录邮箱则由账号系统管理。

Person 不要求拥有登录账号。管理者可以预先建立只有姓名和邮箱的员工，也可以
保留永远不会登录的虚拟成员或外部协作者；前者将来以相同可信邮箱首次登录时会
自动关联，不会形成需要逐个分配的长期悬挂账号。

## Web 与机器访问

浏览器使用 HttpOnly 会话 Cookie。MCP 和其他机器调用使用“AI 接入”页面创建的
个人 API Key，可通过 `Authorization: Bearer <key>` 或 `X-API-Key` 发送。密钥
只在创建时显示完整值，可以随时撤销。

开发 Compose 选择 `FLOWTRACE_AUTH_PROVIDER=local`。首次打开创建所有者后，
同一实例只保留登录，不再开放注册；不存在无认证运行模式。

当前阶段没有 RBAC：认证解决“你是谁”，尚不限制某位组织成员只能访问某些
项目。后续权限能力应建立在同一身份之上，而不能另开一条绕过认证的接口。
