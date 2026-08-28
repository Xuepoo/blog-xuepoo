---
title: VectoJS 文字选择偏移的修复过程
description: 记录 VectoJS 如何解决 Canvas 文字渲染与 DOM selection projection 之间的长期偏移问题，以及从一次浏览器兼容性问题推导出的文字几何架构。
date: 2026-08-28
slug: vectojs-wen-zi-xuan-ze-pian-yi-xiu-fu
tags:
  - VectoJS
  - Canvas
  - Web前端
  - 字体渲染
  - Accessibility
---

## 一个看起来很小、实际上很底层的问题

最近在开发 VectoJS 的时候，我遇到了一个困扰了大约两周的问题：**页面上看到的文字和用户实际选中的文字，位置逐渐对不上了。**

VectoJS 的页面主要由 Canvas 渲染，但为了支持键盘导航、屏幕阅读器和原生文字选择，它还会在 Canvas 上方投影一层透明的 DOM。于是同一段文字实际上有两套表现：

```text
源文本
  ├── VectoJS Layout → Canvas glyphs
  └── ContentProjection → DOM text → browser selection
```

理想情况下，两边应该完全重合：

```text
Canvas glyph position === DOM selection position
```

但最开始的实现只能做到“看起来差不多”。在短文本上问题不明显，到了真实的 Markdown 文档里，偏移就会随着文字长度不断累积。用户拖动选择一段话时，选区可能从文字中间开始，或者覆盖到旁边不应该被选中的内容。

这不是简单地给 DOM 加一个 `left: 1px` 就能解决的问题。

---

## 为什么真实文档会把问题放大

最初的测试往往是这样的：

```text
Text("Hello world")
```

只要渲染结果大致正确，选择和复制看起来也没有问题。但真实的文档通常同时包含：

- 中文、English、Arabic 和 emoji 混排
- 普通文字、bold、italic、link、inline code
- 长段落和自动换行
- `text-align: justify`
- RTL / BiDi 文本
- 不同字体和 font fallback
- 不同 browser、DPR 和页面缩放比例

这时文字就不再是一个简单的 string，而是一组拥有不同样式和几何属性的 runs：

```text
normal → bold → link → monospace → normal
```

每一个 style boundary 都可能触发新的字体上下文和新的测量过程。即使每个字符只有很小的 measurement divergence，经过一整行文字的累计后，也可能出现几个像素的差距。

Markdown 恰好是一个很好的 bug amplifier：它会自然地产生许多 style runs、代码块、链接、标题和混合方向文字，让原本隐藏的几何差异暴露出来。

---

## 第一阶段：不要让 DOM 自己重新排版

最早暴露问题的是 `text-align: justify`。

VectoJS 的 LayoutEngine 会根据行宽主动调整 word gap：

```text
Canvas:

Hello       world       VectoJS
^           ^           ^
x=0         x=100       x=220
```

但如果 ContentProjection 只生成这样的 DOM：

```html
<span>Hello world VectoJS</span>
```

浏览器会按照自己的 natural text layout 计算位置：

```text
DOM:

Hello world VectoJS
^     ^     ^
0    48    95
```

Canvas 和 DOM 使用了不同的排版结果，selection 自然就会偏移。

因此，`ContentProjectionRun` 后来不再只携带文本和样式，也开始携带由 LayoutEngine 计算出的几何信息：

```ts
interface ContentProjectionRun {
  text: string;
  font?: string;
  x?: number;
  width?: number;
}
```

关键转变是：

> DOM projection 不再告诉浏览器“请把这些文字排出来”，而是告诉它“这些文字已经在 LayoutEngine 决定的位置上”。

架构也从下面这样：

```text
LayoutEngine → Canvas
Browser      → DOM layout
```

变成了：

```text
LayoutEngine
    ├── visual x / width → Canvas
    └── visual x / width → DOM carrier
```

这解决了 justify 和显式布局造成的大部分偏移，但还不够。

---

## RTL / BiDi：逻辑顺序和视觉顺序必须分开

RTL 文本让问题变得更加明显。LayoutEngine 可能会经历这样的过程：

