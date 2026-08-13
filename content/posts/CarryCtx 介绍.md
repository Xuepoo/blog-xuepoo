---
title: CarryCtx 介绍
description: 介绍 CarryCtx —— 一个给 coding agent 持久项目记忆的本地优先 CLI，解决 AI 编码最痛的跨会话失忆问题。
date: 2026-08-13
slug: carryctx-jie-shao
tags:
  - AI
  - CLI
  - Rust
  - coding-agent
---

## CarryCtx 介绍以及动机

CarryCtx 是一个本地优先的 CLI 工具，给 coding agent（如 Claude Code、Codex、OpenCode、KiRo 这些）一套**跨会话、跨 agent 的持久记忆**：结构化的任务、进度、决策、checkpoint，全部存在你仓库里的一个 SQLite 文件里。

先说动机。用 AI 写代码的人应该都有这个痛点：**你的 agent 在窗口关掉的那一瞬间就失忆了**。今天你让 Claude Code 干到一半，明天开新会话，它完全不知道你在做什么、做到哪、卡在哪、在哪个分支。

更麻烦的是，这些"记忆"会以各种不可靠的形式散落各处：

- **聊天历史不是项目状态** —— 它在 agent 的会话里，关窗就没了；就算能翻，也是流水账，不是结构化的"谁在等谁"。
- **commit message 不解释意图** —— 它告诉你改了什么，不告诉你为什么改、以及下一步要做什么。
- **手写的 Markdown 笔记会过期** —— 你写下来的那一刻它是对的，但只要你不持续手工更新，它就开始骗人。而且没人会认真更新它。

我自己在维护 VectoJS 这种工程，这个问题被放到了最大。VectoJS 是一个 canvas 渲染引擎，拆成十几个互相依赖的子项目（`@vectojs/core`、`@vectojs/desktop`、`@vectojs/styles`、`@vectojs/knowledge-graph`……），而且每个任务可能由不同的 agent（omp / opencode / claude-code / codex）在不同的 worktree 里完成。这种工程最要命的就是：**agent 每次会话都失忆，跨会话的上下文全部散落在各个 agent 的脑子里**。

一个具体的例子：VectoJS 有一个网站任务 `CTX-0327`，它同时阻塞着 `CTX-0328`（WebOS desktop 旗舰）和 `CTX-0329`（styles 声明式样式层）两个大任务，而它自己又依赖 `CTX-0326`。这个依赖图是人肉记不住的。没有 CarryCtx 的话，下一个 agent 接手的唯一方式就是"重新读一遍聊天记录 + 猜"。CarryCtx 要解决的就是这个——**把"agent 的上下文"变成"项目的持久记忆"**。

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

关键点是：**任何 agent、任何窗口、任何 worktree，跑一条 `carryctx resume` 就能精确接上上次的进度**。不用重读聊天记录，不用"catch me up"，不用维护一份会过期的交接文档。

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

**未完成的强依赖（strong dependency）会阻止任务变 Ready**。这逼着你先理清"knowledge-graph 依赖 graph3d 的 2D 相机 → graph3d 先做"这种顺序，而不是想到哪做到哪。对 VectoJS 那种十几个 P3 互相依赖的工程，这个依赖图是人肉记不住的，而 CarryCtx 把"表达依赖"变成了一条命令。

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

交接不再是一段口头描述，而是一个有归属、有任务关联、可追踪的记录。任何 agent 被"点将"时，一条 `handoff list` 就能看到自己该接什么。

### 4. Session 和 worktree：把"当前语境"绑起来

```bash
carryctx session start        # 开启一个会话
carryctx worktree create CTX-XXXX --path .worktrees/...
```

VectoJS 强制"每任务一个 worktree"。CarryCtx 把 worktree 绑定到任务，让"这个分支属于哪个任务、做什么"可追溯。这解决了多任务并行时分不清分支归属的问题。注意 worktree 是全新的，没有 `node_modules`，开工前要先装依赖。

### 5. 审计事件日志

`events` 表是 append-only 的审计流。多 agent 协作时，它能回答"这个决策是哪个 agent 在哪个任务下做的"，避免责任不清——这在几个人（或几个 agent）同时碰一个 repo 时非常重要。

## 设计上的几个坚持

- **本地优先、零服务器、零账号**：没有云端，没有 SaaS，状态就是一个跟着 git 走的 SQLite 文件。你的项目数据不出机器。
- **Per-repo 状态**：每个仓库有自己的 `.carryctx/` 配置和独立的任务 ID 空间。docs、native、core 这些独立 repo 的任务不会互相污染。这正好匹配 VectoJS 这种多仓库工作区——你不需要一个全局项目管理系统来强行统一。
- **Compact 默认输出**：文本输出默认一行一条记录，刻意让 agent 的上下文保持小。要完整记录用 `--json`（完整 envelope，含 blocks/depends_on 依赖图）、`--verbose`（人类可读的完整记录）或 `--format markdown`（给 agent 看的表格）。这不是隐藏数据，是设计。

## 和现有方案比，它好在哪

| 方案 | 问题 | CarryCtx 的替代 |
| ---- | ---- | ---- |
| 聊天历史 | 关窗即失忆，无法跨 agent | 结构化持久状态，`resume` 恢复 |
| commit message | 只讲"改了什么"，不讲"下一步" | checkpoint 明确 Done / Remaining / Blocker |
| 手写 Markdown 笔记 | 一不更新就过期 | 命令写入 SQLite，state 跟着 repo 走 |
| 传统 PM 工具（Linear/Jira） | 面向人、要联网、跟 git 解耦 | 面向 agent、本地、per-repo、绑定 worktree/branch |

CarryCtx 不是又一个项目管理工具，它是**给 agent 用的、和 git 绑定的持久记忆**。

## 它解决不了什么（诚实地说）

我写这篇不是为了吹。CarryCtx 有几条明确的边界：

1. **它不帮你写代码**。它管"知道该做什么、做到哪、谁在等谁"，不管"怎么做对"。真正的工程正确性还是靠测试和 benchmark——比如 VectoJS 弹幕的"5000@240Hz"是测出来的，不是 CarryCtx 给的。
2. **状态可能漂移**。这是它最大的敌人。CarryCtx 不会自动检测代码进度，它是"你告诉它什么就是什么"。如果你做完任务不更新状态，它就骗你。VectoJS 就出过这事：styles 实际上已经通过 CTX-0336~0340 完成到 0.3.0，但 CarryCtx 里还被标成 blocked。**需要 agent 主动同步状态，这是最大的维护成本。**
3. **依赖信息要人维护**。`--depends-on` 是手动声明的，漏声明就得不到阻塞保护。

## 现在怎么用

```bash
cargo install carryctx        # 或 npm i -g carryctx / bun add -g carryctx
```

也在 GitHub Releases、Homebrew、Scoop、AUR（`carryctx` / `carryctx-bin`）上有包。当前版本 0.5.6，Rust 编写，MIT 协议。

如果你也在用 AI agent 维护一个"跨会话、多 agent、多仓库"的工程，CarryCtx 值得一试。对我自己来说，它就是 VectoJS 那套严谨的依赖图、checkpoint、多 agent 协作，从"散落在各 agent 脑子里"变成了"写死在 git 里的持久状态"。只要你能接受"状态要主动同步"这个前提，它对这种工程的价值是真实的、可复现的。
