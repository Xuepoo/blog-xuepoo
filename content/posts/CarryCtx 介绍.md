---
title: CarryCtx 介绍
description: 介绍 CarryCtx 0.8 —— 一个围绕 coding agent 的本地项目生命周期 control plane，管理项目意图、依赖计划、团队协作、worktree、审计与 release evidence。
date: 2026-08-13
slug: carryctx-jie-shao
tags:
  - AI
  - CLI
  - Rust
  - coding-agent
---

## CarryCtx 介绍以及定位

CarryCtx 0.8 是一个本地优先的 CLI 工具，用来管理 coding agent 和 human collaborator 周围的**项目生命周期状态**。它把项目 contract、依赖感知的计划、角色和团队、session、worktree、progress、checkpoint、handoff、review、cleanup、审计和 release evidence 放进同一个 Git-aware SQLite 状态模型里。

“持久记忆”仍然是它带来的结果，但已经不是最准确的定位。更准确地说：**Git 管代码，CarryCtx 管项目意图以及围绕代码工作的生命周期。**

先说动机。用 AI 写代码的人应该都有这个痛点：**一个项目的意图和协作状态无法稳定地留在任何一个 agent 的上下文里**。今天你让 Claude Code 干到一半，明天换成 OpenCode 或 Codex，它不仅不知道做到哪，还不知道任务为什么存在、依赖谁、谁拥有它、哪些 worktree 可以安全清理。

更麻烦的是，这些"记忆"会以各种不可靠的形式散落各处：

- **聊天历史不是项目状态** —— 它在 agent 的会话里，关窗就没了；就算能翻，也是流水账，不是结构化的"谁在等谁"。
- **commit message 不解释意图** —— 它告诉你改了什么，不告诉你为什么改、以及下一步要做什么。
- **手写的 Markdown 笔记会过期** —— 你写下来的那一刻它是对的，但只要你不持续手工更新，它就开始骗人。而且没人会认真更新它。

我自己在维护 VectoJS 这种工程，这个问题被放到了最大。VectoJS 是一个 canvas 渲染引擎，拆成十几个互相依赖的子项目（`@vectojs/core`、`@vectojs/desktop`、`@vectojs/styles`、`@vectojs/knowledge-graph`……），而且每个任务可能由不同的 agent（omp / opencode / claude-code / codex）在不同的 worktree 里完成。这种工程最要命的就是：**agent 每次会话都失忆，跨会话的上下文全部散落在各个 agent 的脑子里**。

一个具体的例子：VectoJS 有一个网站任务 `CTX-0327`，它同时阻塞着两个大任务，而自己又依赖另一个任务。这个依赖图、任务所有权和 worktree 归属不是某个 agent 的私有上下文应该承担的责任。CarryCtx 要解决的就是这个——**把项目的意图和协作事实从 agent 上下文中抽出来，变成可查询、可审计的项目状态**。

## 它不是什么：不是 agent runner

这是 0.8 最重要的边界。CarryCtx 不包装 LLM，不连接 model provider，也不 spawn、schedule 或 route agent。它不决定用哪个模型、不负责重试、不控制并发。

这些属于外部 harness 的职责；CarryCtx 负责保存 harness 协调所需要的 durable facts：谁在团队里、谁拥有任务、任务依赖是否满足、当前 session 和 worktree 是什么、做过哪些决策，以及最终留下了哪些验证和清理证据。它是 lifecycle control plane，不是 Automation Engine。

## 它长什么样

```bash
cd your-project
carryctx init                        # 在仓库里初始化
carryctx agent register --name opencode --provider opencode   # 注册 agent
carryctx task create --title "Add streaming CSV export" --priority P2
carryctx task claim CTX-0014
carryctx session start
carryctx resume                      # 任何会话、任何 worktree，一键恢复
```

恢复时的输出大概是这样：

```text
Task CTX-0014 — Add streaming CSV export
Owner: claude-core · Status: in_progress

Last checkpoint (12m ago):
  Done:      Implemented CSV writer, added unit tests
  Remaining: Add streaming support for >1M rows
  Blocker:   None

Git: branch feature/csv-export, HEAD 32ac891, 2 files dirty
Next: Wire the writer into the streaming pipeline
```

关键点是：**任何 agent、任何窗口、任何 worktree，都可以从同一份项目状态恢复工作**。`resume` 是 lifecycle 的一个读取入口，而不是 CarryCtx “记住了 agent”。

## 核心特性

### 1. 结构化任务 + 明确的依赖纪律

任务是 CarryCtx 的骨架。它有一个完整状态机：

```text
PLANNED → READY → IN_PROGRESS → IN_REVIEW → COMPLETED
              ↘  BLOCKED / CANCELLED（分支）
```

更重要的是依赖。任务之间可以声明依赖关系，而且有强弱之分：

