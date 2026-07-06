import { Scene, Entity } from "@vectojs/core";
import { ScrollView, Text, RichText, Input, Card } from "@vectojs/ui";

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

// HTML tags to RichText spans
function parseHtmlToSpans(html: string): any[] {
  const spans: any[] = [];
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  function traverse(node: Node, style: any = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) {
        spans.push({ text, style: { ...style } });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const nextStyle = { ...style };

      if (el.tagName === "STRONG" || el.tagName === "B") {
        nextStyle.bold = true;
      } else if (el.tagName === "EM" || el.tagName === "I") {
        nextStyle.italic = true;
      } else if (el.tagName === "A") {
        nextStyle.href = el.getAttribute("href") || "";
      } else if (el.tagName === "CODE") {
        nextStyle.color = "#8c765c";
        nextStyle.bold = true;
      }

      for (let i = 0; i < el.childNodes.length; i++) {
        traverse(el.childNodes[i], nextStyle);
      }
    }
  }

  traverse(tempDiv);
  return spans;
}

interface ContentBlock {
  type: "h1" | "h2" | "h3" | "p" | "pre" | "blockquote" | "ul" | "ol";
  spans?: any[];
  text?: string;
  codeLang?: string;
  items?: any[][];
}

function parseHtmlToBlocks(html: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const div = document.createElement("div");
  div.innerHTML = html;

  for (let i = 0; i < div.childNodes.length; i++) {
    const node = div.childNodes[i];
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;

    if (
      el.tagName === "H1" ||
      el.tagName === "H2" ||
      el.tagName === "H3" ||
      el.tagName === "H4" ||
      el.tagName === "H5" ||
      el.tagName === "H6"
    ) {
      const spans = parseHtmlToSpans(el.innerHTML);
      for (const span of spans) {
        span.style = { ...span.style, bold: true };
      }
      blocks.push({
        type: el.tagName.toLowerCase() as any,
        spans,
      });
    } else if (el.tagName === "IMG") {
      blocks.push({
        type: "p",
        text: el.getAttribute("src") || "",
        codeLang: "image",
        spans: [{ text: el.getAttribute("alt") || "" }],
      });
    } else if (el.tagName === "P") {
      const imgEl = el.querySelector("img");
      const hasMath = el.querySelector(".katex") !== null;
      if (imgEl) {
        blocks.push({
          type: "p",
          text: imgEl.getAttribute("src") || "",
          codeLang: "image",
          spans: [{ text: imgEl.getAttribute("alt") || "" }],
        });
      } else if (hasMath) {
        blocks.push({
          type: "blockquote",
          text: el.outerHTML,
          codeLang: "math",
        });
      } else {
        blocks.push({
          type: "p",
          spans: parseHtmlToSpans(el.innerHTML),
        });
      }
    } else if (el.classList.contains("katex-display") || el.querySelector(".katex-display") !== null) {
      blocks.push({
        type: "blockquote",
        text: el.innerHTML,
        codeLang: "math",
      });
    } else if (el.tagName === "PRE") {
      const codeEl = el.querySelector("code");
      const text = codeEl ? codeEl.textContent || "" : el.textContent || "";
      const codeLang = codeEl ? codeEl.className.replace("language-", "") : "";
      blocks.push({
        type: "pre",
        text: text.trim(),
        codeLang,
      });
    } else if (el.tagName === "BLOCKQUOTE") {
      blocks.push({
        type: "blockquote",
        spans: parseHtmlToSpans(el.innerHTML),
      });
    } else if (el.tagName === "UL" || el.tagName === "OL") {
      const items = Array.from(el.querySelectorAll("li")).map(li => parseHtmlToSpans(li.innerHTML));
      blocks.push({
        type: el.tagName.toLowerCase() as any,
        items,
      } as any);
    }
  }

  return blocks;
}

// ─── Custom Entity Components ─────────────────────────────────────────────────

