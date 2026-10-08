# pi-opencode-zen-free

一个 pi agent 扩展，把 **OpenCode Zen** 的免费模型做成一个独立、可动态刷新的 provider：`opencode-zen-free`。

- 每次启动 pi 时，在后台从 `https://opencode.ai/zen/v1/models` 拉取当前可用模型，并结合 pi 内置的 OpenCode 目录筛选出免费模型。
- 按 `Ctrl+Shift+R`（或运行 `/opencode-zen-free`）强制刷新模型列表。
- 零凭据：直接流式对接 OpenCode Zen 的**匿名免费通道**——OpenCode 官方 CLI 无需登录即可使用的那批免费模型（做法与 [opencode2dsh](https://github.com/FishBottle7/opencode2dsh) 一致，针对 pi 的 provider/流式链路做了适配）。

## 安装

本地路径安装：

```bash
pi install /data/data/com.termux/files/home/workspace/pi-opencode-zen
```

或者只在当前这次运行里临时加载：

```bash
pi -e /data/data/com.termux/files/home/workspace/pi-opencode-zen
```

安装后运行 `/model`，搜索 `opencode-zen-free` 即可看到免费模型。

## 使用

| 操作 | 说明 |
| --- | --- |
| `/model` | 选择 `opencode-zen-free` 下的免费模型 |
| `Ctrl+Shift+R` | 强制刷新免费模型列表 |
| `/opencode-zen-free` | 同样的刷新命令（快捷键不可用时使用） |
| `/zen-models` | 列出当前免费模型及其描述（介绍＋适合用处＋注意事项） |

可用模型示例：`big-pickle`、`space-bunny-free`、`mimo-v2.6-flash-free`、`ling-3.1-flash-free`、`fledge-alpha-free`、`longcat-2.5-preview-free`、`muse-spark-1.3-contributor-free` 等。

## 模型描述

每个暴露出来的模型都会带上一行 `description`（数据源：OpenCode Zen 官方文档，2026-10-08 抓取），内容是「介绍；适合：……；⚠️ 注意事项」。维护在 `src/model-descriptions.ts`，未收录的新 `-free` 模型自动落到通用兜底文案；在会话里运行 `/zen-models` 即可看到当前模型的完整描述。

| 模型 | 介绍 | 适合用处 | 注意 |
| --- | --- | --- | --- |
| `big-pickle` | 隐身模型（身份未公开），限时免费 | 日常问答、探索性编码、非敏感副线任务 | 免费期数据可能被用于改进模型 |
| `space-bunny-free` | 隐身模型，零留存策略 | 对隐私有要求的通用编码（免费档里最稳妥） | 零留存、不用于训练 |
| `longcat-2.5-preview-free` | 美团 LongCat 2.5 预览版，零留存 | 长上下文与通用代理任务试用 | 零留存、不用于训练；预览版随时变化 |
| `exo-free` | 限时免费收集反馈 | 模型评测对比、非关键副线任务 | 数据可能被用于改进模型 |
| `fledge-alpha-free` | Alpha 阶段限时免费 | 快速原型、实验性任务 | 稳定性未经保证；数据可能被训练 |
| `mimo-v2.6-flash-free` | 小米 MiMo V2.6 Flash，低延迟 | 补全、commit message、小修小改、并行子代理 | 数据可能被用于改进模型 |
| `mimo-v2.5-free` | 小米 MiMo 上一代 | V2.6 不可用时的备胎 | 实测上游可能 401 |
| `ling-3.1-flash-free` | 蚂蚁 Ling 3.1 Flash，快速档 | 快速编码、批量并行的低风险子任务 | 数据可能被用于改进模型 |
| `ling-3.0-flash-fin-free` | 蚂蚁 Ling 金融领域特化版 | 金融/数据代码、报表与对账逻辑 | 偶发 400/503 |
| `nemotron-3-ultra-free` | NVIDIA Nemotron 3 Ultra 免费端点 | 推理较重的长链路分析 | 试用条款：禁用机密/个人数据，日志用于改进 |
| `nemotron-3.5-lightning-free` | NVIDIA Nemotron 3.5 Lightning 轻量档 | 低延迟结构化输出、分类、信息提取 | 同上，禁用机密/个人数据 |
| `muse-spark-1.3-contributor-free` | Meta Muse Spark Contributor 层 | 非私有代码的探索性任务（responses 通道） | prompt 会用于训练 Meta 模型；可能有地区限制 |
| `jev-1.13-free` | TypeSafe AI Jev，结构化判定模型 | 工单分类、评分、路由等结构化决策 | 非聊天模型，本扩展已排除，不暴露 |

选型速记：日常高频 → `mimo-v2.6-flash-free` / `ling-3.1-flash-free` / `nemotron-3.5-lightning-free`；隐私敏感 → `space-bunny-free` / `longcat-2.5-preview-free`；金融代码 → `ling-3.0-flash-fin-free`。大型重构等复杂任务仍建议用付费模型。

## 工作原理

匿名免费通道对请求形态有严格要求（实测确认），本插件在 pi-ai 的流式层逐项满足它们：

- **请求头（`src/free-lane.ts`）**：`user-agent: opencode/<ver> (<platform> <arch>; node<N>)`、`x-opencode-client: cli`、`x-opencode-request`、`x-opencode-project`、`x-session-affinity`、`X-Session-Id`，以及关键的 `x-opencode-session`。
- **规范 session id**：必须是 `ses_` + 12 位小写 hex + 14 位 Base62 的形态（2026-09-16 起，其他形态一律 `403 FreeTierError: free tier can only be used from within OpenCode`）。插件从对话首条 user 消息派生稳定 id；pi 自身注入的非规范 session/`x-opencode-client: pi` 头会被覆盖。
- **请求体门控**：`stream: true` 且 `tools` 数组里必须有名为 `bash` 和 `read` 的 function 工具（pi 的正常 agent 运行自带这两件工具，因此只是补齐；纯对话/无工具运行注入占位工具并设 `tool_choice: "none"`）。openai-responses 通道（`muse-spark-*`）使用扁平工具形态且只接受 `tool_choice: "auto"`。
- **发现**：`GET https://opencode.ai/zen/v1/models`（无需鉴权）给出当前可用模型 ID；以 pi 内置 OpenCode 目录为元数据源，`cost.input === 0 && cost.output === 0` 视为免费，与实时 ID 取交集；目录里没有、但 ID 以 `-free` 结尾的实时模型会被保守补充（`muse-spark-*` 映射到 `openai-responses`）。
- **排除**：分类器模型（如 `jev-1.13-free`）不会作为聊天模型暴露。
- **鉴权**：匿名（`apiKey: "public"`，上游视为无 key）。
- **缓存**：刷新结果写入 pi 的 `models-store.json`，离线启动时回退到上次结果。

## 配置

无必填配置。`src/free-lane.ts` 中的常量（OpenCode 客户端版本号、匿名 key、门控工具名）集中可调。

## 已知限制

匿名免费通道由服务端严格控制：

1. **不能用 API key。** 带 key 请求免费模型返回 `403 FreeTierError`。本扩展使用匿名访问，并按上游要求的形态构造请求（规范 session id + CLI 伪装头 + bash/read 工具门控），实测可稳定 `200`。
2. **按 IP 限流。** 匿名请求可能返回 `429 FreeUsageLimitError` 并带 `Retry-After`（有时约一小时）；换个网络出口或稍后再试。
3. **个别模型在上游就不可用**（实测：`mimo-v2.5-free` 401、`ling-3.0-flash-fin-free`/`exo-free` 偶发 400/503、`muse-spark-1.2-contributor-free` 500）。这类模型会保留在列表里，但调用会如实报错，刷新后会随上游变化。
4. 上游地区限制（`REGION_BLOCKED`，如 muse）意味着该模型对当前网络不可用。
5. 免费模型列表会随时间变化；本扩展自动跟随。

## 开发

```bash
npm test
```

测试只覆盖纯逻辑模块（`src/free-models.ts`、`src/model-descriptions.ts`、`src/model-report.ts`）。加载与流式链路的验证方式：

```bash
# 无报错即加载成功
pi -e . --list-models

# 触发一次带网络的后台刷新（RPC 模式启动时会刷新目录），随后可离线查看
pi -e . --list-models | grep opencode-zen-free
```

## 文件结构

````
extensions/opencode-zen-free.ts   扩展入口：注册 provider、快捷键、命令
src/provider.ts                   provider 组装（匿名鉴权、API 映射、动态刷新）
src/free-lane.ts                  匿名免费通道的请求形态（派生 id、伪装头、体门控）
src/free-models.ts                免费模型发现与筛选（无 pi-ai 依赖，便于测试）
src/model-descriptions.ts         模型描述：介绍、适合用处、注意事项
src/model-report.ts               /zen-models 报告：id + 描述的 Markdown 列表
src/zen-stream.ts                 流式包装：把 pi-ai 请求接到免费通道
src/constants.ts                  常量
test/free-models.test.ts          模型筛选测试
test/model-descriptions.test.ts   模型描述测试
test/model-report.test.ts         /zen-models 报告测试
test/free-lane.test.ts            通道请求形态测试
```
