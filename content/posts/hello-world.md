---
title: "Hello World — 开启静水深流的技术之旅"
description: "本站的第一篇文章。探讨为何构建这套基于 Zola 与 Cloudflare Pages 的多站点个人矩阵系统，以及未来的写作规划。"
date: "2026-05-28"
taxonomies:
  tags:
    - Personal
    - Zola
    - Cloudflare
---

这是在 `blog.xuepoo.xyz` 发布的第一篇文章。

经过一段时间的设计与打磨，我成功构建了由四个独立站点组成的个人网络矩阵：

1. **主门户网站 (`xuepoo.xyz`)** ── 采用极简现代玻璃拟态风设计的导航枢纽。
2. **技术博客 (`blog.xuepoo.xyz`)** ── 也就是你当前所在的阅读空间，主打**排版优先、无 JavaScript 干扰**的深度阅读体验。
3. **开源橱窗 (`projects.xuepoo.xyz`)** ── 极客命令行/复古像素风格的开源作品展示。
4. **万物志趣 (`hobbies.xuepoo.xyz`)** ── 温暖日式手绘风格的书影音日记本。

---

## 为什么选择 Zola 与 Cloudflare Pages？

在决定重隔个人站点时，我给自己设立了三个绝对原则：

* **极致的加载速度**：摒弃任何重型客户端渲染框架（如 React/Next.js/Gatsby）。
* **零服务器维护成本**：全静态发布，利用边缘网络加速。
* **优雅的无障碍（Accessibility）**：即便没有 JavaScript 运行，页面也应当完美呈现。

基于此，**Zola**（基于 Rust 的静态站点生成器）脱颖而出。它拥有极快的编译速度（通常在几毫秒内完成编译）和原生 Sass 支持。

### 核心技术栈配置

```toml
# zola.toml
compile_sass = true
minify_html = true
build_search_index = false
```

---

## 深度阅读排版规范

在设计这个博客的样式表（`style.scss`）时，我刻意模仿了纸质出版物的优美排版法则：

> 「优秀的排版不仅能传达文字，更能提供沉浸的心流体验。」

在样式上，我们坚持：

1. **行宽限制在 65 个半角字符 (65ch)**：这是人类视觉最不易疲劳的扫视宽度。
2. **大行高与温暖底色**：使用 `line-height: 1.75` 搭配暖灰色底色，模仿护眼纸张。
3. **无类名语义化**：完全利用原生 HTML 标签进行排版，最大程度还原 Markdown 渲染本质。

例如，下面是一段快速排序的 Python 实现：

```python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)
```

祝阅读愉快！期待在未来的技术深潜中与你同行。
