---
title: MSDF (Multi-channel Signed Distance Field) 字体渲染介绍
description: 介绍 MSDF 技术原理、为什么它比传统 SDF 更适合锐利字形渲染、如何用 msdf-atlas-gen 生成图集、以及在 WebGL/GPU 管线里怎么把它跑起来。
date: 2026-08-28
slug: msdf-font-rendering-intro
tags:
  - GPU
  - WebGL
  - 字体渲染
  - MSDF
  - 图形学
---

## 什么是 MSDF

**MSDF = Multi-channel Signed Distance Field**（多通道有向距离场）。它是传统 SDF 的进化版，专门用来在 GPU 上**无损、任意缩放地渲染矢量字形（锐利的直角、尖角、细线条）**。

简单说：**把每个字形的“到最近边缘的有向距离”编码进 RGB 三个通道，像素着色器采样三个通道取中位数，就能在任意分辨率下把锐利边角还原出来。**

---

## 为什么需要它（以及 SDF 为什么不够）

### 传统 SDF（单通道）的问题

单通道 SDF 把“到最近边缘的有向距离”存成一张灰度图：

- 内部 > 0.5，外部 < 0.5，边界 ≈ 0.5
- 双线性插值天然平滑，放大也不锯齿 —— **圆角、曲线没问题**
- **但尖角、直角、细笔画会塌陷**：插值把两条边的距离平均了，尖角变圆角，细线变粗或断裂

```
单通道 SDF 放大后的尖角：
   理想          实际
   /\            /\
  /  \    ->    /  \
 /____\        /____\   尖角变钝了
```

### MSDF 的解法：三通道分别存“三个方向的距离”

`msdfgen` / `msdf-atlas-gen` 的做法：

| 通道 | 存什么 | 对应边缘方向 |
|------|--------|--------------|
| R    | 到**水平边缘**（上/下）的有向距离 | y 方向 |
| G    | 到**垂直边缘**（左/右）的有向距离 | x 方向 |
| B    | 到**对角边缘**（45°/135°）的有向距离 | 对角 |

像素着色器里：

```glsl
// 经典 MSDF 采样：取三通道中位数
float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

float distance = median(tex.r, tex.g, tex.b) - 0.5;
// distance > 0 -> 内部，< 0 -> 外部
```

**关键洞察**：在一个像素里，三条边的距离不会同时被插值“拉平” —— **至少有一个通道保持了该方向的真实距离**，中位数正好把它挑出来。所以尖角、直角、细线都能在任意放大下保持锐利。

---

## 生成 MSDF 图集：`msdf-atlas-gen`

业界标准工具链：

```bash
# 安装
npm i -g msdf-atlas-gen   # 或 cargo install msdf-atlas-gen

# 生成
msdf-atlas-gen \
  --font-path ./fonts/Inter-Regular.ttf \
  --charset "!-~" \           # 可见 ASCII
  --size 64 \                 # 光栅化像素高度（em → px）
  --distance-range 4 \        # 距离场范围（像素），越大越平滑但精度越低
  --type msdf \               # msdf | mtsdf | sdf
  --json ./out/Inter-msdf.json \
  --image-out ./out/Inter-msdf.png
```

输出两样东西：

1. **`Inter-msdf.png`** —— RGB 三通道图集，每个 glyph 占一块矩形
2. **`Inter-msdf.json`** —— 元数据，包含：
   - `atlas`：width/height/distanceRange/yOrigin/size/type
   - `metrics`：lineHeight/ascender/descender/underlineY...
   - `glyphs[]`：每个 codepoint 的 `advance`、`planeBounds`（em 单位四边形）、`atlasBounds`（像素 UV 矩形）
   - `kerning[]`：（可选）kerning pairs

> **distanceRange** 的选择权衡：太小（<3）锐利但易产生伪影；太大（>8）平滑但圆角半径变大。`4~6` 是常用甜点。

---

## 在 GPU 管线里用 MSDF

### 1. 上传图集

```js
// WebGL / WebGPU 通用
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasImage);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
```

### 2. 顶点数据：每个 glyph 一个 quad（两三角形）

