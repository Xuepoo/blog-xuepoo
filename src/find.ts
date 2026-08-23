import { Entity, getSharedMeasuringContext, type IRenderer, type Scene } from '@vectojs/core';
import { Card, Input, Text } from '@vectojs/ui';
import { withWholeLineProjection } from './text-utils';

/**
 * In-canvas find-in-page (Ctrl/Cmd+F). The native browser find box is
 * suppressed (`preventDefault` on the keydown) and this bar takes over:
 *
 * - matches are located through each text entity's public
 *   `getContentProjection()` (visual lines with canvas x/y), using the same
 *   shared measuring context the framework itself uses for per-glyph math;
 * - highlight rects are drawn by per-entity overlay children, so they scroll
 *   with their text;
 * - Enter / Shift+Enter / F3 cycle matches, Esc closes, and the current match
 *   is scrolled to with the same header-clearance math as the TOC.
 */

interface FindRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FindMatch {
  entity: Entity;
  rect: FindRect;
  /** Index of `rect` within its entity's highlight list (drives the "current" style). */
  rectIndex: number;
}

interface LineInfo {
  text: string;
  x: number;
  y: number;
  font?: string;
  lineHeight?: number;
}

function projectionLines(entity: Entity): LineInfo[] | null {
  const projection = (
    entity as unknown as { getContentProjection?: () => unknown }
  ).getContentProjection?.();
  if (!projection) return null;
  const lines = (projection as { lines?: Array<Record<string, unknown>> }).lines;
  if (!Array.isArray(lines) || lines.length === 0) return null;
  return lines.map((line) => ({
    text: String(line.text ?? ''),
    x: Number(line.x ?? 0),
    y: Number(line.y ?? 0),
    font: typeof line.font === 'string' ? line.font : undefined,
    lineHeight: typeof line.lineHeight === 'number' ? line.lineHeight : undefined,
  }));
}

/** BFS the subtree for entities that project searchable text (Text / RichText). */
export function collectSearchable(root: Entity): Entity[] {
  const out: Entity[] = [];
  const stack = [...(root.children ?? [])];
  while (stack.length > 0) {
    const entity = stack.pop()!;
    if (projectionLines(entity)) out.push(entity);
    const children = (entity as { children?: Entity[] }).children;
    if (children) stack.push(...children);
  }
  return out;
}

/** One overlay rect batch per entity, drawn above its glyphs. */
class FindHighlight extends Entity {
  public rects: FindRect[] = [];
  public current = -1;

  public isPointInside(_globalX: number, _globalY: number): boolean {
    return false;
  }

  public render(r: IRenderer): void {
    for (let i = 0; i < this.rects.length; i++) {
      const rect = this.rects[i];
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      r.save();
      r.beginPath();
      r.roundRect(rect.x, rect.y, rect.width, rect.height, 2);
      r.fill(i === this.current ? 'rgba(166, 66, 61, 0.5)' : 'rgba(140, 118, 92, 0.22)');
      r.restore();
    }
  }
}

export class FindController {
  private scene: Scene | null = null;
  private root: Entity | null = null;
  private bar: Entity | null = null;
  private input: Input | null = null;
  private counter: Text | null = null;
  private matches: FindMatch[] = [];
  private current = -1;
  private highlights = new Map<Entity, FindHighlight>();
  private measuringContext = getSharedMeasuringContext();

  /** Called on every `renderApp` so stale matches/highlights never outlive a page build. */
  public reset(): void {
    this.clearHighlights();
    this.matches = [];
    this.current = -1;
    this.updateCounter();
  }

  /** Attach to the current scene + document root (the scrolled content). */
  public attach(scene: Scene, root: Entity): void {
    this.scene = scene;
    this.root = root;
  }

  public get isOpen(): boolean {
    return this.bar !== null;
  }

