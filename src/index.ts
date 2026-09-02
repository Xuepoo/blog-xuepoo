import { Scene, Entity, type IRenderer, type A11yAttributes, VectoJSEvent } from '@vectojs/core';
import { Text, RichText, Input, Card } from '@vectojs/ui';
import { createArticleMarkdown } from './article';
import {
  createCapGlyphImageResolver,
  demoDirectImageA11y,
  shouldEnableCapGlyphResolver,
} from './capglyph-demo';
import { FindController } from './find';
import { withWholeLineProjection } from './text-utils';

const key = 42;

// Decrypt function matching obfuscate.ts using byte-level TextDecoder
function decrypt(obfuscated: string): string {
  if (obfuscated.startsWith('e:')) {
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
    console.error('Failed to parse page data', e);
    return null;
  }
}
/**
 * Zola emits summaries/descriptions as plain text (the template runs
 * `striptags`); strip leftover markdown markers so they render cleanly with a
 * plain `Text` entity on the list page.
 */
function cleanPlainText(text: string): string {
  return text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '');
}

/** Dismiss the search result dropdown, wherever it is currently attached. */
function closeSearchDropdown() {
  if (searchDropdown) {
    if (searchDropdownHost) searchDropdownHost.remove(searchDropdown);
    searchDropdown = null;
    searchDropdownHost = null;
    currentSearchMatches = [];
  }
}

// Global state
let currentScene: Scene | null = null;
let currentPageData: any = null;
let searchDatabase: any[] = [];
let searchDropdown: any = null;
let currentSearchMatches: any[] = [];
let viewsMap = new Map<string, number>();
// Search dropdown host (the header container it is attached to), so a global
// Ctrl+F can dismiss it.
let searchDropdownHost: Container | null = null;
// Native body scrolling hooks attach once — renderApp rebuilds the entity tree
// on every route change / resize, so the guard must not re-add listeners.
let scrollListenersAttached = false;
let searchDatabaseLoaded = false;
let lastDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
const findController = new FindController();
let currentMainScroll: Container | null = null;