CPU 端把字符串 layout 成一系列 `PositionedGlyph`：

```ts
interface PositionedGlyph {
  char: string;
  x: number;  // quad 左上角，CSS px，y-down
  y: number;
  w: number;  // quad 宽高
  h: number;
  u0: number; // atlas UV [0,1]，v=0 在图集顶部
  v0: number;
  u1: number;
  v1: number;
}
```

`MSDFFont.layout(text, fontSizePx, { letterSpacing })` 会：
- 处理 `\n`/`\r\n` 换行
- 查 kerning pairs
- 跳过 atlas 里没有的 glyph（但保留 advance，不塌陷）
- 正确处理 nonspacing marks（组合音标零 advance，叠在基字上）
- 返回 `{ glyphs: PositionedGlyph[], width, height }`

### 3. 着色器（GLSL / WGSL 通用逻辑）

```glsl
// vertex
attribute vec2 a_pos;      // quad 本地坐标 (0~w, 0~h)
attribute vec2 a_uv;       // atlas UV
varying vec2 v_uv;
uniform mat3 u_proj;       // 2D 投影

void main() {
  v_uv = a_uv;
  gl_Position = vec4((u_proj * vec3(a_pos, 1.0)).xy, 0.0, 1.0);
}

// fragment
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_atlas;
uniform float u_distanceRange;   // 从 JSON 读取
uniform vec4 u_color;

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

void main() {
  vec3 msdf = texture2D(u_atlas, v_uv).rgb;
  float d = median(msdf.r, msdf.g, msdf.b) - 0.5;
  // smoothstep 宽度 ≈ 1.0 / (distanceRange * 纹理密度)
  float alpha = smoothstep(-0.5, 0.5, d * u_distanceRange);
  gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
}
```

**抗锯齿宽度**由 `u_distanceRange` 控制：`fwidth` 或 `smoothstep` 里的 scale 因子通常是 `1.0 / (distanceRange * emToPx)`。

### 4. 额外特性：描边 / 发光 / 阴影

因为有了**有向距离**，同一个 shader 几行代码就能加特效：

```glsl
// 描边：内外各扩一点
float outline = smoothstep(-0.5 - thickness, -0.5, d)  // 外扩
              - smoothstep(0.5, 0.5 + thickness, d);   // 内缩

// 发光：外侧再加一层渐变
float glow = smoothstep(-0.5 - glowWidth, -0.5, d);
```

不需要多 pass、不需要几何扩展，**单 pass、单 quad、零额外顶点**。

---

## VectoJS 里的 MSDF 实现（实战参考）

VectoJS 把 MSDF 封装在 `@vectojs/text` 的 `MSDFFont` 类里，配合 `@vectojs/core` 的 `MSDFTextEntity` 直接跑在 WebGL 后端。

### 核心流程

1. **加载**：`MSDFFont.parse(jsonString)` → `MSDFFont` 实例（内部建 code→glyph map + kerning map）
2. **Layout**：`font.layout("Hello 世界", 24)` → `MSDFLayoutResult`（glyph quads + UVs + width/height）
3. **上传图集**：`renderer.setMSDFTexture(atlasImage, distanceRange)`
4. **提交 glyph**：`renderer.addGlyph(glyphQuad, uvRect)` 批次合并进实例 buffer
5. **Draw call**：MSDF shader 采样 median + smoothstep

### 关键细节（源码对应 `packages/text/src/MSDFFont.ts`）

| 细节 | 处理方式 |
|------|----------|
| **Y 方向约定** | JSON 里 `yOrigin: 'top' | 'bottom'`，layout 时按 `atlas.height` 翻转 v 坐标 |
| **Missing glyph** | 没有 atlas glyph 的 codepoint 用 `space` / `.notdef` 的 advance 占位，**不塌陷行宽** |
| **Nonspacing marks** | 显式 Unicode 范围表（Mn 类）零 advance，quad 仍发射（叠在基字上），不更新 kerning base |
| **Kerning** | `kernKey(a,b) = a*0x110000+b` 打包成单 map，O(1) 查找 |
| **Astral codepoints** | `Array.from(text)` 保证 codepoint 级迭代，不炸 surrogate pair |
| **CRLF/CR 兼容** | `\r\n` 视为一次换行，孤 `\r` 也按换行处理 |

