import { Scene, Entity } from "@vectojs/core";
import { ScrollView, Text, RichText, Input, Card, Markdown } from "@vectojs/ui";

const key = 42;

// Decrypt function matching obfuscate.ts using byte-level TextDecoder
function decrypt(obfuscated: string): string {
  if (obfuscated.startsWith("e:")) {
    const rawData = obfuscated.slice(2);
    const binary = atob(rawData);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i) ^ key;
    }
    return new TextDecoder().decode(bytes);
  }
  return obfuscated;
}

function parsePageData(raw: string) {
  try {
    return JSON.parse(decrypt(raw.trim()));
  } catch (e) {
    console.error("Failed to parse page data", e);
    return null;
  }
}

// Global state
let currentScene: Scene | null = null;
let currentPageData: any = null;
let searchDatabase: any[] = [];
let searchDropdown: any = null;
let currentSearchMatches: any[] = [];
let viewsMap = new Map<string, number>();
const imageCache = new Map<string, { img: HTMLImageElement; aspectRatio: number }>();
// Wheel handler attached to the canvas for scroll (Scene does not forward wheel events)
let _canvasWheelHandler: ((e: WheelEvent) => void) | null = null;
let currentMainScroll: Container | null = null;

import { marked, type Token } from "marked";
import katex from "katex";

class MathBlock extends Entity {
  private img: HTMLImageElement | null = null;
  private loaded = false;

