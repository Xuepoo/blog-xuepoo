# Xuepoo's Blog

Personal technical blog built with [Zola](https://www.getzola.org/) and deployed on [Cloudflare Pages](https://pages.cloudflare.com/).

**Live site:** [blog.xuepoo.xyz](https://blog.xuepoo.xyz)

This site is styled with a **Minimalist Zen (极简禅意)** theme, optimized for deep reading, print-like typography, and zero-JS performance.

---

## Development

To run the blog locally with auto-rebuild and live-reload on port `8083`, run:

```bash
zola serve -p 8083
```

Access the site at `http://localhost:8083`.

To build for production manually:

```bash
zola build
```

---

## Writing a New Post

All blog posts are stored under the [content/posts/](file:///mnt/data/Workspace/Projects/xuepoo/xuepoo-blog/content/posts) directory.

### 1. Create a Markdown File

Create a new markdown file named `your-post-title.md` under `content/posts/`.

### 2. Add TOML Frontmatter

At the very top of your markdown file, add TOML metadata wrapped between `+++` lines:

```toml
+++
title = "Your Blog Post Title"
description = "A concise, 1-2 sentence description of the post."
date = 2026-06-18
[taxonomies]
tags = ["Rust", "WebAssembly", "Frontend"]
+++
```

### 3. Write Markdown Content

Below the frontmatter, write your post using standard Markdown syntax. The system automatically styles headers, images, blockquotes, and code blocks:

```markdown
## Section Header

This is a paragraph with **bold** and *italic* text.

### Code Syntax Highlighting

Syntax highlighting is automatically applied:

\```rust
fn main() {
    println!("Hello, Zen Blog!");
}
\```
```

---

## Site Customization

Site metadata and extra links are configured in [zola.toml](file:///mnt/data/Workspace/Projects/xuepoo/xuepoo-blog/zola.toml).

### Standard Configuration

- `title`: The name of your blog.
- `description`: Used for SEO meta tags.
- `default_language`: Defaults to `"zh"`.
- `minify_html`: Compresses compiled output for speed.

### Custom Extra Properties

You can customize theme details under the `[extra]` section:

```toml
[extra]
cdn_base_url = "https://cdn.xuepoo.xyz"
author = "Xuepoo"
anime_title = "薛璞の红白机大厅"
anime_subtitle = "Stage 1-1: Welcome to NES Retro World"
custom_cursor_url = "https://cdn.xuepoo.xyz/shared/retro-wand.png"
```

## Deployment

Automated via GitHub Actions on push to `main`. Deploys to Cloudflare Pages.

## License

All content is © Xuepoo. All rights reserved.
