import { type Entity, type Scene } from '@vectojs/core';
import { Card, Text } from '@vectojs/ui';

/**
 * Floating toolbar that appears next to a text selection. Selection lives on
 * the DOM carriers the content projection emits, so the selected text and its
 * bounding rect come from `window.getSelection()` — viewport coordinates that
 * match scene space one-to-one because the canvas is fixed and fullscreen.
 *
 * Like the context menu, the bar is re-mounted after every `renderApp()`
 * rebuild: SPA navigation clears the scene root and would orphan it.
 */

const BAR_WIDTH = 132;
const BAR_HEIGHT = 34;

/** Find-in-page matches exact substrings of a single text line, so a
 * multi-line selection would never match: query with its first line only,
 * whitespace-collapsed and capped. */
function toFindQuery(text: string): string {
  const firstLine = text
    .split('\n')
    .map((s) => s.trim())
    .find(Boolean);
  return (firstLine ?? text).replace(/\s+/g, ' ').slice(0, 40);
}

export interface SelectionToolbarActions {
  openFind: (query: string) => void;
}

function childrenOf(entity: Entity): Entity[] {
  return (entity as unknown as { children?: Entity[] }).children ?? [];
}

export class SelectionToolbar {
  private scene: Scene | null = null;
  private bar: Card | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly actions: SelectionToolbarActions;

  constructor(actions: SelectionToolbarActions) {
    this.actions = actions;
    this.wireDocumentEvents();
  }

  /** Re-attach to (re)built scenes. Idempotent; hides any stale bar first. */
  mount(scene: Scene): void {
    this.scene = scene;
    this.hide();
  }

  private wireDocumentEvents(): void {
    document.addEventListener('pointerup', (e) => {
      if (e.button !== 0) return;
      // Let the native selection settle after the pointer is released.
      setTimeout(() => this.syncToSelection(), 0);
    });
    // Hide on clicks OUTSIDE the bar only: an unconditional hide here would
    // destroy the bar during the pointerdown of its own buttons' activation.
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.bar) return;
        const t = this.bar.getWorldTransform();
        const x = e.clientX;
        const y = e.clientY;
        const inside = x >= t.e && x <= t.e + BAR_WIDTH && y >= t.f && y <= t.f + BAR_HEIGHT;
        if (!inside) this.hide();
      },
      true,
    );
    window.addEventListener('scroll', () => this.hide(), { passive: true });
    window.addEventListener('resize', () => this.hide());
  }

  private syncToSelection(): void {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';
    if (!selection || selection.isCollapsed || !text || !this.scene) {
      this.hide();
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.hide();
      return;
    }
    this.show(rect.right + 8, rect.top - BAR_HEIGHT - 8, text);
  }

  private show(x: number, y: number, text: string): void {
    if (!this.scene) return;
    this.destroyBar();

    const clampedX = Math.max(8, Math.min(x, window.innerWidth - BAR_WIDTH - 8));
    const clampedY = Math.max(8, Math.min(y, window.innerHeight - BAR_HEIGHT - 8));

    const bar = new Card({
      width: BAR_WIDTH,
      height: BAR_HEIGHT,
      bg: '#f4ecdb',
      border: '#d9cdb8',
      radius: 4,
    });
    bar.setPosition(clampedX, clampedY);

    const copyBtn = this.makeButton(bar, '复制', 0);
    const findBtn = this.makeButton(bar, '查找', 62);

    copyBtn.on('click', () => {
      void navigator.clipboard.writeText(text).then(() => {
        this.flashCopied(copyBtn);
      });
    });
    findBtn.on('click', () => {
      this.hide();
      this.actions.openFind(toFindQuery(text));
    });

    this.bar = bar;
    this.scene.overlayRoot.add(bar);
    this.scene.markDirty();
  }

  private makeButton(bar: Card, label: string, offsetX: number): Card {
    // `label` makes the Card interactive and projects it as an accessible
    // button — without it the a11y tree skips decorative cards entirely.
    const btn = new Card({
      width: 56,
      height: 24,
      bg: '#ede4d3',
      border: '#e8dfd0',
      radius: 3,
      label,
    });
    btn.setPosition(6 + offsetX, 5);
    btn.add(
      new Text(label, {
        font: '12px Noto Sans SC, sans-serif',
        color: '#332f29',
      }),
    );
    bar.add(btn);
    return btn;
  }

  private flashCopied(btn: Card): void {
    const labelEntity = childrenOf(btn as unknown as Entity)[0];
    if (labelEntity instanceof Text) {
      labelEntity.setText('已复制');
      this.scene?.markDirty();
    }
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), 900);
  }

  private destroyBar(): void {
    if (!this.bar) return;
    try {
      this.bar.destroy();
    } catch {
      // already removed by a scene rebuild
    }
    this.bar = null;
  }

  hide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.destroyBar();
    this.scene?.markDirty();
  }
}
