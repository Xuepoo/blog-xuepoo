# Xuepoo's Blog

个人技术博客站点，基于 [Zola](https://www.getzola.org/) 构建，托管于 [Cloudflare Pages](https://pages.cloudflare.com/)。

* **线上地址**：[blog.xuepoo.xyz](https://blog.xuepoo.xyz)
* **主题设计**：极简禅意温润米黄（Cream Zen）排版风格，无 JS 加载（搜索功能除外），为深度技术阅读设计。

---

## 1. 日常维护与本地开发

### 本地调试

进入博客目录并启动本地 Zola 开发服务器（默认支持热重载，运行于端口 `8085`）：

```bash
zola serve -p 8085
```

访问 `http://localhost:8085` 即可实时预览。

### 本地构建

手动生成静态文件（输出至 `public/` 目录）：

```bash
zola build
```

---

## 2. 编写与发布文章

所有博客文章存储在 `content/posts/` 目录下。

### 创建文章

新建一个以 `.md` 结尾的 Markdown 文件（例如 `content/posts/my-new-post.md`），头部必须配置 TOML 格式的 Frontmatter：

```toml
+++
title = "这是你的文章标题"
description = "简短的 1-2 句文章摘要，用于 SEO 及列表展示。"
date = 2026-06-18
[taxonomies]
tags = ["CI-CD", "Linux", "Rust"]
+++
```

正文直接在元数据下方使用标准 Markdown 编写。系统会自动解析生成目录（TOC）、代码高亮与字数统计。

### 直接部署发布

因为移除了 GitHub Actions 自动部署（避免消耗 Private 仓库构建时间额度），现统一采用**本地直接部署**方式。

在文章编写预览完成后，直接在项目根目录下执行部署脚本：

```bash
./deploy.sh
```

该脚本会自动执行：

1. `pre-commit` 静态质量与排版检查。
2. `zola build` 生产环境静态页面编译。
3. `wrangler pages deploy` 直接将 `public/` 静态文件发布到 Cloudflare Pages。

部署成功后，使用常规 git 命令将代码源文件推送备份到 GitHub 即可：

```bash
git add .
git commit -m "feat(blog): publish my new post"
git push
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