class DividerLine extends Entity {
  public isPointInside(_globalX: number, _globalY: number): boolean {
    return false;
  }
  private color: string;
  constructor(width: number, color: string = '#e8dfd0') {
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
  public isPointInside(_globalX: number, _globalY: number): boolean {
    return false;
  }
  public render(_r: any): void {}
}

// ─── Table of Contents (native VectoJS, mirrors the pre-SPA Tera TOC) ─────────

interface TocEntry {
  title: string;
  permalink: string;
  children?: TocEntry[];
}

/**
 * One TOC row: a presentational `RichText` label wrapped in an interactive
 * entity that projects `role: 'link'` with a real tab stop and activates on
 * click or Enter/Space — the accessible-control shape `getA11yAttributes()`
 * needs (a bare `interactive = true` `RichText` would report only its text
 * as a label, with no role or keyboard path).
 */
class TocLinkRow extends Entity {
  public isPointInside(globalX: number, globalY: number): boolean {
    const local = this.worldToLocal(globalX, globalY);
    if (!local) return false;
    return local.x >= 0 && local.x <= this.width && local.y >= 0 && local.y <= this.height;
  }
  constructor(
    private readonly title: string,
    width: number,
    private readonly onActivate: () => void,
  ) {
    super();
    this.interactive = true;
    const label = withWholeLineProjection(
      new RichText([{ text: title, style: { color: '#7a7265' } }], {
        font: '13px Noto Sans SC, sans-serif',
        maxWidth: width,
      }),
    );
    this.add(label);
    this.width = width;
    this.height = label.height;
    this.on('click', () => this.onActivate());
    this.on('keydown', (e: VectoJSEvent<KeyboardEvent>) => {
      if (e.nativeEvent?.key === 'Enter' || e.nativeEvent?.key === ' ') this.onActivate();
    });
  }
  public override getA11yAttributes(): A11yAttributes {
    return { role: 'link', label: this.title, tabIndex: 0 };
  }
  public render(_r: IRenderer): void {}
}

function buildTocRow(
  entry: TocEntry,
  indent: number,
  width: number,
  onActivate: () => void,
): TocLinkRow {
  const row = new TocLinkRow(entry.title, width - indent, onActivate);
  row.setPosition(indent, 0);
  return row;
}

/**
 * Lays out a flat h1/h2 TOC tree into a vertical stack of rows, returning the
 * total height. `onNavigate` receives each row's index into
 * {@link flattenToc}'s document-order sequence, so the caller can scroll to
 * the matching heading entity without needing a DOM anchor.
 */
function layoutTocRows(
  container: Entity,
  toc: TocEntry[],
  width: number,
  onNavigate: (flatIndex: number) => void,
): number {
  let y = 0;
  let flatIndex = 0;
  for (const h1 of toc) {
    const index = flatIndex++;
    const row = buildTocRow(h1, 0, width, () => onNavigate(index));
    row.setPosition(0, y);
    container.add(row);
    y += row.height + 6;
    for (const h2 of h1.children ?? []) {
      const childIndex = flatIndex++;
      const child = buildTocRow(h2, 16, width, () => onNavigate(childIndex));
      child.setPosition(16, y);
      container.add(child);
      y += child.height + 6;
    }
  }
  return Math.max(0, y - 6);
}

/**
 * Desktop sticky sidebar TOC. Lives in the Scene overlay layer (viewport-fixed,
 * like the old CSS `position: sticky`) rather than in `mainScroll`, so it does
 * not need its own scroll-position math — the overlay layer is not affected by
 * `mainScroll.y`. Repositioned on every resize by the caller.
 */
class TocSidebar extends Entity {
  public isPointInside(_globalX: number, _globalY: number): boolean {
    return false;
  }
  constructor(toc: TocEntry[], width: number, onNavigate: (flatIndex: number) => void) {
    super();
    this.width = width;

    const title = withWholeLineProjection(
      new Text('目录', {
        font: '600 13px Noto Sans SC, sans-serif',
        color: '#332f29',
      }),
    );
    this.add(title);

    const list = new Container();
    list.setPosition(0, title.height + 12);
    this.add(list);

    this.height = title.height + 12 + layoutTocRows(list, toc, width, onNavigate);

    // Keeps a drag-selection in the article body from swallowing the TOC.
    // A native `Selection` covers everything between anchor and focus in DOM
    // order, and VectoJS projects every text entity as a flat sibling div under
    // one a11y root. Its ordering pass bands those divs into visual reading
    // order *per region*, where a region is the nearest `clipChildren`
    // ancestor — precisely so side-by-side columns stay contiguous DOM runs and
    // a vertical drag through one cannot cross into the other. Without a region
    // of its own this sidebar's rows interleave with the body paragraphs they
    // sit level with, so selecting two body paragraphs also selected all nine
    // TOC rows ordered between them (measured on the built page). Clipping is
    // free here: this entity draws nothing and every row fits inside its box.
    this.clipChildren = true;
  }
  public render(_r: IRenderer): void {}
}

/**
 * Mobile collapsible TOC (`<details class="mobile-toc">` equivalent): a
 * tappable header that expands/collapses the row list, inline in the
 * article flow. Calls `onToggle` after every toggle so the caller can reflow
 * content below it.
 */
class MobileToc extends Entity {
  public isPointInside(_globalX: number, _globalY: number): boolean {
    return false;
  }
  private expanded = false;
  private header: Card;
  private headerLabel: RichText;
  private list: Container | null = null;
  private readonly collapsedHeight = 40;
  private readonly toc: TocEntry[];
  private readonly onNavigate: (flatIndex: number) => void;
  public onToggle?: () => void;

  constructor(toc: TocEntry[], width: number, onNavigate: (flatIndex: number) => void) {
    super();
    this.width = width;
    this.toc = toc;
    this.onNavigate = onNavigate;

    this.header = new Card({
      width,
      height: this.collapsedHeight,
      bg: '#ede4d3',
      border: '#e8dfd0',
      radius: 6,
      label: '文章目录',
      onClick: () => this.toggle(),
    });
    this.headerLabel = withWholeLineProjection(
      new RichText([{ text: '▸ 文章目录', style: { bold: true, color: '#332f29' } }], {
        font: '14px Noto Sans SC, sans-serif',
      }),
    );
    this.headerLabel.setPosition(12, 11);
    this.header.add(this.headerLabel);
    this.add(this.header);

    this.height = this.collapsedHeight;
  }

  private toggle(): void {
    this.expanded = !this.expanded;
    this.headerLabel.setSpans([
      {
        text: this.expanded ? '▾ 文章目录' : '▸ 文章目录',
        style: { bold: true, color: '#332f29' },
      },
    ]);

    if (this.expanded) {
      this.list = new Container();
      this.list.setPosition(12, this.collapsedHeight + 12);
      this.add(this.list);
      const listHeight = layoutTocRows(this.list, this.toc, this.width - 24, this.onNavigate);
      this.header.height = this.collapsedHeight + 12 + listHeight + 16;
      this.height = this.header.height;
    } else if (this.list) {
      this.remove(this.list);
      this.list = null;
      this.header.height = this.collapsedHeight;
      this.height = this.collapsedHeight;
    }

    this.onToggle?.();
    this.scene?.markDirty();
  }

  public render(_r: IRenderer): void {}
}

// ─── Post Card with Hover Highlight (no y-shift to avoid layout overlap) ──────

class AnimatedPostItem extends Entity {
  public isPointInside(globalX: number, globalY: number): boolean {
    const local = this.worldToLocal(globalX, globalY);
    if (!local) return false;
    return local.x >= 0 && local.x <= this.width && local.y >= 0 && local.y <= this.height;
  }
  private hovered = false;

