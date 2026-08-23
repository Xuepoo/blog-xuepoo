import type { Entity, Scene } from '@vectojs/core';
import { ContextMenu, type ContextMenuItem } from '@vectojs/ui';

/**
 * Right-click surface for the canvas-native blog. The page is one `<canvas>`,
 * so the browser's default context menu ("Save image as…") is meaningless here:
 * we suppress it and project an in-scene `@vectojs/ui` ContextMenu instead,
 * with items that depend on what the pointer hit (link / text selection /
 * anywhere) — resolved via `Scene.findEntityAt` and the a11y attributes of the
 * hit chain, never via screenshots or DOM queries.
 */

interface LinkInfo {
  href: string;
  target?: string;
}

type A11yLike = { tag?: string; href?: string; target?: string };

export interface CanvasMenuActions {
  navigateTo: (url: string) => void;
  focusSearch: () => void;
  openFind: (query?: string) => void;
}

/** Walk up from the hit entity looking for a projected link (`tag: 'a'`). */
function linkAtPoint(scene: Scene, x: number, y: number): LinkInfo | null {
  let entity: Entity | null = scene.findEntityAt(x, y);
  let depth = 0;
  while (entity && depth < 12) {
    const attrs = (
      entity as unknown as { getA11yAttributes?: () => A11yLike | null }
    ).getA11yAttributes?.();
    if (attrs && attrs.tag === 'a' && attrs.href) {
      return { href: attrs.href, target: attrs.target };
    }
    entity = (entity as unknown as { parent?: Entity | null }).parent ?? null;
    depth++;
  }
  return null;
}

function absoluteUrl(href: string): string {
  try {
    return new URL(href, window.location.origin).toString();
  } catch {
    return href;
  }
}

function truncate(text: string, max = 12): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function buildItems(
  selection: string,
  link: LinkInfo | null,
  actions: CanvasMenuActions,
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  if (link) {
    items.push(
      { label: '打开链接', onClick: () => actions.navigateTo(link.href) },
      {
        label: '在新标签页打开',
        onClick: () => window.open(link.href, '_blank', 'noopener'),
      },
      {
        label: '复制链接地址',
        onClick: () => void navigator.clipboard.writeText(absoluteUrl(link.href)),
      },
      { separator: true },
    );
  }

  if (selection) {
    const text = selection;
    items.push(
      {
        label: '复制',
        shortcut: 'Ctrl+C',
        onClick: () => void navigator.clipboard.writeText(text),
      },
      {
        label: `页内查找“${truncate(text)}”`,
        onClick: () => actions.openFind(text),
      },
      { separator: true },
    );
  }

  items.push(
    {
      label: '回到顶部',
      icon: '↑',
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    { label: '回首页', onClick: () => actions.navigateTo('/') },
    { label: '搜索文章', shortcut: '/', onClick: () => actions.focusSearch() },
    {
      label: '页内查找',
      shortcut: 'Ctrl+F',
      onClick: () => actions.openFind(),
    },
  );

  return items;
}

/**
 * Suppress the native context menu and open a scene-projected one on
 * right-click. Listens on `window`, not the canvas: the content projection's
 * selectable carrier elements sit above the canvas, so a right-click over any
 * text targets them and never reaches a canvas-level listener. Inputs are
 * exempt — their shadow `<input>` keeps the native menu so copy/paste works.
 *
 * Opened from the `contextmenu` event — not `pointerdown` — because the whole
 * gesture (down/up/menu) has finished by then: a menu built mid-gesture sees
 * the trailing pointerup as an outside click and closes itself instantly.
 * Like the menu itself, instances are per-invocation because `renderApp()`
 * clears the scene root on SPA navigation.
 */
export function installCanvasContextMenu(
  getScene: () => Scene | null,
  actions: CanvasMenuActions,
): void {
  let activeMenu: ContextMenu | null = null;

  window.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    e.preventDefault();
    const scene = getScene();
    if (!scene) return;

    const selection = window.getSelection()?.toString().trim() ?? '';
    const link = linkAtPoint(scene, e.clientX, e.clientY);
    const items = buildItems(selection, link, actions);

    if (activeMenu) {
      try {
        activeMenu.destroy();
      } catch {
        // already torn down by a previous hide/backdrop click
      }
      activeMenu = null;
    }
    activeMenu = new ContextMenu({ items, width: 220 });
    // Overlay root, per the component's own conformance tests: the overlay
    // layer sits above scrolling content and owns viewport-fixed interaction —
    // a root-mounted menu's backdrop mirror intercepts item clicks.
    scene.overlayRoot.add(activeMenu);
    activeMenu.showAtPoint(e.clientX, e.clientY);
    scene.markDirty();
  });
}
