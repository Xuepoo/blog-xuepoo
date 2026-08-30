---
title: CtxCtl 介绍
description: 介绍 CtxCtl —— 一个给 coding agent 压缩上下文、byte-stable 的纯 CLI 上下文层，让 agent 少读、读精、命中 prompt cache。支持 14 种语言、MCP adapter、self-healing symbol lookup 等特性。
date: 2026-08-13
slug: ctxctl-jie-shao
tags:
  - AI
  - CLI
  - Rust
  - tree-sitter
  - coding-agent
---

## CtxCtl 介绍以及动机

CtxCtl 是一个纯 CLI、零 MCP、无状态的上下文层，给 coding agent 用的：**让 agent 只读它需要的符号切片（symbol slice），并把命令输出压缩掉**，而不是把整个文件和整段原始日志灌进上下文。核心卖点是 **byte-stable**——相同输入产生相同字节，从而命中 provider 的 prompt cache。

动机很直接：**你的 coding agent 为每一个字节的上下文付钱**。

Agent 在真实项目里是怎么"读"的？两个最典型的浪费：

1. **读整个文件**。一个几百行的源码文件，agent 往往只需要里面一个函数，但它会把整个文件读进去，然后烧 token 反复重读它真正关心的那一段。
2. **灌原始命令输出**。`cargo build` 一次报错可能有几十上百行日志，其中大部分是噪音，agent 需要的是出错的那几行，却把整段日志都塞进上下文。

更糟的是，这两件事是累积的：一次会话里读十次文件、跑五次构建，上下文就爆炸了。而 token 是按量付费的——多读的部分全是你花的钱。

CtxCtl 用两个机制解决：

- **tree-sitter 符号切片**：把 AST 符号定位映射回原源码的字节范围，agent 只读它真正需要的那一个函数。
- **规则驱动输出压缩**：用 rg 规则把命令输出压成保留关键行的精简版本。

```bash
ctxctl outline src/server.rs
```

```text
# src/server.rs  [12 symbols, ~2.1 KB -> ~410 tokens, saved ~80%]
  fn     handle_request  L:42-58      pub async fn handle_request(&self, id: u64)
  struct Config           L:60-71      pub struct Config {
  fn     validate         L:73-88      fn validate(cfg: &Config) -> Result<(), Error> {
```

```bash
ctxctl symbol src/server.rs --name handle_request --compact
```

```text
# handle_request  src/server.rs:42-58  (58 tokens, saved ~85%)
pub async fn handle_request(&self, id: u64) -> Result<String, Error> { ... }
```

```bash
ctxctl exec "cargo build"
```

```text
$ cargo build
error[E0308]: mismatched types --> src/main.rs:12
... [34 lines omitted]
Saved ~70% (1,240 -> 372 tokens)
```

## 几个关键设计决策

### 1. 切片（slices），不是摘要（summaries）

这是和"让 AI 总结文件"最本质的区别。CtxCtl 的符号来自**原源码的字节范围切片，绝不改写**。

```bash
ctxctl symbol src/server.rs --name handle_request   # 返回原文，不是转述
```

这有两层好处：第一，**准确**——agent 看到的是精确、可索引的代码，而不是可能出错的转述；第二，**可缓存**——原文切片是确定性的，摘要则每次可能不同，破坏缓存。

### 2. Byte-stable 输出：命中 prompt cache

这是 CtxCtl 在 AI 时代真正的杀手锏，也值得单独讲清楚。

Anthropic 和 OpenAI 的 prompt cache 都按**输入前缀**缓存：相同的前缀会命中缓存，价格更低、延迟更低。要让缓存命中，输出必须满足两个条件：

- **字节稳定**：相同输入一定产生相同字节。没有时间戳、没有计数器。
- **位于前缀**：这段输出要出现在上下文靠前且稳定的位置。

大多数 CLI 工具天然破坏第一点——它们的输出带时间戳、随机顺序、计数器。CtxCtl 把"确定性输出"当成一等公民，从设计上保证。

注意我上面说"前缀"这个限定不是废话。它意味着 byte-stable 是**必要但非充分**的条件：如果 agent 把"整个文件 + 符号切片"一起喂，切片并不天然贴着缓存边界。所以正确的用法是让 agent **优先用切片代替整文件**，这样稳定内容才能成为稳定的前缀。这一点在使用时要意识到。

### 3. 分层架构，复用优先

Rust edition 2024 的 workspace，分三个 crate：

- **`ctx-symbol`** —— 纯符号引擎：`Language` trait、`Symbol` 结构、tree-sitter 解析、按字节范围切原源码。**无 I/O 副作用**（只读文件），可以独立复用。
- **`ctx-exec`** —— 基于 rg 的规则驱动输出压缩，byte-stable。
- **`ctxctl`** —— 薄的 clap v4 壳，把上面两个串起来。

分层的意义是：`ctx-symbol` 是一个**可复用的引擎 crate**，不只是这个 CLI 的内部实现。将来任何想在自己的工具里做"按符号读源码"的，可以直接依赖它，而不必重写 tree-sitter 那套东西。

CtxCtl 支持 **14 种语言后端**（Rust、Python、TypeScript、JavaScript、Go、Java、C、C++、C#、Ruby、Lua、PHP、Swift、Kotlin），全部通过 tree-sitter，**零网络依赖**。

### 4. Self-healing symbol lookup（v0.3.0+）

符号查找现在内置**自愈**机制：当精确匹配失败时，自动 fallback 到 ranked suggestions（基于名称相似度、同文件、同模块、类型签名兼容性），并自动返回对应 outline 供 agent 参考。配合 MCP tool `ctxctl_symbol`，agent 不再会因为拼写错误或重构导致的符号丢失而卡死，而是直接拿到候选列表。