  constructor(width: number) {
    super();
    this.width = width;
    this.interactive = true;
    this.height = 0;

    // Only change the background on hover — no y movement which would cause
    // visual overlap with adjacent layout items.
    this.on('hover', () => {
      this.hovered = true;
      currentScene?.markDirty();
    });
    this.on('pointerleave', () => {
      this.hovered = false;
      currentScene?.markDirty();
    });
  }

  public render(r: any): void {
    if (this.hovered) {
      r.save();
      r.beginPath();
      r.roundRect(-12, -8, this.width + 24, this.height + 16, 8);
      r.fill('rgba(140, 118, 92, 0.07)');
      r.restore();
    }
  }
}

// ─── Reading Progress Bar (Easing.easeOutCubic) ───────────────────────────────

class ReadingProgressBar extends Entity {
  public isPointInside(_globalX: number, _globalY: number): boolean {
    return false;
  }
  private scrollRef: Container;
  private displayProgress = 0;

  constructor(scrollRef: Container, width: number) {
    super();
    this.scrollRef = scrollRef;
    this.width = width;
    this.height = 3;
  }

  public override update(dt: number, time: number): void {
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
    r.fill('rgba(140, 118, 92, 0.12)');

    r.beginPath();
    r.roundRect(0, 0, this.width * this.displayProgress, this.height, 0);
    r.fill('#8c765c');
    r.restore();
  }
}

// ─── Page Container with Fade-in Transition (opacity only, no y-shift) ────────

class PageContainer extends Entity {
  public isPointInside(_globalX: number, _globalY: number): boolean {
    return false;
  }
  constructor() {
    super();
    // Use opacity-only fade: changing y would disturb the layout for children.
    this.opacity = 0;
    this.setTransition({
      opacity: { duration: 340, easing: 'easeOutCubic' },
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

function isSameBlogOrigin(parsedUrl: URL): boolean {
  const host = parsedUrl.hostname;
  const currentHost = window.location.hostname;
  if (host === currentHost) return true;
  const blogDomains = ['blog.xuepoo.xyz', 'localhost', '127.0.0.1'];
  const isTargetBlog = blogDomains.includes(host) || host.endsWith('xuepoo-blog.pages.dev');
  const isCurrentBlog =
    blogDomains.includes(currentHost) || currentHost.endsWith('xuepoo-blog.pages.dev');
  return isTargetBlog && isCurrentBlog;
}

async function navigateTo(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      if (!isSameBlogOrigin(parsed)) {
        window.location.href = url;
        return;
      }
      const targetUrl = parsed.pathname + parsed.search + parsed.hash;
      window.history.pushState({}, '', targetUrl);
      await handleUrlRoute(targetUrl);
      return;
    } catch (e) {
      console.warn('Failed to parse URL in navigateTo:', e);
    }
  }
  window.history.pushState({}, '', url);
  await handleUrlRoute(url);
}

async function handleUrlRoute(url: string) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const dataElement = doc.getElementById('page-data');
    if (dataElement) {
      const raw = dataElement.textContent || '';
      currentPageData = parsePageData(raw);
      if (currentPageData && currentScene) {
        renderApp();
      }
    }
  } catch (e) {
    console.error('SPA Navigation failed, reloading page...', e);
    window.location.href = url;
  }
}

async function initSearchDatabase() {
  if (searchDatabaseLoaded) return;
  searchDatabaseLoaded = true;
  try {
    const response = await fetch('/search.json');
    if (response.ok) {
      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const searchElement = doc.getElementById('search-data');
      if (searchElement) {
        const rawText = searchElement.textContent || '';
        try {
          searchDatabase = JSON.parse(decrypt(rawText.trim()));
          if (typeof window !== 'undefined') {
            (window as any).searchDatabase = searchDatabase;
          }
        } catch (parseError) {
          console.warn('Failed to parse decrypted search database JSON:', parseError);
        }
      } else {
        console.warn('Search-data script element not found in HTML response');
      }
    }
  } catch (e) {
    console.warn('Failed to fetch search database', e);
  }
}

// ─── Main Render ──────────────────────────────────────────────────────────────

async function renderApp() {
  if (!currentScene || !currentPageData) return;
  // Keep the reader's place across rebuilds (resize / zoom / DPR change): the
  // fresh mainScroll starts at y = 0 while `window.scrollY` keeps its old
  // value, which would snap the canvas to the top. Restored at the end.
  const prevScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  const maxScrollY =
    typeof window !== 'undefined'
      ? Math.max(1, (document.body.scrollHeight || 0) - window.innerHeight)
      : 1;
  const scrollRatio = prevScrollY / maxScrollY;

  // Clear existing entities
  const root = (currentScene as any).root;
  if (root && root.children) {
    const kids = [...root.children];
    for (const kid of kids) {
      currentScene.remove(kid);
      // Recursively destroy entity subtree to aggressively free memory (RichText caches, etc.)
      const destroySubtree = (node: any) => {
        if (node.children) {
          const children = [...node.children];
          for (const c of children) destroySubtree(c);
        }
        if (typeof node.destroy === 'function') node.destroy();
      };
      destroySubtree(kid);
    }
  }

  const width = window.innerWidth;
  const contentWidth = Math.min(920, width - 40);
  const isMobile = contentWidth < 600;
  const originX = (width - contentWidth) / 2;

  const mainScroll = new Container();
  currentMainScroll = mainScroll;
  findController.attach(currentScene, mainScroll);
  findController.reset();

  // Use a fast tween instead of a spring to prevent elastic bouncing / overshoot,
  // while still smoothing out rigid mouse wheel steps.
  mainScroll.setTransition({ y: { duration: 120, easing: 'easeOutCubic' } });

  // Keep the VectoJS render loop alive while the scrolling spring settles
  const _origUpdate = mainScroll.update.bind(mainScroll);
  mainScroll.update = function (dt: number, time: number) {
    _origUpdate(dt, time);
    if (this.hasPendingAnimations()) {
      currentScene?.markDirty();
    }
  };

  currentScene.add(mainScroll);

  if (!scrollListenersAttached) {
    scrollListenersAttached = true;
    // Enable native scrolling on body
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';

    window.addEventListener('scroll', () => {
      if (currentMainScroll) {
        currentMainScroll.y = -window.scrollY;
        currentScene?.markDirty();
      }
    });
  }

  const progressBar = new ReadingProgressBar(mainScroll, width);
  currentScene.add(progressBar);

  if (typeof window !== 'undefined') {
    (window as any).currentScene = currentScene;
    (window as any).mainScroll = mainScroll;
  }

  let currentY = 20;

  // ── Header ──────────────────────────────────────────────────────────────────
  const headerContainer = new Container();
  headerContainer.setPosition(originX, currentY);

  const titleText = withWholeLineProjection(
    new RichText(
      [
        {
          text: currentPageData.config.title,
          style: { bold: true, href: '/' },
        },
      ],
      {
        font: '600 24px Noto Sans SC, sans-serif',
        color: '#332f29',
        onLinkClick: () => navigateTo('/'),
      },
    ),
  );
  headerContainer.add(titleText);

  const searchInput = new Input({
    width: 150,
    height: 32,
    placeholder: '搜索文章...',
    font: '14px Noto Sans SC, sans-serif',
    onChange: (val: string) => {
      const query = val.trim().toLowerCase();
      closeSearchDropdown();

      if (!query) {
        currentScene?.markDirty();
        return;
      }

      const matches = searchDatabase
        .filter((post) => {
          const title = (post.title || '').toLowerCase();
          const desc = (post.description || '').toLowerCase();
          const content = (post.content || '').toLowerCase();

          if (query.startsWith('#')) {
            const tagQuery = query.slice(1);
            return (
              post.tags && post.tags.some((tag: string) => tag.toLowerCase().includes(tagQuery))
            );
          }
          const inTags =
            post.tags && post.tags.some((tag: string) => tag.toLowerCase().includes(query));
          return inTags || title.includes(query) || desc.includes(query) || content.includes(query);
        })
        .slice(0, 5);

      currentSearchMatches = matches;

      if (matches.length > 0) {
        searchDropdown = new Container();
        searchDropdown.setPosition(contentWidth - 250, 38);

        let dy = 0;
        for (const match of matches) {
          const card = new Card({
            width: 250,
            height: 50,
            bg: '#ede4d3',
            border: '#e8dfd0',
            radius: 4,
            label: `文章: ${match.title}`,
          });
          card.setPosition(0, dy);
          const handleNavigation = () => {
            navigateTo(match.url);
          };
          card.on('click', handleNavigation);
          card.on('pointerup', handleNavigation);

          const cardTitle = withWholeLineProjection(
            new Text(match.title, {
              font: '12px Noto Sans SC, sans-serif',
              color: '#332f29',
              maxWidth: 230,
            }),
          );
          cardTitle.setPosition(10, 8);
          card.add(cardTitle);
          const cardDate = withWholeLineProjection(
            new Text(match.date, {
              font: '10px Noto Sans SC, sans-serif',
              color: '#7a7265',
            }),
          );
          cardDate.setPosition(10, 30);
          card.add(cardDate);

          searchDropdown.add(card);
          dy += 52;
        }
        headerContainer.add(searchDropdown);
      }
      searchDropdownHost = headerContainer;
      currentScene?.markDirty();
    },
  });
  searchInput.on('keydown', (e: any) => {
    if (e.nativeEvent?.key === 'Enter') {
      if (currentSearchMatches && currentSearchMatches.length > 0) {
        navigateTo(currentSearchMatches[0].url);
      }
    }
  });
  // Load the search index only when the box is first focused, not on every
  // page load — search.json is the full-text index and costs a fetch + parse.
  searchInput.on('focus', () => {
    void initSearchDatabase();
  });
  if (isMobile) {
    searchInput.setPosition(0, 45);
    searchInput.width = contentWidth;
    headerContainer.add(searchInput);
    mainScroll.add(headerContainer);
    currentY += 120;
  } else {
    searchInput.setPosition(contentWidth - 150, 0);
    headerContainer.add(searchInput);
    mainScroll.add(headerContainer);
    currentY += 80;
  }

  // ── Divider ─────────────────────────────────────────────────────────────────
  const divider = new DividerLine(contentWidth);
  divider.setPosition(originX, currentY);
  mainScroll.add(divider);

  currentY += 40;

  // ── Fade-in page wrapper ─────────────────────────────────────────────────────
  const page = new PageContainer();
  page.setPosition(originX, currentY + 24); // start 24px lower, slides up
  mainScroll.add(page);
  let footerContainer: Container | null = null;

  const payload = currentPageData.data;

  if (payload.type === 'index' || payload.type === 'taxonomy_single') {
    // ── Post List ────────────────────────────────────────────────────────────
    let listY = 0;

    if (payload.type === 'taxonomy_single') {
      const heading = withWholeLineProjection(
        new Text(`关于 "${payload.term}" 的所有文章`, {
          font: '600 20px Noto Sans SC, sans-serif',
          color: '#332f29',
          maxWidth: contentWidth,
        }),
      );
      heading.setPosition(0, listY);
      page.add(heading);
      listY += 40;
    }

    const posts = payload.posts || [];
    for (const post of posts) {
      // Animated post item with spring hover
      const postItem = new AnimatedPostItem(contentWidth);
      postItem.setPosition(0, listY);

      const postTitle = withWholeLineProjection(
        new RichText([{ text: post.title, style: { bold: true, href: post.url } }], {
          font: '600 20px Noto Serif SC, serif',
          color: '#332f29',
          maxWidth: contentWidth,
          onLinkClick: () => navigateTo(post.url),
        }),
      );
      postItem.add(postTitle);

      let itemY = postTitle.height + 8;

      const views = viewsMap.get(post.slug) ?? 0;
      let metaText = `${post.date} · 阅读: ${views} 次`;
      if (post.tags && post.tags.length > 0) {
        metaText += ` · 标签: ${post.tags.map((t: string) => `#${t}`).join(' ')}`;
      }

      const postMeta = withWholeLineProjection(
        new Text(metaText, {
          font: '13px Noto Sans SC, sans-serif',
          color: '#7a7265',
          maxWidth: contentWidth,
        }),
      );
      postMeta.setPosition(0, itemY);
      postItem.add(postMeta);

      itemY += 24;

      // List pages render plain summaries (see `cleanPlainText`), so a full
      // markdown renderer is unnecessary here — keeping `@vectojs/markdown`
      // out of the eager bundle saves its ~380KB chunk on the homepage.
      const summaryText = withWholeLineProjection(
        new Text(cleanPlainText(post.summary || post.description || ''), {
          font: '15px Noto Serif SC, serif',
          color: '#7a7265',
          maxWidth: contentWidth,
        }),
      );
      summaryText.setPosition(0, itemY);
      postItem.add(summaryText);

      itemY += summaryText.height + 16;

      const readMore = withWholeLineProjection(
        new RichText([{ text: '阅读全文 →', style: { color: '#8c765c', href: post.url } }], {
          font: '14px Noto Sans SC, sans-serif',
          onLinkClick: () => navigateTo(post.url),
        }),
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
  } else if (payload.type === 'page') {
    // ── Post Detail ──────────────────────────────────────────────────────────
    let detailY = 0;

    const pageTitle = withWholeLineProjection(
      new RichText(
        [
          {
            text: payload.title || 'Untitled',
            style: { fontSize: isMobile ? 32 : 44, bold: true },
          },
        ],
        {
          font: `${isMobile ? 32 : 44}px STKaiti, KaiTi, serif`,
          color: '#332f29',
          maxWidth: contentWidth,
        },
      ),
    );
    pageTitle.setPosition(0, detailY);
    page.add(pageTitle);

    detailY += pageTitle.height + 12;

    const views = viewsMap.get(payload.slug) ?? 0;
    let metaText = `${payload.date} · 字数: ${payload.word_count} 字 · 阅读: ${views} 次`;
    if (payload.tags && payload.tags.length > 0) {
      metaText += ` · 标签: ${payload.tags.map((t: string) => `#${t}`).join(' ')}`;
    }

    const pageMeta = withWholeLineProjection(
      new Text(metaText, {
        font: '14px Noto Sans SC, sans-serif',
        color: '#7a7265',
        maxWidth: contentWidth,
      }),
    );
    pageMeta.setPosition(0, detailY);
    page.add(pageMeta);

    detailY += pageMeta.height + 40;

    const toc: TocEntry[] = payload.toc || [];
    const showToc = toc.length > 0;
    // Desktop sidebar needs room beside the centered column: 240px sidebar + 40px gap.
    const tocSidebarWidth = 240;
    const showDesktopToc = showToc && !isMobile && originX >= tocSidebarWidth + 40;
    let mobileToc: MobileToc | null = null;

    // `md` (built below) owns the heading entities a TOC click scrolls to, but
    // the TOC rows are laid out before it for mobile (matching the pre-SPA
    // `<details>` position ahead of the article body). Route through a ref
    // cell rather than reordering construction, since the callback is only
    // ever invoked later, on click.
    const navigateToHeading = { fn: (_flatIndex: number) => {} };
    const onTocNavigate = (flatIndex: number) => navigateToHeading.fn(flatIndex);

    if (showToc && !showDesktopToc) {
      mobileToc = new MobileToc(toc, contentWidth, onTocNavigate);
      mobileToc.setPosition(0, detailY);
      page.add(mobileToc);
      detailY += mobileToc.height + 24;
    }

    // Strip Zola TOML and YAML frontmatter (handle BOM and whitespace)
    const rawMarkdown = (payload.raw_content || '').replace(
      /^\s*[\uFEFF]?(?:\+\+\+|---)[\s\S]*?(?:\+\+\+|---)\s*/,
      '',
    );
    // CapGlyph demo: only posts containing `capglyph:` opt into blob/bitmap path — keeps 100% backward compat.
    const capGlyphResolver = shouldEnableCapGlyphResolver(rawMarkdown)
      ? createCapGlyphImageResolver()
      : undefined;
    if (capGlyphResolver) void demoDirectImageA11y();
    const md = await createArticleMarkdown(rawMarkdown, {
      maxWidth: contentWidth,
      theme: {
        bodyFont: 'Noto Serif SC, serif',
        codeFont: 'monospace',
        textColor: '#332f29',
        headingColor: '#332f29',
        codeColor: '#8c765c',
        codeBgColor: '#ede4d3',
        quoteBorderColor: '#8c765c',
        quoteTextColor: '#7a7265',
        hrColor: '#e8dfd0',
        // The package defaults (rgba(15,15,25,.4) body, white .08 header) are
        // tuned for dark themes — on this paper palette they render as the
        // murky grey slab seen in review. Use the page's own tones instead.
        tableBgColor: '#f2e8d5',
        tableHeaderBgColor: '#e3d7c0',
        syntaxKeywordColor: '#a6423d',
        syntaxStringColor: '#4f7942',
        syntaxCommentColor: '#a39a86',
        syntaxNumberColor: '#b8860b',
        fontSize: isMobile ? 18 : 22,
      },
      blockAffordances: true,
      showCodeLanguage: true,
      onLinkClick: (url: string) => navigateTo(url),
      ...(capGlyphResolver ? { imageResolver: capGlyphResolver } : {}),
    });
    md.setPosition(0, detailY);
    page.add(md);
    detailY += md.height + 24;

    if (showDesktopToc) {
      const sidebar = new TocSidebar(toc, tocSidebarWidth, onTocNavigate);
      sidebar.setPosition(originX + contentWidth + 40, currentY + 40 + md.y);
      currentScene.add(sidebar);
    }

    // `payload.toc` is flattened in document order to build TOC rows (see
    // layoutTocRows), and headingEntities is recorded in that same document
    // order by TrackedMarkdown, so a row's flat index names the matching
    // heading entity directly.
    navigateToHeading.fn = (flatIndex: number) => {
      const heading = md.headingEntities[flatIndex];
      if (!heading || typeof window === 'undefined') return;
      // The heading's world Y already reflects the current scroll offset
      // (mainScroll.y === -window.scrollY), so its position in the
      // document's un-scrolled coordinate space is worldY + current scrollY.
      const worldY = heading.getWorldTransform().f;
      const documentY = worldY + window.scrollY;
      const headerClearance = 100;
      window.scrollTo({
        top: Math.max(0, documentY - headerClearance),
        behavior: 'smooth',
      });
    };

    // Prev/Next Navigation
    const navEntity = new Container();
    navEntity.setPosition(0, detailY);

    if (payload.navigation?.earlier) {
      const ear = payload.navigation.earlier;
      const prev = withWholeLineProjection(
        new RichText(
          [
            {
              text: `← ${ear.title}`,
              style: { color: '#8c765c', href: ear.url },
            },
          ],
          {
            font: '14px Noto Sans SC, sans-serif',
            onLinkClick: () => navigateTo(ear.url),
          },
        ),
      );
      prev.setPosition(0, 0);
      navEntity.add(prev);
    }

    if (payload.navigation?.later) {
      const lat = payload.navigation.later;
      const nextText = withWholeLineProjection(
        new RichText(
          [
            {
              text: `${lat.title} →`,
              style: { color: '#8c765c', href: lat.url },
            },
          ],
          {
            font: '14px Noto Sans SC, sans-serif',
            onLinkClick: () => navigateTo(lat.url),
          },
        ),
      );
      nextText.setPosition(contentWidth - nextText.width, 0);
      navEntity.add(nextText);
    }

    page.add(navEntity);
    detailY += 40;

    detailY += 20;
    const backBtn = withWholeLineProjection(
      new RichText([{ text: '← 返回列表', style: { color: '#8c765c', href: '/' } }], {
        font: '14px Noto Sans SC, sans-serif',
        onLinkClick: () => navigateTo('/'),
      }),
    );
    backBtn.setPosition(0, detailY);
    page.add(backBtn);

    detailY += backBtn.height + 40;
    page.height = detailY;

    const reflowBelowMd = () => {
      let nextY = md.y + md.height + 24;
      navEntity.setPosition(0, nextY);
      nextY += 40 + 20;
      backBtn.setPosition(0, nextY);
      nextY += backBtn.height + 40;

      page.height = nextY;
      if (footerContainer) {
        const footerY = page.height + 60;
        footerContainer.setPosition(0, footerY);
        page.height = footerY + 80;
      }

      if (typeof document !== 'undefined') {
        document.body.style.height = `${page.height}px`;
        mainScroll.height = page.height;
      }
      currentScene?.markDirty();
    };
    // `onLayoutUpdated` is the real hook. This used to assign `onHeightChanged`
    // through an `as unknown as` cast — a name that exists nowhere in VectoJS, so
    // the cast silenced the type error and the callback was never invoked. Every
    // post with an image was laid out against the 16:10 guess forever: nothing
    // below `md` ever moved, and `document.body.style.height` kept a stale value
    // so the page under-scrolled.
    md.onLayoutUpdated = reflowBelowMd;

    if (mobileToc) {
      mobileToc.onToggle = () => {
        md.setPosition(0, mobileToc.y + mobileToc.height + 24);
        reflowBelowMd();
      };
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footerY = page.height + 60;
  footerContainer = new Container();
  footerContainer.setPosition(0, footerY);

  const footerText = withWholeLineProjection(
    new Text(`© ${new Date().getFullYear()} Xuepoo. Crafted in VectoJS.`, {
      font: '12px Noto Sans SC, sans-serif',
      color: '#7a7265',
    }),
  );
  footerText.setPosition(0, 0);
  footerContainer.add(footerText);

  page.add(footerContainer);
  page.height = footerY + 80;

  // IMPORTANT: Set the document body height so native scrolling works
  if (typeof document !== 'undefined') {
    document.body.style.height = `${page.height}px`;
    mainScroll.height = page.height;
  }
  // Restore the scroll position. `scrollTo` to the same spot fires no scroll
  // event, so sync `mainScroll.y` manually — the scroll listener only runs on
  // real scrolls.
  if (typeof window !== 'undefined') {
    const maxScroll = Math.max(0, page.height - window.innerHeight);
    let target = prevScrollY;
    if (Math.abs(maxScrollY - maxScroll) > 1) {
      target = scrollRatio * maxScroll;
    }
    target = Math.min(target, maxScroll);
    if (Math.abs(window.scrollY - target) > 1) window.scrollTo(0, target);
    mainScroll.y = -window.scrollY;
  }

  currentScene.markDirty();
  // Force a synchronous render immediately to prevent canvas flickering during window resize.
  // This ensures the canvas pixel buffer is refilled in the same event loop task after
  // Scene.ts clears it via canvas.width = newWidth.
  currentScene.render(currentScene.getRenderer(), 0, performance.now());
}

// ─── View Tracking ────────────────────────────────────────────────────────────

async function loadViewCounts() {
  try {
    const res = await fetch('/api/views');
    if (res.ok) {
      const data = await res.json();
      for (const [slug, count] of Object.entries(data)) {
        viewsMap.set(slug, count as number);
      }
    }
  } catch (e) {
    console.error('Failed to load view counts', e);
  }
}

async function logCurrentPageView() {
  if (currentPageData?.data?.type === 'page') {
    const slug = currentPageData.data.slug;
    try {
      const url = `/api/views?slug=${encodeURIComponent(slug)}`;
      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.views === 'number') {
          viewsMap.set(slug, data.views);
        }
      }
    } catch (e) {
      console.error('Failed to log view', e);
    }
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('vecto-canvas') as HTMLCanvasElement;
  if (!canvas) return;

  // Enable mobile touch scrolling on the fixed canvas overlay
  let touchStartY = 0;
  canvas.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        touchStartY = e.touches[0].clientY;
      }
    },
    { passive: true },
  );

  canvas.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        const touchY = e.touches[0].clientY;
        const deltaY = touchStartY - touchY;
        touchStartY = touchY;
        window.scrollBy(0, deltaY);
      }
    },
    { passive: true },
  );

  currentScene = new Scene(canvas, { maxFPS: 60 });
  currentScene.renderMode = 'onDemand';
  currentScene.start();
  const scene = currentScene;

  // `?debug` inspection surface: dock the @vectojs/devtools panel and expose
  // the live Scene for headless audits (auditSceneSelection, inspectText…).
  // Lazy chunk — the panel never loads on a normal visit.
  if (typeof location !== 'undefined' && location.search.includes('debug')) {
    void import('@vectojs/devtools').then(({ attachDevtools }) => {
      attachDevtools(scene, {
        width: 320,
        refreshInterval: 0,
        defaultTab: 'tree',
      });
      (window as unknown as { __vectoScene?: Scene }).__vectoScene = scene;
    });
    // Headless model API for automated audits (auditSceneSelection & friends).
    void import('@vectojs/devtools/headless').then((headless) => {
      (window as unknown as { __vectoHeadless?: unknown }).__vectoHeadless = headless;
    });
  }

  window.dispatchEvent(new Event('resize'));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && searchDropdown && currentSearchMatches.length > 0) {
      navigateTo(currentSearchMatches[0].url);
    }
    // Intercept the browser's native find box — the page is one canvas, so
    // find-in-page runs inside the scene instead.
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'f') {
      e.preventDefault();
      closeSearchDropdown();
      findController.open();
    } else if (key === 'f3') {
      e.preventDefault();
      closeSearchDropdown();
      if (findController.isOpen) findController.next();
      else findController.open();
    } else if (key === 'escape' && findController.isOpen) {
      findController.close();
    }
  });

  const dataElement = document.getElementById('page-data');
  if (dataElement) {
    currentPageData = parsePageData(dataElement.textContent || '');
  }

  await loadViewCounts();
  await logCurrentPageView();

  await renderPage();

  let lastWidth = window.innerWidth;
  let resizeAnimationFrameId: number | null = null;

  // Use ResizeObserver for precise container tracking and Firefox Range recalibration.
  // ResizeObserver reports contentRect in CSS px, which correctly shrinks on browser
  // zoom (window.innerWidth also changes, but ResizeObserver is the reliable hook
  // for scene.resize() — the Firefox Range recalibration hook).
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      const newDpr = window.devicePixelRatio;

      // Width-only: layout must rebuild.
      // DPR-only (monitor move, emulation): backing store must rescale.
      // Height-only (mobile URL bar slide): just repaint.
      const widthChanged = Math.abs(width - lastWidth) > 0.5;
      const dprChanged = Math.abs(newDpr - lastDpr) > 0.001;

      if (widthChanged || dprChanged) {
        lastWidth = width;
        lastDpr = newDpr;

        // Resize the scene with current logical CSS px. This re-reads DPR, rescales
        // the backing store, and recalibrates Firefox's Range metrics.
        if (currentScene) {
          currentScene.resize(width, window.innerHeight);
          // Synchronous render prevents a black frame while the async rebuild is pending.
          currentScene.render(currentScene.getRenderer(), 0, performance.now());
        }

        // Debounce the full layout rebuild into the next rAF
        if (resizeAnimationFrameId === null) {
          resizeAnimationFrameId = requestAnimationFrame(() => {
            resizeAnimationFrameId = null;
            void renderPage();
          });
        }
      } else {
        // Height-only change (mobile URL bar): resize backing store but don't rebuild
        currentScene?.resize(width, height);
        currentScene?.markDirty();
      }
    }
  });

  resizeObserver.observe(canvas);

  // Epsilon-gated polling backstop for CDP device emulation, which switches DPR
  // without firing any browser events. The gate ignores float jitter (Chrome
  // reports 1.0999↔1.1000 at 110% zoom), which otherwise triggers infinite rebuilds.
  setInterval(() => {
    const newDpr = window.devicePixelRatio;
    if (Math.abs(newDpr - lastDpr) <= 0.001) return;
    lastDpr = newDpr;
    if (currentScene) {
      currentScene.resize(window.innerWidth, window.innerHeight);
      currentScene.render(currentScene.getRenderer(), 0, performance.now());
    }
    void renderPage();
  }, 1000);

  window.addEventListener('popstate', async () => {
    await handleUrlRoute(window.location.pathname);
  });

  if (typeof document !== 'undefined' && (document as any).fonts) {
    (document as any).fonts.ready.then(() => {
      void renderPage();
    });
  }
});

async function renderPage() {
  if (currentPageData) {
    await renderApp();
  }
}
