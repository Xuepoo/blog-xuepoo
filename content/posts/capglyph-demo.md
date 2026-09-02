---
title: "CapGlyph + VectoJS ImageSource / imageResolver Showcase"
description: "演示 VectoJS 1.39 中新增的 ImageSource (url/blob/bitmap) 与 Markdown imageResolver，以及 CapGlyph 在 app 层的适配方式。"
date: "2026-09-02"
slug: "capglyph-demo"
tags:
  - VectoJS
  - CapGlyph
  - Canvas
---

本篇为 `CTX-0013` 的最小 showcase，验证三件事：

1. `Image` 已支持泛型 `ImageSource`（`string` / `{kind:'url'}` / `{kind:'blob'}` / `{kind:'bitmap'}`），且 `semanticMode:'auto'` 会根据 `kind` 自动映射 a11y 投影。
2. `Markdown` 的 `imageResolver: (src) => ImageSource | Promise<ImageSource>` 可在 app 层把 `capglyph:` 虚拟 ID 解析为 `blob`/`bitmap`，`@vectojs/*` 本身不依赖 CapGlyph。
3. 博客现有渲染链路保持向后兼容——未命中 `capglyph:` 的文章走默认 `{kind:'url'}` 路径，不受影响。

源码位置：`src/capglyph-demo.ts:1`，注入点 `src/index.ts:876` 附近，`src/article.ts:71` 透传 `options`。

## 1. `ImageSource` 直观对比

```ts
import { Image } from "@vectojs/ui";

// url - auto 投影为 <img src alt>
const urlImage = new Image("/favicon.svg", {
  width: 120,
  height: 120,
  alt: "Demo URL",
  semanticMode: "auto",
});
console.log(urlImage.getA11yAttributes());
// → { role: 'img', src: '/favicon.svg', alt: 'Demo URL', ... }  // 实际走 <img>

// blob - auto 投影为 <div role="img" aria-label>，不暴露 blob: URL
const blob = await fetch("/favicon.svg").then((r) => r.blob());
const blobImage = new Image(
  { kind: "blob", blob },
  {
    width: 120,
    height: 120,
    alt: "Demo Blob",
    semanticMode: "auto",
  },
);
console.log(blobImage.getA11yAttributes());
// → { role: 'img', label: 'Demo Blob' }  // 无 src，避免将二进制 URL 写入 a11y 树

// 强制 role - 即使 url 也不暴露 <img src>
const roleImage = new Image("/favicon.svg", {
  width: 120,
  height: 120,
  alt: "Demo Role",
  semanticMode: "role",
});
console.log(roleImage.getA11yAttributes());
// → { role: 'img', label: 'Demo Role' }
```

打开本页后在控制台会看到 `src/capglyph-demo.ts:demoDirectImageA11y` 打出的三行对比，可用 `@vectojs/devtools` 复核 a11y 树。

## 2. Markdown `imageResolver` 适配 `capglyph:`

```ts
import type { MarkdownImageResolver } from "@vectojs/markdown";
import { fetchCapGlyphBlob } from "./capglyph-demo";

const imageResolver: MarkdownImageResolver = async (src) => {
  if (src.startsWith("capglyph:")) {
    const blob = await fetchCapGlyphBlob(src);
    // 实现已在 src/capglyph-demo.ts:createCapGlyphImageResolver 内：
    // 优先 createImageBitmap → {kind:'bitmap'}, 回落 → {kind:'blob'}
    if (typeof createImageBitmap === "function") {
      try {
        return { kind: "bitmap", bitmap: await createImageBitmap(blob) };
      } catch {}
    }
    return { kind: "blob", blob };
  }
  return { kind: "url", url: src };
};

const md = new Markdown(raw, { maxWidth: 640, imageResolver });
```

`fetchCapGlyphBlob` 当前为 fake：`fetch('/favicon.svg').then(r=>r.blob())`。接入真实 CapGlyph 时替换为：

```ts
import { LocalClient } from "@capglyph/sdk-js";
const client = new LocalClient({ endpoint: "..." });
const { blob } = await client.verify(src.slice("capglyph:".length));
```

VectoJS 侧不感知 `capglyph:`，全部在 app 层闭环。

## 3. 实际渲染

下方两张图共用同一视觉素材，但走不同 Resolver 路径：

- URL 直连（默认路径）：

![url demo](/favicon.svg)

- CapGlyph 虚拟 ID（经 `imageResolver` → `blob`/`bitmap`）：

![capglyph demo](capglyph:cg_demo)

若第二张图正常显示且控制台无 `[Markdown] imageResolver` 报错，则证明：

- `createArticleMarkdown(raw, { imageResolver })` 的透传生效
- `capglyph:` 分支的异步 `blob`→`bitmap` 解码与重排（reflow）正常
- 非 `capglyph:` 图片仍走 `{kind:'url'}` 旧路径（本页第一张图）

## 4. 验证

```bash
bun run check   # oxfmt + oxlint + markdownlint
bun run build   # static/js 分包产出
```

在 worktree `.worktrees/ctx-0013` 内执行即可。博客现有文章不受影响——`src/index.ts` 仅在 `rawMarkdown.includes('capglyph:')` 时注入 resolver。