```bash
ctxctl symbol src/main.rs --name runx   # 故意拼错
# 自动返回 outline + 建议：run、run_async、run_sync 等
```

### 5. MCP Adapter（可选）

从 v0.3.0 开始，`ctxctl mcp` 提供 stdio MCP server，暴露全部 5 个 tools（`outline`、`symbol`、`read`、`deps`、`exec`），符合 JSON-RPC 2.0。给 MCP-native agent（Cursor、Claude Desktop 等）直连：

```json
{
  "mcpServers": {
    "ctxctl": {
      "command": "ctxctl",
      "args": ["mcp"]
    }
  }
}
```

CLI 仍然是 canonical interface；MCP 只是适配层，不改变底层行为。

## 命令一览

| 命令 | 用途 |
| ---- | ---- |
| `ctxctl outline <file>` | 符号大纲 + token 节省统计 |
| `ctxctl symbol --name <sym>` | 单个符号的原源码切片（`--compact` / `--signature` / `--lines`） |
| `ctxctl read --lines 100-150,200-210` | 原始行范围切片（不走 AST，适合"就想要这几行"） |
| `ctxctl deps <file>` | 导入/模块依赖图（本地 / 外部 / 忽略） |
| `ctxctl exec [--keep] "<cmd>"` | 跑命令并压缩输出 |
| `ctxctl mcp` | MCP stdio server（可选 adapter） |

几个全局 flag：

```bash
ctxctl outline src/main.rs --json        # 机器契约（schema_version / tool / path / symbols）
ctxctl outline src/main.rs --config x.toml
ctxctl exec "cargo test" --keep "FAILED|passed"   # 只保留匹配关键行的输出
```

配置优先级：`--config` > `.ctxctl/config.toml`（向上查找）> XDG > 默认值。

## 实测效果（bench 结果）

用脚本化 agent（pi driving deepseek-v4-flash on OpenRouter）跑四个真实任务（三个 51–96 KB 源文件 + 一个 1914 行 build log）：

| Measurement | Result |
| ----------- | ------ |
| Native `ctxctl mcp` tools vs built-in read/bash — session cost | **−33%** |
| Same benchmark — uncached (fully billed) input tokens | −31% |
| Log-analysis task via `ctxctl exec` | **−84% cost** |
| Exploring a 96 KB file through outline/symbol slices | −86% uncached input |
| File outlines vs whole-file reads | 91–95% smaller |

Savings scale inversely with provider prefix-caching quality：models 缓存激进的依然切 uncached input，弱缓存模型（solar-pro4）也省了 47% session cost。Exec 压缩是条件最弱的胜利（~80%+ everywhere）。

## 和 CarryCtx 的关系

CtxCtl 和 CarryCtx 是我同一套思路的两半，核心信念是：**agent 的上下文是宝贵资源，别塞没用的**。

- **CarryCtx** 管的是"跨会话的记忆"——让 agent 记住该做什么、做到哪，解决上下文的时间维度。
- **CtxCtl** 管的是"单次会话里的瘦身"——让 agent 少读、读精，解决上下文的空间维度。

我自己的用法就是：用 CarryCtx 管理 VectoJS 的每个任务和 checkpoint，用 CtxCtl 在每次会话里把要读的代码和命令输出压小。两个配合，就是 AGENTS.md 里写的 "dogfood the carryctx + ctxctl loop"。顺便说一句，VectoJS 是 TypeScript 项目，`ctxctl` 的 TS 后端 + `deps` 命令正好派上用场——import 图对一个大项目很有用。

## 它解决不了什么（诚实地说）

1. **它是"必要非充分"的缓存优化**。byte-stable 不等于一定能命中 cache，还要保证稳定内容在上下文前缀。要用对姿势。
2. **符号引擎本身不罕见**。tree-sitter 符号定位、原源码切片，ast-grep、ctags、clangd 这些都能做。CtxCtl 真正的差异化在 **exec 输出压缩 + 和 agent 工作流的编排**，而不只是符号引擎本身。护城河在用法，不在切片这个动作。
3. **它管单次会话，不管跨会话**。这是 CarryCtx 的活，别指望 CtxCtl 记住任务状态。
4. **目前还是我在自己项目里 dogfood**。省 token、命中 cache 的效果最好有真实数据支撑，别轻信 README 的数字。

## 现在怎么用

```bash
cargo install ctxctl        # 或 npm i -g ctxctl / bun add -g ctxctl
```

也在 GitHub Releases（含 `.deb` / `.rpm` / `.apk` / Arch 包）、Homebrew、Scoop、Docker 上有分发。当前版本 **0.3.3**，Rust 编写，MIT 协议。

给 agent 装上对应的 skill，它就会优先用切片读代码、压缩命令输出：

```bash
# 列出可用 skills
npx skills add Xuepoo/ctxctl-skills --list

# 安装核心 skill 给所有检测到的 agent
npx skills add Xuepoo/ctxctl-skills --all

# 或指定 agent
npx skills add Xuepoo/ctxctl-skills \
  --skill ctxctl-core \
  --agent codex \
  --agent claude-code \
  --agent cursor \
  --agent github-copilot
```

`outline` / `symbol` / `read` / `deps` / `exec` 这套工作流，配合 skill，能让 agent 每次任务少烧不少 token，而且跑起来 cache 友好。如果你也在调教 agent 处理大项目，可以一起试试——尤其是那个 `--keep` 的 exec 压缩，处理构建日志是真的好用。