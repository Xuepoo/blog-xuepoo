+++
title = "GitHub Actions 使用自托管的 Runner"
description = "探讨如何为 GitHub Actions 配置与使用 Self-Hosted Runner（自托管运行器），包括安全考量、安装步骤以及在私有仓库和企业级项目中的最佳实践。"
date = "2026-06-18"
[taxonomies]
tags = ["CI-CD", "GitHub", "Linux", "DevOps"]
+++

在进行 CI/CD 流水线构建时，GitHub 默认提供的 GitHub-Hosted Runner（托管运行器）通常能满足绝大多数中小项目的构建需求。然而，对于大型项目、需要依赖特定硬件加速的编译任务，或是由于安全要求必须在内网环境中拉取内部服务的项目，使用 **Self-Hosted Runner（自托管运行器）** 是最优的技术选型。

本篇文章将详细探讨自托管运行器的优势、安装配置步骤，以及企业级的安全最佳实践。

---

## 为什么选择自托管运行器？

相比于 GitHub 官方托管的运行器，自托管运行器主要提供以下核心优势：

1. **极致的性能与定制化**：
   你可以选用性能强劲的物理服务器或云主机（如高主频的 CPU、大容量 NVMe 硬盘、甚至是多卡 GPU 算力），并提前在宿主机中安装好所有编译缓存（如 Rust 的 `sccache`、Docker 镜像缓存），使流水线耗时缩短数倍。
2. **安全的内网互联**：
   运行器可以直接部署在你的私有网络（VPC）内，直接访问内网数据库、私有镜像仓库（Registry）或 K8s 集群，无需暴露任何公网入站端口，实现更安全的持续部署（CD）。
3. **零运行额度限制**：
   自托管运行器完全免费，不消耗 GitHub 账号中每月的 GitHub Actions 分钟数额度，仅需支付自备服务器的硬件与网络带宽成本。

---

## 在 Linux 系统上安装与配置 Runner

接下来我们以典型的 Modern Linux（Ubuntu / Arch）系统为例，演示如何为私有项目配置运行器。

### 1. 获取注册 Token

进入你的 GitHub 项目仓库中，依次点击 **Settings** -> **Actions** -> **Runners**，点击 **New self-hosted runner** 按钮，选择 **Linux** 架构，页面中会提供后续配置所需的下载链接及一串注册临时的 `Token`。

### 2. 下载并解压 Runner 客户端

在宿主机中执行以下命令，建议使用专用的非 root 用户（例如 `runner`）来操作，以确保安全隔離。

```bash
# 创建并进入工作目录
mkdir actions-runner && cd actions-runner

# 下载最新的 runner 包 (以版本 v2.316.1 为例)
curl -o actions-runner-linux-x64-2.316.1.tar.gz -L https://github.com/actions/runner/releases/download/v2.316.1/actions-runner-linux-x64-2.316.1.tar.gz

# 校验包完整性
echo "d62de2400fdde5e620e6142988b2ad76d556b1540134621f2f actions-runner-linux-x64-2.316.1.tar.gz" | shasum -a 256 -c

# 解压文件
tar xzf ./actions-runner-linux-x64-2.316.1.tar.gz
```

### 3. 配置并配置关联 Runner

使用之前在 GitHub Web 界面中获取的 `Token` 和项目 URL 配置关联。

```bash
# 执行配置脚本
./config.sh --url https://github.com/Xuepoo/your-repo --token AXYZ123YOURTEMPTOKENHERE

# 配置期间，系统会询问你：
# - 运行器组名称（默认 Default）
# - 运行器的显示名称（如 node-runner-01）
# - 附加的 Labels 标签（用于流水线中定向调用，如 linux, x64, gpu-enabled）
# - 工作目录（默认 _work）
```

### 4. 配置为 systemd 后台服务

配置成功后，为了防止会话关闭或系统重启导致运行器下线，应当将其安装为系统的守护服务。

```bash
# 使用 sudo 安装并启动服务 (需要管理员权限一次性配置)
sudo ./svc.sh install
sudo ./svc.sh start

# 检查服务运行状态
sudo ./svc.sh status
```

---

## 在 Workflow 中调用自托管运行器

配置完成后，你在项目的 Actions 列表下会看到运行器状态变为 **Idle (空闲)**。你只需修改项目工作流 `.github/workflows/deploy.yml` 中的 `runs-on` 标识符：

```yaml
name: CI & Production Deploy

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    # 关键点：指定使用你的自托管运行器
    runs-on: [ self-hosted, linux, x64 ]

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Build and Release
        run: |
          cargo build --release
          ./scripts/deploy.sh
```

---

## ⚠️ 安全警告：不要在公共仓库使用

> [!CAUTION]
> **切勿在 Public（公开）的 GitHub 仓库中使用自托管运行器。**
>
> 如果你的项目是开源公开的，任何人都可以通过 Fork 你的仓库并提交一个包含恶意代码的 Pull Request 来触发 Actions。一旦该 PR 被自动触发，恶意的 Workflow 脚本将直接在你的自托管服务器上以宿主机权限执行，可能会导致你服务器的密钥泄漏、沦为矿机或遭受勒索攻击。
>
> **防护建议**：
>
> - 仅在 Private（私有）仓库中开启自托管运行器。
> - 在 Repository settings -> Actions 中，确保设置 `Require approval for all outside collaborators`，以防止未授权代码在你的服务器上执行。
