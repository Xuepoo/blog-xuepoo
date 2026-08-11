# Xuepoo's Blog

个人技术博客站点，基于 [Zola](https://www.getzola.org/) 构建，托管于 [Cloudflare Pages](https://pages.cloudflare.com/)。

* **线上地址**：[blog.xuepoo.xyz](https://blog.xuepoo.xyz)
* **主题设计**：极简禅意温润米黄（Cream Zen）排版风格，**整站由 VectoJS 渲染**（单个 canvas + Scene），为深度技术阅读设计。

## 0. 技术架构

* **静态生成**：[Zola](https://www.getzola.org/) 把每页数据（文章列表 / 全文 Markdown + TOC + 导航）嵌入 `<script id="page-data">` JSON；构建时由 `scripts/obfuscate.ts` 做 XOR+Base64 混淆，防爬虫直接读源码。
* **前端运行时**：`src/index.ts` 是唯一的 VectoJS 应用（约 1100 行）——单个 `<canvas>` + 一个 Scene，`onDemand` 渲染。SPA 路由（`pushState` + fetch 页面数据 + 整树重建）、原生 body 滚动同步到 canvas、阅读进度条、桌面粘性 TOC / 移动折叠 TOC、`#tag` 搜索、阅读统计（Cloudflare Functions `/api/views`）。
* **按需加载**：`@vectojs/markdown`（约 380KB，含 katex 依赖）通过 `src/article.ts` 的动态 import 懒加载——列表页完全不拉取；全文搜索索引 `search.json` 在搜索框首次聚焦时才请求。
* **字体**：自托管子集化 Noto Sans/Serif SC 可变字体（`static/fonts/`，由 `scripts/subset-fonts.sh` 生成），替代 Google Fonts 的 20+ 个 CJK 分片。
* **无障碍**：正文通过 `getContentProjection()` 投影为逐行 DOM 文本（`src/text-utils.ts` 关闭逐字形 carrier 模式），屏幕阅读器按行阅读；TOC 行投影为可聚焦的 `role: link`。
* **站内查找**：`Ctrl/Cmd+F` 拦截浏览器原生查找，`src/find.ts` 在画布内高亮全部匹配（精确字形坐标）并支持 Enter/Shift+Enter 循环、Esc 关闭。
* **构建**：`bun run build`（bundle + 代码分割）→ `zola build` → `bun run obfuscate` → `wrangler pages deploy`，全部由 `just deploy` 串联。

---

## 1. 日常维护与本地开发

进入博客目录并启动本地开发环境（Zola 热重载预览与本地网页编辑器 API）：

```bash
just edit
```

* 该命令会自动启动本地 Zola 开发服务器（预览端口 `8085`）与轻量级 Node.js API 服务器（端口 `8086`）。
* 访问 `http://localhost:8085` 即可实时预览站点。
* 访问 `http://localhost:8086` 即可打开本地网页端 Blog 编辑器直接编辑、创建文章和上传临时图片。

---

## 2. 编写与发布文章

### 编写文章

1. 可以直接在网页端编辑器（`http://localhost:8086`）中可视化创建、编辑文章和上传图片。
2. 也可以手动在 `content/posts/` 目录下新建 Markdown 文件（如 `content/posts/my-new-post.md`），配置 Frontmatter：

```toml
+++
title = "这是你的文章标题"
description = "简短的 1-2 句文章摘要，用于 SEO 及列表展示。"
date = 2026-06-18
[taxonomies]
tags = ["CI-CD", "Linux", "Rust"]
+++
```

### 部署发布

项目已配置统一的 **Just 本地自动化发布流程**：

1. **检查状态**（可选）：

   ```bash
   just status
   ```

   检查是否有尚未优化的本地图片。

2. **本地测试与部署**：

   ```bash
   just deploy
   ```

   该任务会自动执行：

   * 运行 `pre-commit` 静态质量与排版检查。
   * 自动扫描文章中的本地临时图片，压缩并转换为 WebP，上传至 Cloudflare R2，然后重写文章中的图片链接为 CDN URL。
   * `zola build` 生产环境静态页面编译。
   * `wrangler pages deploy` 直接将 `public/` 静态文件发布到 Cloudflare Pages。

3. **备份源码**：

   部署成功后，使用 `just commit` 和 `just push` 把源码同步到 GitHub：

   ```bash
   just commit "feat(blog): publish my new post"
   just push
   ```

---

## 3. 文章图片与静态资源工作流

为了防止 Git 仓库因图片等大二进制文件而膨胀，同时保障极致的 CDN 加载速度，建议将文章图片存储在 **Cloudflare R2** 桶中，并通过 `https://cdn.xuepoo.xyz` 进行服务。

父级目录的 `scripts/` 中内置了自动化的图片处理流水线，能一键完成 **图片压缩为 WebP** ➔ **上传至 R2 存储桶** ➔ **生成 Markdown 链接**。

### 使用方法

1. 将你需要插入文章的原始图片（`.png`、`.jpg` 等）收集在一个本地临时文件夹中（如 `/tmp/raw/`）。
1. 在项目根目录下，运行同步脚本（需要确保本地配置了 `wrangler` 凭证）：

```bash
# 格式: ../scripts/sync-assets.sh <本地临时目录> <R2 路径前缀> [WebP 压缩质量] [R2 桶名称]
../scripts/sync-assets.sh /tmp/raw blog/posts/github-actions-runner 85 cdn-xuepoo-xyz
```

1. 脚本运行完成后，控制台将输出如下格式的 Markdown 链接，直接复制粘贴到你的 Markdown 页面正文中即可：

```markdown
![my-illustration-1](https://cdn.xuepoo.xyz/blog/posts/github-actions-runner/my-illustration-1.webp)
```

---

## 4. 目录结构

```text
.
├── PRODUCT.md                  # 设计系统上下文与 Impeccable 核心方针
├── content/                    # 博客内容源文件
│   └── posts/                  # 文章 Markdown 目录
├── static/                     # 静态资源 (CSS、图标、字体等)
│   ├── css/page.css            # 极简米黄主题核心样式
│   └── giallo-light.css        # 代码高亮语法配色
├── templates/                  # 站点 Tera 模板
│   ├── base.html               # 骨架页面与前端检索逻辑
│   ├── index.html              # 首页列表页模板
│   └── page.html               # 文章详情页及 TOC 交互
└── zola.toml                   # Zola 全局配置文件
```