class QuoteBlock extends Entity {
  constructor(spans: any[], width: number) {
    super();
    const rt = new RichText(spans, {
      font: "italic 16px Noto Serif SC, serif",
      color: "#7a7265",
      maxWidth: width - 24,
    });
    rt.setPosition(20, 0);
    this.add(rt);

    this.width = width;
    this.height = rt.height;
  }

  public render(r: any): void {
    r.save();
    r.beginPath();
    r.roundRect(0, 0, 4, this.height, 0);
    r.fill("#8c765c");
    r.restore();
  }
}

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
          renderPage();
        };
        img.onerror = () => {
          this.loaded = false;
          const aspectRatio = 150 / this.maxWidth;
          this.height = 150;
          imageCache.set(src, { img, aspectRatio });
          renderPage();
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

class CodeBlock extends Entity {
  constructor(text: string, width: number) {
    super();
    let wrappedText = "";
    if (width > 0) {
      const charsPerLine = Math.floor((width - 32) / 8.4);
      for (const line of text.split("\n")) {
        let currentLine = line;
        while (currentLine.length > charsPerLine) {
          wrappedText += currentLine.substring(0, charsPerLine) + "\n";
          currentLine = currentLine.substring(charsPerLine);
        }
        wrappedText += currentLine + "\n";
      }
      if (wrappedText.endsWith("\n")) wrappedText = wrappedText.slice(0, -1);
    } else {
      wrappedText = text;
    }

    const t = new Text(wrappedText, {
      font: "14px monospace",
      color: "#332f29",
      preserveLeadingSpaces: true,
      lineHeight: 22,
    });
    t.setPosition(16, 16);
    this.add(t);

    this.width = width;
    this.height = t.height + 32;
  }

  public render(r: any): void {
    r.save();
    r.beginPath();
    r.roundRect(0, 0, this.width, this.height, 4);
    r.fill("#ede4d3");
    r.restore();
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

function initSearchDatabase() {
  const searchElement = document.getElementById("search-data");
  if (searchElement) {
    try {
      searchDatabase = JSON.parse(decrypt(searchElement.textContent || ""));
      if (typeof window !== "undefined") {
        (window as any).searchDatabase = searchDatabase;
      }
    } catch (e) {
      console.error("Failed to parse search database", e);
    }
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

      const summaryText = new RichText(
        parseHtmlToSpans(post.summary || post.description || ""),
        {
          font: "15px Noto Serif SC, serif",
          color: "#7a7265",
          maxWidth: contentWidth,
        }
      );
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

    const contentBlocks = parseHtmlToBlocks(payload.content);
    for (const block of contentBlocks) {
      let blockEntity: Entity;

      if (block.codeLang === "image") {
        blockEntity = new BlogImage(block.text || "", block.spans?.[0]?.text || "", contentWidth);
      } else if (block.codeLang === "math") {
        blockEntity = new MathBlock(block.text || "", contentWidth);
      } else if (
        block.type === "h1" || block.type === "h2" || block.type === "h3" ||
        block.type === "h4" || block.type === "h5" || block.type === "h6"
      ) {
        const fs = block.type === "h1" ? 32 : block.type === "h2" ? 26 : block.type === "h3" ? 21 : 18;
        blockEntity = new RichText(block.spans || [], {
          font: `600 ${fs}px Noto Serif SC, serif`,
          color: "#332f29",
          maxWidth: contentWidth,
        });
      } else if (block.type === "pre") {
        blockEntity = new CodeBlock(block.text || "", contentWidth);
      } else if (block.type === "blockquote") {
        blockEntity = new QuoteBlock(block.spans || [], contentWidth);
      } else {
        blockEntity = new RichText(block.spans || [], {
          font: "16px Noto Serif SC, serif",
          color: "#332f29",
          maxWidth: contentWidth,
        });
      }

      blockEntity.setPosition(0, detailY);
      page.add(blockEntity);
      detailY += blockEntity.height + 24;
    }

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
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footerY = page.height + 60;
  const footerContainer = new Container();
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
    document.body.style.height = `${footerY + 80}px`;
    mainScroll.height = footerY + 80;
  }
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