  public open(query?: string): void {
    if (!this.scene) return;
    if (!this.bar) this.buildBar();
    if (this.bar && !this.bar.scene) this.scene.add(this.bar);
    if (query && this.input) {
      this.input.value = query;
    }
    this.runFind(this.input?.value ?? '');
    // Focus the projected shadow input after the a11y layer materializes it.
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll('input');
      inputs[inputs.length - 1]?.focus();
    });
  }
  public next(): void {
    if (this.matches.length === 0) return;
    this.goToMatch((this.current + 1) % this.matches.length);
  }

  public prev(): void {
    if (this.matches.length === 0) return;
    this.goToMatch((this.current - 1 + this.matches.length) % this.matches.length);
  }

  public close(): void {
    if (!this.bar) return;
    this.scene?.remove(this.bar);
    this.bar = null;
    this.input = null;
    this.counter = null;
    this.reset();
  }

  private buildBar(): void {
    const contentWidth = Math.min(920, window.innerWidth - 40);
    const originX = (window.innerWidth - contentWidth) / 2;
    const barWidth = 304;

    const bar = new Card({
      width: barWidth,
      height: 40,
      bg: '#ede4d3',
      border: '#e8dfd0',
      radius: 6,
      label: '站内查找',
    });
    bar.setPosition(originX + contentWidth - barWidth, 10);
    bar.interactive = true;

    const input = new Input({
      width: 158,
      height: 30,
      placeholder: '查找...',
      font: '13px Noto Sans SC, sans-serif',
      onChange: (value: string) => this.runFind(value),
    });
    input.setPosition(8, 5);
    input.on('keydown', (e: { nativeEvent?: KeyboardEvent }) => {
      const key = e.nativeEvent?.key;
      if (key === 'Enter') {
        if (e.nativeEvent?.shiftKey) this.prev();
        else this.next();
      } else if (key === 'Escape') {
        this.close();
      }
    });
    bar.add(input);
    const makeButton = (glyph: string, x: number, onClick: () => void) => {
      const button = withWholeLineProjection(
        new Text(glyph, {
          font: '16px Noto Sans SC, sans-serif',
          color: '#8c765c',
        }),
      );
      button.setPosition(x, 9);
      button.interactive = true;
      button.on('click', onClick);
      bar.add(button);
    };
    const counter = withWholeLineProjection(
      new Text('0/0', {
        font: '11px Noto Sans SC, sans-serif',
        color: '#7a7265',
      }),
    );
    counter.setPosition(174, 13);
    bar.add(counter);
    makeButton('‹', 206, () => this.prev());
    makeButton('›', 230, () => this.next());
    makeButton('×', 264, () => this.close());

    this.bar = bar;
    this.input = input;
    this.counter = counter;
  }

  private runFind(query: string): void {
    this.clearHighlights();
    this.matches = [];
    this.current = -1;

    const needle = query.trim().toLowerCase();
    if (needle && this.root) {
      const entities = collectSearchable(this.root);
      const found = findInEntities(entities, needle, this.measuringContext);
      this.matches = found.slice(0, 1000);

      // Group matches by entity so one highlight overlay covers each text block.
      const byEntity = new Map<Entity, FindMatch[]>();
      for (const match of this.matches) {
        const list = byEntity.get(match.entity) ?? [];
        list.push(match);
        byEntity.set(match.entity, list);
      }
      for (const [entity, list] of byEntity) {
        const highlight = new FindHighlight();
        highlight.rects = list.map((match) => match.rect);
        list.forEach((match, index) => {
          match.rectIndex = index;
        });
        entity.add(highlight);
        this.highlights.set(entity, highlight);
      }
      if (this.matches.length > 0) this.goToMatch(0);
    }
    this.updateCounter();
  }

  private goToMatch(index: number): void {
    this.current = index;
    const match = this.matches[index];
    for (const [entity, highlight] of this.highlights) {
      highlight.current = match && match.entity === entity ? match.rectIndex : -1;
    }
    // World Y is recomputed at navigation time so late layout reflows
    // (markdown images, font swap) still land on the right line.
    const transform = match?.entity.getWorldTransform();
    const documentY = transform && match ? transform.f + match.rect.y + window.scrollY : 0;
    const headerClearance = 90;
    window.scrollTo({
      top: Math.max(0, documentY - headerClearance),
      behavior: 'smooth',
    });
    this.scene?.markDirty();
    this.updateCounter();
  }

  private updateCounter(): void {
    const total = this.matches.length;
    const label = total === 0 ? '0/0' : `${this.current + 1}/${total}`;
    if (this.counter) this.counter.setText(label);
  }

  private clearHighlights(): void {
    for (const [entity, highlight] of this.highlights) {
      entity.remove(highlight);
      highlight.destroy?.();
    }
    this.highlights.clear();
  }
}

/** Find all case-insensitive substring matches inside the projected text lines. */
function findInEntities(
  entities: Entity[],
  needle: string,
  measuringContext: CanvasRenderingContext2D | null,
): FindMatch[] {
  const out: FindMatch[] = [];
  for (const entity of entities) {
    const lines = projectionLines(entity);
    if (!lines) continue;
    for (const line of lines) {
      const haystack = line.text.toLowerCase();
      let index = haystack.indexOf(needle);
      while (index !== -1) {
        let startX = 0;
        let width = 0;
        if (measuringContext) {
          measuringContext.font = line.font ?? '16px sans-serif';
          startX = measuringContext.measureText(line.text.slice(0, index)).width;
          width =
            measuringContext.measureText(line.text.slice(0, index + needle.length)).width - startX;
        }
        out.push({
          entity,
          rect: {
            x: line.x + startX,
            y: line.y,
            width: Math.max(2, width),
            height: line.lineHeight ?? 20,
          },
          rectIndex: 0,
        });
        index = haystack.indexOf(needle, index + 1);
      }
    }
  }
  return out;
}