```bash
carryctx task create --title "knowledge-graph" --depends-on CTX-0300 --kind strong
carryctx task depend CTX-AAAA --on CTX-BBBB --kind strong
```

**未完成的强依赖会阻止任务变 Ready**。这逼着你先理清"knowledge-graph 依赖 graph3d 的 2D 相机 → graph3d 先做"这种顺序，而不是想到哪做到哪。对 VectoJS 那种十几个 P3 互相依赖的工程，这个依赖图是人肉记不住的，而 CarryCtx 把"表达依赖"变成了一条命令。

### 2. Progress 和 Checkpoint：把"认知"固化下来

`progress` 有四种类型，都挂在某个任务下面，不是游离的笔记：

```bash
carryctx progress note "..." --task CTX-0327
carryctx progress block "..." --task CTX-0327
carryctx progress list --task CTX-0327
carryctx progress complete <ref>
```

`checkpoint` 是语义更丰富的快照，把"此刻的认知"固化：

```bash
carryctx checkpoint --done "..." --remaining "..." --blocker "..." --task CTX-0327
```

这套机制解决了一个致命问题：**agent 写一半崩了 / 会话断了**。只要会话结束前打一个 checkpoint，下一个 agent 就不是从零开始，而是从 checkpoint 继续。VectoJS 的 AGENTS.md 甚至把这个写成了强制要求——每次会话结束必须 checkpoint。

### 3. Handoff：按 agent 路由的交接

多 agent 协作时，交接是最大的断层。CarryCtx 的 handoff 是按 agent 路由的：

```bash
carryctx handoff create --agent opencode --target omp --task CTX-0327 --summary "..."
carryctx handoff list
carryctx handoff accept HO-0009
```

交接不再是一段口头描述，而是一个有归属、有任务关联、可追踪的记录。任何 agent 被"点将"时，一条 `handoff list` 就能看到自己该接什么。最新版本还支持 `handoff accept --claim-task`，接受交接的同时自动 claim 任务，进一步降低切换成本。

### 4. Team：Commander + Subagent 的持久团队

从 v0.6.0 开始，CarryCtx 引入了**持久团队**概念：

```bash
carryctx agent register --name commander-1 --provider claude-code --kind commander
carryctx agent register --name dev-1 --provider codex --kind subagent --role implementer
carryctx team create --name core --commander commander-1
carryctx team member add core --agent dev-1 --role implementer
carryctx task team set CTX-0042 --team core
```

团队结构写在 `state.sqlite` 里，跨会话、跨 worktree 都在。只读投影命令：

```bash
carryctx team status core            # roster、active sessions、open tasks、counts
carryctx team context core           # commander view：full coordination picture
carryctx team context core --agent-for dev-1   # 只给该 member 需要的切片
carryctx team context core --task CTX-0042     # 只给该任务需要的切片
```

Commander 拿全图，subagent 只拿自己的切片——不再是把整个项目灌进上下文。需要注意的是，CarryCtx 只保存团队事实和投影；真正把切片交给哪个进程，仍由外部 harness 完成。

### 5. Session 和 Worktree：把"当前语境"绑起来

```bash
carryctx session start        # 开启一个会话
carryctx worktree create CTX-XXXX --path .worktrees/...
carryctx worktree remove CTX-XXXX   # 新增：清理 worktree 和注册
```

VectoJS 强制"每任务一个 worktree"。CarryCtx 把 worktree 绑定到任务，让"这个分支属于哪个任务、做什么"可追溯。这解决了多任务并行时分不清分支归属的问题。注意 worktree 是全新的，没有 `node_modules`，开工前要先装依赖。

### 6. Decision (ADR) 和 Graph（代码依赖图）

```bash
carryctx decision create --title "Use WebGPU for compute shaders" --task CTX-0328
carryctx decision list --task CTX-0328
```

把架构决策记录在任务上，不用再翻 issue 或 PR 找"为什么当时选这个方案"。

```bash
carryctx graph build                    # AST 扫描全项目构建依赖图
carryctx graph export --format mermaid  # 导出 Mermaid / DOT / ASCII / JSON
```

AST 级别的代码依赖图，对于 VectoJS 这种几十个 crate / package 的 monorepo，可视化依赖拓扑非常有用。

### 7. Search：跨任务/进度/checkpoint/decision 的全文检索

```bash
carryctx search "markdown worker protocol"
carryctx search aria-owns --type decision --json
carryctx search "auth flow" --status in_progress --assignee my-agent
```

SQLite FTS5 驱动，命中结果自动关联到 owning task、status、branch、高亮 snippet。再也不用记"那个东西在哪个任务里了"。

### 8. 审计事件日志

`events` 表是 append-only 的审计流，支持 keyset pagination。多 agent 协作时，它能回答"这个决策是哪个 agent 在哪个任务下做的"，避免责任不清——这在几个人（或几个 agent）同时碰一个 repo 时非常重要。

### 9. Cleanup、Reconciliation 和 Release Evidence