```text
logical string
    ↓
BiDi reorder
    ↓
visual order
    ↓
right align
    ↓
Canvas
```

而 DOM 又可能对相同的字符串重新执行一次 browser BiDi：

```text
logical string
    ↓
browser BiDi algorithm
    ↓
DOM layout
```

两个 layout system 没有理由得到完全相同的 geometry。早期 RTL selection 出现过几百像素的偏移，本质上就是把逻辑顺序和视觉顺序混在了一起。

最后采用的原则是：

```text
DOM order    = logical source order
carrier.x    = Canvas visual x
```

也就是说，DOM 仍然保持原始文本的逻辑顺序，这样复制、辅助技术和键盘导航才是正确的；但每个 carrier 的位置必须使用 Canvas 侧已经计算好的视觉坐标，不能让 DOM 再次替我们进行视觉排版。

这是一个很重要的分离：

- **logical order**：服务于文本语义、复制、阅读顺序和 Accessibility
- **visual geometry**：服务于 Canvas 绘制和 selection overlay 的空间位置

---

## 为什么“按字符分割”也没有彻底解决问题

为了让 selection 的粒度更精确，ContentProjection 后来引入了 grapheme-level carriers。对于一个文本 run，不再只创建一个很大的透明 DOM 元素，而是可以为每个 grapheme 创建独立的 carrier：

```text
文字 run
  ├── grapheme carrier 0
  ├── grapheme carrier 1
  ├── grapheme carrier 2
  └── ...
```

这样做解决了两个问题：

1. 选区不会因为一个巨大 span 的边界而覆盖整段文字；
2. 每个可选择单元都可以被放到 Canvas 对应的视觉位置。

但是，carrier 的数量并不是根因。即使每个 grapheme 都有独立的 DOM 元素，如果它的 `x` 和 `width` 来源不一致，偏移依然会存在。

真正的问题出现在文字测量模型上。

---

## 最后的根因：paint 和 selection 使用了不同的 measurement model

排查到最后，问题可以缩小成两种文字测量方式：

```text
Canvas paint:
  isolated grapheme advance

DOM projection / selection:
  shaped text width
```

浏览器在测量整段文字时，会考虑 kerning、ligature 等 shaping 行为。例如某些字符组合在整段文字中会被调整间距：

```text
AV
WA
To
Ta
Yo
```

但如果 Canvas 的 paint path 是逐个 grapheme、逐个 glyph 地绘制，使用的就是 isolated advance。整段 shaped width 和各个 isolated advance 的总和并不一定相等。

于是两边虽然使用了相同的 font 和 fontSize，却可能出现：

```text
shaped text width
    ≠
sum of isolated grapheme advances
```

在短文本中，这个差异可能小到看不见；在包含大量英文、bold 和 link 的技术文档中，误差会不断累计。最终测得最坏情况可以达到数个像素，足以让选区明显偏离实际 glyph。

这也解释了为什么一开始看起来像是 Firefox 的问题。Firefox 更早、更明显地把这个差异暴露了出来，但后续在 Firefox 和 Chromium 上都能复现同一类问题。Firefox 是更敏感的探测器，而不是根因。

---

## 最终方案：一套 authoritative geometry，两个 consumer

最后的解决方案不是继续寻找某个固定的 offset，而是重新定义文字几何的权威来源：

> LayoutEngine 使用的、实际驱动 paint path 的 measurement model，必须成为 Canvas 和 ContentProjection 共同使用的 geometry truth。

最终架构可以概括成：

```text
source text
    ↓
authoritative LayoutEngine geometry
    ├── Canvas paint
    └── DOM selection projection
```

具体规则如下：

```text
显式布局 / justify
    → 使用 LayoutEngine 的 x / width

RTL / BiDi
    → 保留 logical source order
    → 使用 visual geometry
    → 禁止 DOM 再次改变布局方向

isolated-grapheme paint
    → selection carriers 使用 isolated grapheme advances

whole-string shaped paint
    → selection geometry 使用相同的 shaped measurement

generic font
    → 使用与 paint path 相同的 measuring context
```