  constructor(htmlContent: string, width: number) {
    super();
    this.width = width;
    this.height = 60;

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.visibility = "hidden";
    container.style.color = "#332f29";
    container.style.fontFamily = "Noto Serif SC, serif";
    container.style.width = `${width}px`;
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    const w = container.offsetWidth || width;
    const h = container.offsetHeight || 40;
    this.height = h + 20;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="color: #332f29; font-family: 'Noto Serif SC', serif; line-height: 1.85;">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" />
            ${htmlContent}
          </div>
        </foreignObject>
      </svg>
    `;

    document.body.removeChild(container);

    const img = new Image();
    img.onload = () => {
      this.img = img;
      this.loaded = true;
      this.width = w;
      this.height = h + 20;
      currentScene?.markDirty();
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.trim());
  }

  public render(r: any): void {
    if (this.loaded && this.img) {
      r.drawImage(this.img, Math.max(0, (this.width - this.img.width) / 2), 10);
    }
  }
}

class BlogImage extends Entity {
  private img: HTMLImageElement | null = null;
  private loaded = false;
  private src: string;
  private alt: string;
  private maxWidth: number;

  constructor(src: string, alt: string, maxWidth: number) {
    super();
    this.src = src;
    this.alt = alt;
    this.maxWidth = maxWidth;
    this.width = maxWidth;

    const cached = imageCache.get(src);
    if (cached) {
      this.loaded = true;
      this.img = cached.img;
      this.height = Math.round(this.maxWidth * cached.aspectRatio);
    } else {
      this.height = 300;
      if (typeof window !== "undefined") {
        const img = new window.Image();
        img.onload = () => {
          this.loaded = true;
          this.img = img;
          const w = img.naturalWidth || 1;
          const h = img.naturalHeight || 1;
          const aspectRatio = h / w;
          this.height = Math.round(this.maxWidth * aspectRatio);
          imageCache.set(src, { img, aspectRatio });
          requestLayout(this);
          currentScene?.markDirty();
        };
        img.onerror = () => {
          this.loaded = false;
          const aspectRatio = 150 / this.maxWidth;
          this.height = 150;
          imageCache.set(src, { img, aspectRatio });
          requestLayout(this);
          currentScene?.markDirty();
        };
        img.src = src;
      }
    }
  }

  public render(r: any): void {
    if (this.loaded && this.img) {
      r.drawImage(this.img, 0, 0, this.width, this.height);
    } else {
      r.save();
      r.beginPath();
      r.roundRect(0, 0, this.width, this.height, 6);
      r.fill("#ede4d3");
      r.restore();
    }
  }
}

function requestLayout(entity: any) {
  let curr = entity;
  while (curr) {
    if (curr.content && typeof curr.content.layout === 'function') {
      curr.content.layout();
      curr.width = curr.content.width;
      curr.height = curr.content.height;
    } else if (typeof curr.layout === 'function') {
      curr.layout();
    }
    if (typeof curr.onHeightChanged === 'function') {
      curr.onHeightChanged();
    }
    curr = curr.parent;
  }
}

const mathExtension = {
  name: 'math',
  level: 'block',
  start(src: string) { return src.match(/\$\$/)?.index; },
  tokenizer(src: string, tokens: any) {
    const match = /^\$\$([\s\S]+?)\$\$/.exec(src);
    if (match) {
      return {
        type: 'math',
        raw: match[0],
        text: match[1].trim(),
      };
    }
  },
  renderer(token: any) { return token.text; }
};
marked.use({ extensions: [mathExtension] });

class CustomMarkdown extends Markdown {
  protected renderToken(token: Token): Entity | null {
    if (token.type === 'math') {
      try {
        const htmlContent = katex.renderToString((token as any).text, { displayMode: true, throwOnError: false });
        return new MathBlock(htmlContent, this.maxWidth);
      } catch (e) {
        console.error(e);
      }
    }

    if (token.type === 'paragraph') {
      const pToken = token as any;
      if (pToken.tokens && pToken.tokens.length === 1 && pToken.tokens[0].type === 'image') {
        const imgToken = pToken.tokens[0];
        return new BlogImage(imgToken.href, imgToken.text, this.maxWidth);
      }
    }

    return super.renderToken(token);
  }
}

class DividerLine extends Entity {
  private color: string;
  constructor(width: number, color: string = "#e8dfd0") {
    super();
    this.width = width;
    this.height = 1;
    this.color = color;
  }
  public render(r: any): void {
    r.beginPath();
    r.moveTo(0, 0);
    r.lineTo(this.width, 0);
    r.stroke(this.color, 1);
  }
}

class Container extends Entity {
  public render(_r: any): void {}
}

// ─── BlogScrollView: wraps new ScrollView and wakes onDemand scene ───────────

// ─── Post Card with Hover Highlight (no y-shift to avoid layout overlap) ──────

class AnimatedPostItem extends Entity {
  private hovered = false;

  constructor(width: number) {
    super();
    this.width = width;
    this.interactive = true;
    this.height = 0;

    // Only change the background on hover — no y movement which would cause
    // visual overlap with adjacent layout items.
    this.on("pointerenter", () => {
      this.hovered = true;
      currentScene?.markDirty();
    });
    this.on("pointerleave", () => {
      this.hovered = false;
      currentScene?.markDirty();
    });
  }

  public render(r: any): void {
    if (this.hovered) {
      r.save();
      r.beginPath();
      r.roundRect(-12, -8, this.width + 24, this.height + 16, 8);
      r.fill("rgba(140, 118, 92, 0.07)");
      r.restore();
    }
  }
}

// ─── Reading Progress Bar (Easing.easeOutCubic) ───────────────────────────────

class ReadingProgressBar extends Entity {
  private scrollRef: Container;
  private displayProgress = 0;

  constructor(scrollRef: Container, width: number) {
    super();
    this.scrollRef = scrollRef;
    this.width = width;
    this.height = 3;
  }

  public update(dt: number, time: number): void {
    super.update(dt, time);
    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    const maxScroll = Math.max(1, this.scrollRef.height - window.innerHeight);
    const target = Math.min(1, Math.max(0, scrollY / maxScroll));

    // Smooth eased interpolation toward actual scroll position
    const diff = target - this.displayProgress;
    if (Math.abs(diff) > 0.001) {
      this.displayProgress += diff * (1 - Math.exp(-18 * (dt / 1000)));
      this.scene?.markDirty();
    } else {
      this.displayProgress = target;
    }
  }

  public render(r: any): void {
    if (this.displayProgress <= 0) return;
    r.save();
    r.beginPath();
    r.roundRect(0, 0, this.width, this.height, 0);
    r.fill("rgba(140, 118, 92, 0.12)");

    r.beginPath();
    r.roundRect(0, 0, this.width * this.displayProgress, this.height, 0);
    r.fill("#8c765c");
    r.restore();
  }
}

// ─── Page Container with Fade-in Transition (opacity only, no y-shift) ────────

class PageContainer extends Entity {
  constructor() {
    super();
    // Use opacity-only fade: changing y would disturb the layout for children.
    this.opacity = 0;
    this.setTransition({
      opacity: { duration: 340, easing: "easeOutCubic" },
    });
    // Fire after the current sync task so the entity is attached to the tree
    Promise.resolve().then(() => {
      this.opacity = 1;
      this.scene?.markDirty();
    });
  }

  public render(_r: any): void {}
}

// ─── Router & Navigation ─────────────────────────────────────────────────────

async function navigateTo(url: string) {
  window.history.pushState({}, "", url);
  await handleUrlRoute(url);
}

async function handleUrlRoute(url: string) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const dataElement = doc.getElementById("page-data");
    if (dataElement) {
      const raw = dataElement.textContent || "";
      currentPageData = parsePageData(raw);
      if (currentPageData && currentScene) {
        renderApp();
      }
    }
  } catch (e) {
    console.error("SPA Navigation failed, reloading page...", e);
    window.location.href = url;
  }
}

async function initSearchDatabase() {
  try {
    const response = await fetch("/search.json/");
    if (response.ok) {
      const rawText = await response.text();
      if (rawText.trim().startsWith("<")) {
        console.warn("Search database not found (returned HTML).");
        return;
      }
      try {
        searchDatabase = JSON.parse(decrypt(rawText));
        if (typeof window !== "undefined") {
          (window as any).searchDatabase = searchDatabase;
        }
      } catch (parseError) {
        console.warn("Failed to parse search database JSON:", parseError);
      }
    }
  } catch (e) {
    console.warn("Failed to fetch search database", e);
  }
}

// ─── Main Render ──────────────────────────────────────────────────────────────

function renderApp() {
  if (!currentScene || !currentPageData) return;

  // Clear existing entities
  const root = (currentScene as any).root;
  if (root && root.children) {
    const kids = [...root.children];
    for (const kid of kids) {
      currentScene.remove(kid);
    }
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const contentWidth = Math.min(920, width - 40);
  const originX = (width - contentWidth) / 2;

  const mainScroll = new Container();
  currentMainScroll = mainScroll;

  // Use a fast tween instead of a spring to prevent elastic bouncing / overshoot,
  // while still smoothing out rigid mouse wheel steps.
  mainScroll.setTransition({ y: { type: "tween", duration: 120, easing: "easeOutCubic" } });

  // Keep the VectoJS render loop alive while the scrolling spring settles
  const _origUpdate = mainScroll.update.bind(mainScroll);
  mainScroll.update = function(dt: number, time: number) {
    _origUpdate(dt, time);
    if (this.hasPendingAnimations()) {
      currentScene?.markDirty();
    }
  };

  currentScene.add(mainScroll);

  if (!_canvasWheelHandler) {
    _canvasWheelHandler = (e: Event) => {}; // No-op, just to satisfy the type

    // Enable native scrolling on body
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "auto";

    window.addEventListener("scroll", () => {
      if (currentMainScroll) {
        currentMainScroll.y = -window.scrollY;
        currentScene?.markDirty();
      }
    });
  }

  const progressBar = new ReadingProgressBar(mainScroll, width);
  currentScene.add(progressBar);

  if (typeof window !== "undefined") {
    (window as any).currentScene = currentScene;
    (window as any).mainScroll = mainScroll;
  }

  let currentY = 20;

  // ── Header ──────────────────────────────────────────────────────────────────
  const headerContainer = new Container();
  headerContainer.setPosition(originX, currentY);

  const titleText = new RichText(
    [{ text: currentPageData.config.title, style: { bold: true, href: "/" } }],
    {
      font: "600 24px Noto Sans SC, sans-serif",
      color: "#332f29",
      onLinkClick: () => navigateTo("/"),
    }
  );
  headerContainer.add(titleText);

  const searchInput = new Input({
    width: 150,
    height: 32,
    placeholder: "搜索文章...",
    font: "14px Noto Sans SC, sans-serif",
    onChange: (val: string) => {
      const query = val.trim().toLowerCase();
      if (searchDropdown) {
        headerContainer.remove(searchDropdown);
        searchDropdown = null;
      }

      if (!query) {
        currentScene?.markDirty();
        return;
      }

      const matches = searchDatabase.filter(post => {
        const title = (post.title || "").toLowerCase();
        const desc = (post.description || "").toLowerCase();
        const content = (post.content || "").toLowerCase();

        if (query.startsWith("#")) {
          const tagQuery = query.slice(1);
          return post.tags && post.tags.some((tag: string) => tag.toLowerCase().includes(tagQuery));
        }
        const inTags = post.tags && post.tags.some((tag: string) => tag.toLowerCase().includes(query));
        return inTags || title.includes(query) || desc.includes(query) || content.includes(query);
      }).slice(0, 5);

      currentSearchMatches = matches;

      if (matches.length > 0) {
        searchDropdown = new Container();
        searchDropdown.setPosition(contentWidth - 250, 38);

        let dy = 0;
        for (const match of matches) {
          const card = new Card({
            width: 250,
            height: 50,
            bg: "#ede4d3",
            border: "#e8dfd0",
            radius: 4,
          });
          card.setPosition(0, dy);
          card.interactive = true;
          card.on("pointerup", () => { navigateTo(match.url); });

          const cardTitle = new Text(match.title, {
            font: "12px Noto Sans SC, sans-serif",
            color: "#332f29",
            maxWidth: 230,
          });
          cardTitle.setPosition(10, 8);
          card.add(cardTitle);

          const cardDate = new Text(match.date, {
            font: "10px Noto Sans SC, sans-serif",
            color: "#7a7265",
          });
          cardDate.setPosition(10, 30);
          card.add(cardDate);

          searchDropdown.add(card);
          dy += 52;
        }
        headerContainer.add(searchDropdown);
      }
      currentScene?.markDirty();
    }
  });
  searchInput.setPosition(contentWidth - 150, 0);
  headerContainer.add(searchInput);
  mainScroll.add(headerContainer);

  currentY += 80;

  // ── Divider ─────────────────────────────────────────────────────────────────
  const divider = new DividerLine(contentWidth);
  divider.setPosition(originX, currentY);
  mainScroll.add(divider);

  currentY += 40;

  // ── Fade-in page wrapper ─────────────────────────────────────────────────────
  const page = new PageContainer();
  page.setPosition(originX, currentY + 24); // start 24px lower, slides up
  mainScroll.add(page);

  const payload = currentPageData.data;

  if (payload.type === "index" || payload.type === "taxonomy_single") {
    // ── Post List ────────────────────────────────────────────────────────────
    let listY = 0;

    if (payload.type === "taxonomy_single") {
      const heading = new Text(`关于 "${payload.term}" 的所有文章`, {
        font: "600 20px Noto Sans SC, sans-serif",
        color: "#332f29",
      });
      heading.setPosition(0, listY);
      page.add(heading);
      listY += 40;
    }

    const posts = payload.posts || [];
    for (const post of posts) {
      // Animated post item with spring hover
      const postItem = new AnimatedPostItem(contentWidth);
      postItem.setPosition(0, listY);

      const postTitle = new RichText(
        [{ text: post.title, style: { bold: true, href: post.url } }],
        {
          font: "600 20px Noto Serif SC, serif",
          color: "#332f29",
          onLinkClick: () => navigateTo(post.url),
        }
      );
      postItem.add(postTitle);

      let itemY = postTitle.height + 8;

      const views = viewsMap.get(post.slug) ?? 0;
      let metaText = `${post.date} · 阅读: ${views} 次`;
      if (post.tags && post.tags.length > 0) {
        metaText += ` · 标签: ${post.tags.map((t: string) => `#${t}`).join(" ")}`;
      }

      const postMeta = new Text(metaText, {
        font: "13px Noto Sans SC, sans-serif",
        color: "#7a7265",
      });
      postMeta.setPosition(0, itemY);
      postItem.add(postMeta);

      itemY += 24;

      const summaryText = new CustomMarkdown(post.summary || post.description || "", {
        maxWidth: contentWidth,
        theme: {
          bodyFont: "15px Noto Serif SC, serif",
          textColor: "#7a7265",
          headingColor: "#332f29",
          codeColor: "#8c765c",
          codeBgColor: "#ede4d3",
          quoteBorderColor: "#8c765c",
          quoteTextColor: "#7a7265",
          hrColor: "#e8dfd0",
          fontSize: 15,
        },
        onLinkClick: (url: string) => navigateTo(url)
      });
      summaryText.setPosition(0, itemY);
      postItem.add(summaryText);

      itemY += summaryText.height + 16;

      const readMore = new RichText(
        [{ text: "阅读全文 →", style: { color: "#8c765c", href: post.url } }],
        {
          font: "14px Noto Sans SC, sans-serif",
          onLinkClick: () => navigateTo(post.url),
        }
      );
      readMore.setPosition(0, itemY);
      postItem.add(readMore);

      itemY += readMore.height + 30;

      const innerDiv = new DividerLine(contentWidth);
      innerDiv.setPosition(0, itemY);
      postItem.add(innerDiv);

      postItem.height = itemY + 1;
      page.add(postItem);
      listY += itemY + 40;
    }

    page.height = listY;

  } else if (payload.type === "page") {
    // ── Post Detail ──────────────────────────────────────────────────────────
    let detailY = 0;

    const pageTitle = new Text(payload.title, {
      font: "600 36px Noto Serif SC, serif",
      color: "#332f29",
      maxWidth: contentWidth,
    });
    pageTitle.setPosition(0, detailY);
    page.add(pageTitle);

    detailY += pageTitle.height + 12;

    const views = viewsMap.get(payload.slug) ?? 0;
    let metaText = `${payload.date} · 字数: ${payload.word_count} 字 · 阅读: ${views} 次`;
    if (payload.tags && payload.tags.length > 0) {
      metaText += ` · 标签: ${payload.tags.map((t: string) => `#${t}`).join(" ")}`;
    }

    const pageMeta = new Text(metaText, {
      font: "14px Noto Sans SC, sans-serif",
      color: "#7a7265",
    });
    pageMeta.setPosition(0, detailY);
    page.add(pageMeta);

    detailY += pageMeta.height + 40;

    let rawMarkdown = payload.raw_content || "";
    // Strip Zola TOML and YAML frontmatter
    rawMarkdown = rawMarkdown.trimStart().replace(/^(?:\+\+\+|---)[\s\S]*?(?:\+\+\+|---)\n*/, "");
    const md = new CustomMarkdown(rawMarkdown, {
      maxWidth: contentWidth,
      theme: {
        bodyFont: "18px Noto Serif SC, serif",
        codeFont: "16px monospace",
        textColor: "#332f29",
        headingColor: "#332f29",
        codeColor: "#8c765c",
        codeBgColor: "#ede4d3",
        quoteBorderColor: "#8c765c",
        quoteTextColor: "#7a7265",
        hrColor: "#e8dfd0",
        fontSize: 18,
      },
      onLinkClick: (url: string) => navigateTo(url)
    });
    md.setPosition(0, detailY);
    page.add(md);
    detailY += md.height + 24;

    // Prev/Next Navigation
    const navEntity = new Container();
    navEntity.setPosition(0, detailY);

    if (payload.navigation?.earlier) {
      const ear = payload.navigation.earlier;
      const prev = new RichText(
        [{ text: `← ${ear.title}`, style: { color: "#8c765c", href: ear.url } }],
        { font: "14px Noto Sans SC, sans-serif", onLinkClick: () => navigateTo(ear.url) }
      );
      prev.setPosition(0, 0);
      navEntity.add(prev);
    }

    if (payload.navigation?.later) {
      const lat = payload.navigation.later;
      const nextText = new RichText(
        [{ text: `${lat.title} →`, style: { color: "#8c765c", href: lat.url } }],
        { font: "14px Noto Sans SC, sans-serif", onLinkClick: () => navigateTo(lat.url) }
      );
      nextText.setPosition(contentWidth - nextText.width, 0);
      navEntity.add(nextText);
    }

    page.add(navEntity);
    detailY += 40;

    detailY += 20;
    const backBtn = new RichText(
      [{ text: "← 返回列表", style: { color: "#8c765c", href: "/" } }],
      { font: "14px Noto Sans SC, sans-serif", onLinkClick: () => navigateTo("/") }
    );
    backBtn.setPosition(0, detailY);
    page.add(backBtn);

    detailY += backBtn.height + 40;
    page.height = detailY;

    (md as any).onHeightChanged = () => {
      let nextY = md.y + md.height + 24;
      navEntity.setPosition(0, nextY);
      nextY += 40 + 20;
      backBtn.setPosition(0, nextY);
      nextY += backBtn.height + 40;

      page.height = nextY;
      const f = (page as any)._footer;
      if (f) {
        const footerY = page.height + 60;
        f.setPosition(0, footerY);
        page.height = footerY + 80;
      }

      if (typeof document !== 'undefined') {
        document.body.style.height = `${page.height}px`;
        mainScroll.height = page.height;
      }
      currentScene?.markDirty();
    };
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footerY = page.height + 60;
  const footerContainer = new Container();
  (page as any)._footer = footerContainer;
  footerContainer.setPosition(0, footerY);

  const footerText = new Text(`© ${new Date().getFullYear()} Xuepoo. Crafted in VectoJS.`, {
    font: "12px Noto Sans SC, sans-serif",
    color: "#7a7265",
  });
  footerText.setPosition(0, 0);
  footerContainer.add(footerText);

  page.add(footerContainer);
  page.height = footerY + 80;

  // IMPORTANT: Set the document body height so native scrolling works
  if (typeof document !== 'undefined') {
    document.body.style.height = `${page.height}px`;
    mainScroll.height = page.height;
  }

  currentScene.markDirty();
  // Force a synchronous render immediately to prevent canvas flickering during window resize.
  // This ensures the canvas pixel buffer is refilled in the same event loop task after
  // Scene.ts clears it via canvas.width = newWidth.
  currentScene.render((currentScene as any).renderer, 0, performance.now());
}

// ─── View Tracking ────────────────────────────────────────────────────────────

async function loadViewCounts() {
  try {
    const res = await fetch("/api/views");
    const data = await res.json();
    for (const [slug, count] of Object.entries(data)) {
      viewsMap.set(slug, count as number);
    }
  } catch (e) {
    console.error("Failed to load view counts", e);
  }
}

async function logCurrentPageView() {
  if (currentPageData?.data?.type === "page") {
    const slug = currentPageData.data.slug;
    try {
      const url = `/api/views?slug=${encodeURIComponent(slug)}`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (data && typeof data.views === "number") {
        viewsMap.set(slug, data.views);
      }
    } catch (e) {
      console.error("Failed to log view", e);
    }
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const canvas = document.getElementById("vecto-canvas") as HTMLCanvasElement;
  if (!canvas) return;

  currentScene = new Scene(canvas, { maxFPS: 60 });
  currentScene.renderMode = "onDemand";
  currentScene.start();

  window.dispatchEvent(new Event("resize"));

  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchDropdown && currentSearchMatches.length > 0) {
      navigateTo(currentSearchMatches[0].url);
    }
  });

  initSearchDatabase();

  const dataElement = document.getElementById("page-data");
  if (dataElement) {
    currentPageData = parsePageData(dataElement.textContent || "");
  }

  await loadViewCounts();
  await logCurrentPageView();

  renderPage();

  window.addEventListener("resize", () => { renderPage(); });

  window.addEventListener("popstate", async () => {
    await handleUrlRoute(window.location.pathname);
  });

  if (typeof document !== "undefined" && (document as any).fonts) {
    (document as any).fonts.ready.then(() => { renderPage(); });
  }
});

function renderPage() {
  if (currentPageData) {
    renderApp();
  }
}
