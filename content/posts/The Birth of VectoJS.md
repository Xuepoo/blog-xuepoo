---
title: The Birth of VectoJS
description: An introduction to how I conceived and built VectoJS.
date: 2026-07-07
slug: the-birth-of-vectojs
tags:
  - Frontend
  - Web-Development
  - GitHub
---

[Read Chinese Version (中文版)](/posts/vectojs-de-dan-sheng-yuan-you/)

## Background

Let me start with a quick introduction: I am an independent developer. You can call me Xuepoo (pronounced as "Swepoo," a name I chose back in middle school). I am currently a junior in college, and I will be entering my senior year after this summer. I started my programming journey in my freshman year with Java Web backend development. I won't go into detail about all the experiences I've had over these past three years, but they span a wide range of fields, including Web backend development, computer networks, cloud computing, Linux, and big data technologies. I am deeply interested in many domains of computer science.

In the first half of this year, I created several open-source tools. One of them is [vectomancy](https://github.com/Xuepoo/vectomancy), a program that converts images into mathematical equations. For more details, you can check out the repository's README, the [vectomancy online website](https://vectomancy.xuepoo.xyz/), or the [vectomancy documentation](https://blog.xuepoo.xyz/posts/vectomancy-jie-shao/).

This was my first fully-featured, production-ready open-source program. It has a complete set of features, and is packaged for crates.io, AUR, Homebrew, Scoop, and Docker Hub. Initially, it was just a CLI program, but I compiled it to WebAssembly (WASM) so that it could be used directly online in the browser. Back then, it didn't have as many features as it does now.

Later, I wondered if I could expand the image-conversion capabilities of vectomancy. Consequently, I introduced two new features: text conversion and video conversion. The text conversion feature takes input text and a specific font file and outputs them as corresponding mathematical equations, which can be useful for posters, advertisements, subtitles, etc. This was the value I initially envisioned. The video conversion feature doesn't have as many practical use cases and is more of a toy feature.

As an independent developer, I am very interested in the open-source community. Drawing inspiration from various websites built by independent developers on Neocities, I felt I should have my own personal website. Since I am not one to follow trends blindly, I decided my personal website had to be unique and highly recognizable.

## The Prototype of VectoJS

Because vectomancy was my first highly polished open-source program, I spent a lot of time on it—adding text and video conversion, rendering optimization, GPU acceleration, and more. Naturally, when developing my personal website, I wanted to incorporate it.

Since I have many hobbies, such as manga, mystery novels, mathematics, anime, and music, I wanted to showcase them on my website. I used vectomancy to convert various anime characters, texts, and other content into JSON formats containing mathematical curves. Using math equations to replace standard images and text as a design element became a defining characteristic. I rendered these as pseudo-images and added interactive features like dragging and clicking to navigate. However, the most important part to me was that the website's `<body>` contains only a single `<canvas>` element. The entire page is essentially one canvas; you can right-click anywhere and save it as an image at any time.

This led to the concept of "Zero DOM" or "DOM-less." Since the website lacks a DOM tree, it significantly reduces resource consumption like RAM and CPU. At the time, though, I didn't think too deeply about it.

This website is currently deployed on Neocities. You can visit it at [Xuepoo's Website](https://xuepoo.neocities.org/).

## Setting Up VectoJS

After setting up the website, I spent about a month busy with other open-source projects. I have quite a few active projects, some of which are very challenging. One of them involved processing huge datasets and required constant testing and tuning. Working on that project became exhausting, so I wanted to switch to something else and maintain my other projects.

My focus returned to vectomancy, and combining it with the concepts from my personal website, I wondered: could this be turned into a UI framework? Specifically, a framework that uses vectomancy as its core to render mathematical curve equations directly onto the page, bypassing DOM nodes entirely, and rendering everything onto a Canvas.

Initially, my idea was simple: just draw mathematical formulas on the screen. However, I noticed that my website didn't scale well across different viewports. It looked correct on desktops, but the layout broke on mobile browsers.

At that time, I noticed a rising star in the web frontend community from late March: [Pretext](https://github.com/chenglou/pretext). This library solves many text reflow and wrapping issues on the web (I won't go into details here, as many of you might already know it). This made me think: if text can reflow properly in the DOM, why can't it do the same on a Canvas, and automatically? At this moment, the project was born. Originally, it wasn't named VectoJS; it was called VectoUI, because its positioning was still vague. I saw it as just a UI component library. Over time, its identity evolved: from a component library -> a layout engine -> a Canvas runtime.

During this process, I learned an immense amount of knowledge, including browser rendering pipelines, font file architectures, DOM internals, browser engine layout calculations, WebGL/WebGPU, and Web Workers. Frankly, this was my first time seriously doing frontend development. Before this, I only knew basic HTML/CSS, React/Vue frameworks, and various build tools. Doing something so low-level in the frontend space felt like a fascinating contrast to my background.

On a side note, because of my interest in mathematics, I often approach projects from a mathematical perspective. For instance, when designing vectomancy, I wanted it to be mathematically driven rather than data-driven. While it is entirely possible to trace images using supervised machine learning, a data-driven approach would make such a tool less elegant. Vectomancy computes extremely fast, whereas a data-driven model would require massive training datasets and consume significant computational resources. I firmly believe that with mathematical theory as a cornerstone, a program is unlikely to be poorly designed. This became the foundation of VectoJS as well.

## The Development of VectoJS

This is by far the largest and most challenging project I have ever undertaken. It involves heavy mathematical calculations and low-level engine architecture. Fortunately, it was written in TypeScript, unlike many of my previous projects which were written in Rust.

Initially, I planned to bundle vectomancy directly into VectoJS. However, I realized we didn't need to convert images dynamically; we just needed to render everything directly onto the Canvas. Ultimately, I adopted an Entity Component System (ECS) architecture, shifting traditional document-flow web development into something akin to game development. Here is an analogy:

- **Traditional Frontend Web Development**: A webpage is like a room in a house. When you want something, you just add it—a sofa, a TV, a table. These are DOM nodes. But as you add more furniture, the room becomes crowded. When space runs tight, adding new furniture triggers reflow and layout thrashing. This is the most expensive part of web rendering, as all existing furniture must be moved to accommodate the new piece.
- **Development with VectoJS**: A webpage is like a chessboard, and development is simply placing chess pieces on it. The board is a single Canvas, and we can position or move pieces freely with minimal overhead.

However, a Canvas alone is not enough because it lacks native interaction. Without interaction, the project would be dead on arrival. In web frontend, there is a standard called a11y (Accessibility). This is VectoJS's moat. You can think of it as a transparent DOM layer, primarily used for keyboard navigation, focus management, and screen readers. In VectoJS, every component has its own coordinate system. For interactive components, we project a semantic shadow DOM node into the a11y layer. This provides accessibility comparable to native DOM elements, and it is agent-friendly, meaning you can test it using standard automation tools like Playwright or Selenium.

Borrowing from Pretext's concept of separating static and dynamic content, VectoJS implements its own optimization. Because components behave like sprites in game development (a concept inspired by PixiJS), every component manages its own local transform matrices and coordinates, much like a game engine.

Furthermore, we built a native UI library. Many HTML elements have direct templates in `@vectojs/ui`. You can customize them using object-oriented programming. It supports Markdown rendering and streaming data (e.g., LLM stream outputs, real-time dashboards). We also did a lot of work on animations; in addition to standard Bezier transitions, we heavily feature spring physics. From this point, almost all features of the native DOM can be replicated.

I'll stop here on the development details. For extensive testing records, use cases, and compatibility features, feel free to visit the [Official VectoJS Website](https://vectojs.org), where everything is documented in detail.

## Summary of the Journey

I do not come from a traditional frontend background, and I am still quite young—just 20 years old three months ago. Being able to build such a massive project feels incredibly rewarding.

Why was I able to build this? I attribute it to a few points:

1. **Solid Mathematical Foundation**: My math has been strong since middle school. I often solve calculus problems in my spare time just for fun. This mathematical curiosity motivated me to create vectomancy and eventually build VectoJS.
2. **Diverse Development Experience**: Over the past three years of college, I have built many things. While people mostly see my open-source work, I have also worked on various academic and commercial projects with my professors. Since my junior year, I started focusing on independent open-source projects driven by personal interest to solve niche problems, publishing libraries on crates.io and PyPI, and maintaining several packages on the Arch User Repository (AUR).
3. **Broad Computer Science Knowledge**: I have a wide range of interests. I started with Java backends, but moved away from it later. I love Linux (my primary OS is CachyOS/Arch), cloud infrastructure (deploying sites on Cloudflare, and running services on AWS/GCP), and big data frameworks like Spark and Flink. I have worked with languages like Java, Python, Rust, Go, JS/TS, and Lua.
4. **Accumulation Through Creation**: Because I explore many areas, I continuously accumulate tools, workflows, and development skills. I don't just search for things when I need them; I reuse proven workflows. For example, since vectomancy was developed in Rust, I established clean toolchains that I can immediately reuse in other Rust programs. When compiling WASM on my CachyOS machine, my OS applies aggressive compiler optimizations by default, requiring me to disable them in `.cargo/config.toml` to prevent issues. Once solved, I carry these configuration templates into all my future projects.
5. **Drive to Innovate**: I have so many ideas I want to build, but never enough time. Innovation doesn't happen in a vacuum; it is the product of accumulated knowledge. It's quite ironic that although I am not a frontend developer, my largest project is a frontend layout engine and runtime 😄.

I will continue to maintain and evolve VectoJS. All my personal websites are now dogfooding VectoJS Native, and I am currently building several new projects designed to leverage VectoJS.