这套方案的重点不是某一个字段，而是 measurement parity：**绘制和选择必须基于同一个测量模型。**

因此，现在的 API 里也逐渐留下了这些经验：

```ts
interface ContentProjectionLine {
  perGraphemeCarriers?: boolean;
  shapedPaint?: boolean;
}
```

配合 run 级别的：

```ts
interface ContentProjectionRun {
  x?: number;
  width?: number;
}
```

这些字段不是为了增加 API 复杂度，而是把过去靠经验和 workaround 维持的规则，正式编码成框架 contract。

---

## 这次修复真正改变了什么

表面上看，我修复的是一个“文字选择框偏移”的 bug；但最后修改的其实是整个文字渲染系统的边界。

最开始的模型是：

```text
Canvas 有一套文字排版
DOM 又有一套文字排版
两边尽量保持一致
```

这条路注定会不断遇到例外，因为两个独立的排版系统没有理由永远一致。

现在的模型是：

```text
LayoutEngine 产生唯一的 authoritative geometry
        ├── Canvas 使用它进行绘制
        └── DOM 使用它提供 selection / a11y
```

Canvas 和 DOM 不再是两个互相竞争的 renderer。Canvas 负责视觉呈现，DOM projection 负责语义、选择和 Accessibility；它们共享同一份几何事实。

这也是为什么最后的修复不是“Firefox workaround”，而是一个跨浏览器的架构修复。

---

## Dogfooding 为什么很重要

这个问题之所以能被发现，很大程度上是因为 VectoJS 开始真正承载自己的文档网站。

从 Astro 迁移到 Zola + VectoJS 之后，Markdown 文档、SPA routing、代码块、链接、目录、搜索、文字选择和 Accessibility 都进入了同一个真实应用。VectoJS 不再只是渲染几个 demo，而是在运行一个长期使用的文档网站。

这相当于一个大型 integration test：

```text
Markdown
  × rich text
  × CJK / English / RTL
  × font fallback
  × browser differences
  × DPR / zoom
  × resize / scroll
  × cross-run selection
```

单独测试每个因素都通过，并不能推出它们组合起来仍然正确。真实网站会自然地产生这些组合，而用户的拖动、复制和搜索又会进一步验证它们。

所以我现在更愿意把 VectoJS 文档网站看成三个东西的结合：

```text
VectoJS Website
    ├── Documentation
    ├── Showcase
    └── Integration / Dogfood Testbed
```

它不是只用来展示框架，也在反过来帮助框架发现问题。

---

## 一点诚实的边界

这套方案解决的是 VectoJS 自己的 Canvas geometry 和 DOM projection 不一致的问题，但它并不意味着文字渲染从此没有复杂性。

仍然需要认真处理：

- 字体加载完成前后的 geometry 变化
- font fallback 和 generic font
- 不同浏览器的 shaping 行为
- ligature、kerning 和复杂脚本
- DPR、zoom 和 fractional coordinate
- 大量 grapheme carriers 带来的 DOM 成本
- 文本逻辑顺序与视觉顺序之间的 Accessibility 细节

另外，Canvas + transparent DOM text layer 这个总体思路本身并不是新概念。PDF.js、设计工具和各种 document renderer 都遇到过类似的问题。VectoJS 的价值不在于宣称重新发明了这个问题，而在于：在自己的 LayoutEngine、Canvas renderer 和 ContentProjection 之间，建立了一套一致的 geometry contract。

---

## 总结

这次排查让我最后得到的结论很简单：

> 不要让 Canvas 和 DOM 各自猜测文字应该在哪里。让 LayoutEngine 计算一次 authoritative geometry，然后让 Canvas 和 DOM 都消费这份结果。

从最开始的 selection drift，到 justify、RTL、grapheme carrier，再到最终的 kerning / shaping measurement mismatch，整个过程其实是在逐层排除“看起来合理但不可靠”的假设。

最终真正解决问题的不是某个 `+ 0.7px`，而是把：

```text
两个独立的文字排版系统
```

重构成：

```text
一套文字几何，两个不同的 consumer
```

这也是这次修复对 VectoJS 最有价值的地方。