0.8 开始，生命周期不在“任务完成”处结束。Worktree 清理请求会持久化，并按照项目 policy 进行 reconciliation：

```bash
carryctx worktree cleanup list
carryctx worktree cleanup show CTX-0001
carryctx worktree cleanup run --dry-run
carryctx stats
carryctx event list
```

已经删除的路径会被幂等地当作已清理并移除过期注册；dirty worktree、active session、lock、缺失 Git metadata 以及 jj-colocated repository 则会保留为可见 blocker，而不是静默删除。这样 cleanup 本身也成为可重试、可审计的状态机，`stats` 和 event log 则能为 release 保留实际证据。

## 设计上的几个坚持

- **本地优先、零服务器、零账号**：没有云端，没有 SaaS，状态就是一个跟着 git 走的 SQLite 文件（位于 `<git-common-dir>/carryctx/state.sqlite`，linked worktrees 共享）。你的项目数据不出机器。
- **Per-repo 状态**：每个仓库有自己的 `.carryctx/` 配置和独立的任务 ID 空间。docs、native、core 这些独立 repo 的任务不会互相污染。这正好匹配 VectoJS 这种多仓库工作区——你不需要一个全局项目管理系统来强行统一。
- **Compact 默认输出**：文本输出默认一行一条记录，刻意让 agent 的上下文保持小。要完整记录用 `--json`、`--verbose` 或 `--format markdown`。这不是隐藏数据，是为不同 caller 提供不同投影。
- **External harness 分工**：CarryCtx 持久化协调事实，但不接管进程执行。你可以把它接进任意 agent harness、shell alias、Git hook 或 MCP client。

## 和现有方案比，它好在哪

| 方案 | 问题 | CarryCtx 的替代 |
| ---- | ---- | ---- |
| 聊天历史 | 关窗即失忆，无法跨 agent | 结构化项目状态，`resume` 恢复 |
| commit message | 只讲"改了什么"，不讲"下一步" | checkpoint 明确 Done / Remaining / Blocker |
| 手写 Markdown 笔记 | 一不更新就过期 | 命令写入 SQLite，state 跟着 repo 走 |
| 传统 PM 工具（Linear/Jira） | 面向人、要联网、跟 git 解耦 | 面向 agent 协作、本地、per-repo、绑定 worktree/branch |

CarryCtx 不是 Linear/Jira 的替代品，也不是 agent runtime；它是**和 Git 绑定的、给 agent 协作使用的本地生命周期 control plane**。

## MCP：插进任何 MCP Client

CarryCtx 自带 6 个 MCP tools（stdio），开箱即用：

```json
{
  "mcpServers": {
    "carryctx": {
      "command": "carryctx",
      "args": ["mcp"]
    }
  }
}
```

暴露的 tools：`carryctx_task_manager`、`carryctx_progress_tracker`、`carryctx_context_manager`、`carryctx_decision_logger`、`carryctx_graph_explorer`、`carryctx_project_admin`。Cursor、Claude Desktop 或任何 MCP client 直连即可。

## 它解决不了什么（诚实地说）

我写这篇不是为了吹。CarryCtx 有几条明确的边界：

1. **它不帮你写代码，也不运行 agent**。它管"项目要做什么、做到哪、谁在等谁、能否安全收尾"，不管"怎么做对"。真正的工程正确性还是靠测试和 benchmark。
2. **状态可能漂移**。这是它最大的敌人。CarryCtx 不会自动检测代码进度，它是"你告诉它什么就是什么"。如果你做完任务不更新状态，它就骗你。VectoJS 就出过这事：styles 实际上已经通过 CTX-0336~0340 完成到 0.3.0，但 CarryCtx 里还被标成 blocked。**需要 agent 主动同步状态，这是最大的维护成本。**
3. **依赖和生命周期事实仍需正确维护**。`--depends-on` 是手动声明的，漏声明就得不到阻塞保护；cleanup policy 也不能替你判断业务上是否真的可以删除 worktree。

## 现在怎么用

```bash
cargo install carryctx
```

也在 GitHub Releases、Homebrew、Scoop、AUR（`carryctx` / `carryctx-bin`）上有包。当前版本 **0.8.0**，Rust 编写，MIT 协议。

给 agent 装上对应的 skill，它就会自动用 CarryCtx 管理上下文：

```bash
# 单一入口 skill，覆盖全功能面
bunx --bun skills add https://github.com/Xuepoo/carryctx-skills --skill use-carryctx -y
```

如果你也在用 AI agent 维护一个"跨会话、多 agent、多仓库"的工程，CarryCtx 值得一试。对我自己来说，它就是 VectoJS 那套严谨的依赖图、checkpoint、多 agent 协作、代码依赖图、全文检索，从"散落在各 agent 脑子里"变成了"写死在 git 里的持久状态"。只要你能接受"状态要主动同步"这个前提，它对这种工程的价值是真实的、可复现的。