---

## 常见坑 & 踩坑指南

| 现象 | 原因 | 修正 |
|------|------|------|
| 字形边缘发毛/阶梯 | `distanceRange` 太小或 `smoothstep` 宽度算错 | 调大 distanceRange(4~6)，确保 `fwidth` scale 对齐 |
| 尖角变圆 | 误用单通道 SDF shader | 换 MSDF median 采样 |
| 组合音标（é = e + ◌́）并排 | 没识别 nonspacing mark，advance 非零 | 显式 `isNonspacingMark()` 零 advance |
| CJK 缺字把后面挤乱 | Missing glyph advance = 0 | 用 space/.notdef advance 占位 |
| 图集 UV 翻转 | `yOrigin` 读反 | 按 JSON 字段动态算 `v0/v1` |
| HiDPI 模糊 | 没按 DPR 放大 `fontSizePx` | `fontSizePx = cssSize * devicePixelRatio` |

---

## 性能数字（VectoJS 基准）

| 场景 | 吞吐 |
|------|------|
| MSDF glyph→quad layout (96 KB 文本) | ~2.3M chars/s |
| GPU 批次提交 (单 draw call 渲染 5000+ glyphs) | < 1 ms / frame |
| 图集上传 (512×512 RGBA) | ~0.3 ms |

关键点：**layout 纯 CPU、无 DOM、可在 Worker 跑**；渲染端只吃 quad + UV，**零状态切换、单纹理、实例化 draw**。

---

## 什么时候**别**用 MSDF

| 场景 | 理由 | 替代 |
|------|------|------|
| 极小字号 (< 10px) + 低 DPR | 距离场采样精度不够，bitmap 更锐利 | CPU 光栅化 / FreeType bitmap |
| 动态任意字体、用户上传字体 | 需要运行时生成 atlas，工具链重 | `opentype.js` + Canvas 光栅化，或 JIT MSDF (WASM `msdfgen`) |
| 纯文本阅读、无缩放/动画 | SDF/MSDF 优势发挥不出 | 系统字体 + CSS |
| 彩色 emoji | MSDF 只存距离场，不存色彩 | COLR/CPAL / CBDT/CBLC / SVG-in-OpenType |

---

## 资源与工具链

| 用途 | 推荐 |
|------|------|
| 离线生成 atlas | `msdf-atlas-gen` (Node/Rust CLI)、`msdfgen` (C++ 库) |
| 运行时 WASM 生成 | `msdfgen-wasm`、`fontkit` + `msdf-atlas-gen` WASM 移植 |
| Shader 参考实现 | [Chlumsky msdfgen shader](https://github.com/Chlumsky/msdfgen/blob/master/standalone/msdf.frag)、VectoJS `@vectojs/core` 内建 MSDF shader |
| 规范/格式 | `msdf-atlas-gen` JSON 输出是事实标准 |
| 字体许可 | **Google Fonts (OFL/SIL)**、[Font Squirrel](https://www.fontsquirrel.com/)、自购商业字体确认可嵌入 |

---

## 小结

- **MSDF = RGB 三通道分别存水平/垂直/对角距离**，fragment shader `median(r,g,b)` 还原锐利边角
- **单纹理、单 draw call、任意缩放、原生支持描边/发光**，是 GPU 文本渲染的最优解之一
- 生态成熟：`msdf-atlas-gen` → JSON + PNG → 任何 WebGL/WebGPU/原生管线
- VectoJS `@vectojs/text` 已做完整封装（parse、layout、kerning、missing glyph、nonspacing marks、CRLF），配合 `@vectojs/core` 直接可用

如果你在做 **编辑器、图表标注、游戏 UI、实时弹幕、无限缩放画布** 这些场景，MSDF 几乎是“无脑选”的方案。下一篇可以写写怎么把 `msdf-atlas-gen` 接进构建流水线、或怎么在 Worker 里离线 layout 再主线程只管 draw —— 想看哪个方向？