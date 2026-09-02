import { Image } from '@vectojs/ui';
import type { ImageSource } from '@vectojs/ui';
import type { MarkdownImageResolver } from '@vectojs/markdown';

/**
 * Whether a markdown `src` is a CapGlyph virtual id.
 * Demo convention: `capglyph:cg_demo` etc — the adapter owns the scheme.
 */
export function isCapGlyphSrc(src: string): boolean {
  return src.startsWith('capglyph:');
}

/**
 * Fake derived-asset fetch — placeholder for `@capglyph/sdk-js` `LocalClient.verify`.
 *
 * Currently fetches the site's own favicon and returns its blob so the demo
 * exercises the `blob`/`bitmap` path without a real CapGlyph service.
 *
 * Swap the body with:
 * ```ts
 * import { LocalClient } from '@capglyph/sdk-js';
 * const client = new LocalClient({ endpoint: '...' });
 * const { blob } = await client.verify(capglyphId);
 * ```
 * when the SDK is wired — the resolver below does not need to change.
 */
export async function fetchCapGlyphBlob(src: string): Promise<Blob> {
  const id = src.slice('capglyph:'.length) || 'cg_demo';
  void id;
  try {
    const res = await fetch('/favicon.svg');
    if (!res.ok) throw new Error(`fetch favicon failed: ${res.status}`);
    return await res.blob();
  } catch {
    return new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'], {
      type: 'image/svg+xml',
    });
  }
}

/**
 * App-layer `imageResolver` required by the prompt: `capglyph:` → `ImageSource`.
 *
 * - `capglyph:*` → `{kind:'bitmap'}` via `createImageBitmap` when available, else `{kind:'blob'}`.
 * - otherwise → `{kind:'url', url: src}` (preserves historic `new Image(src)` path).
 *
 * The package stays free of CapGlyph — the adapter lives here, not in `@vectojs/*`.
 * Returning a `Promise` is supported; the paragraph image keeps a guessed box until
 * the resolver settles and then reflows as if the bitmap had just decoded.
 */
export const createCapGlyphImageResolver =
  (): MarkdownImageResolver =>
  async (src: string): Promise<ImageSource> => {
    if (!isCapGlyphSrc(src)) return { kind: 'url', url: src };
    const blob = await fetchCapGlyphBlob(src);
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(blob);
        return { kind: 'bitmap', bitmap };
      } catch {
        // Fall through to blob path — Image decodes via createImageBitmap internally.
      }
    }
    return { kind: 'blob', blob };
  };

/**
 * Whether the markdown body opts into the CapGlyph resolver.
 * Checked in `src/index.ts` before injecting — keeps existing posts untouched.
 */
export function shouldEnableCapGlyphResolver(rawMarkdown: string): boolean {
  return rawMarkdown.includes('capglyph:');
}

/**
 * Direct `ImageSource` a11y projection demo — logs `getA11yAttributes()` for:
 * - `new Image('/favicon.svg')` (url → `<img src alt>`)
 * - `new Image({kind:'blob', blob}, {alt, semanticMode:'auto'})` (blob → `<div role="img" aria-label>`)
 * - `new Image('/favicon.svg', {semanticMode:'role'})` (forced role)
 *
 * Call once when the demo article is visible to make the contrast observable in console / devtools.
 */
export async function demoDirectImageA11y(): Promise<void> {
  try {
    const urlImage = new Image('/favicon.svg', {
      width: 120,
      height: 120,
      alt: 'Demo URL — projects as <img>',
      semanticMode: 'auto',
    });
    const blob = await fetchCapGlyphBlob('capglyph:cg_demo');
    const blobImage = new Image(
      { kind: 'blob', blob },
      {
        width: 120,
        height: 120,
        alt: 'Demo Blob — projects as role=img',
        semanticMode: 'auto',
      },
    );
    const roleImage = new Image('/favicon.svg', {
      width: 120,
      height: 120,
      alt: 'Demo Role — forced role projection',
      semanticMode: 'role',
    });

    console.info('[capglyph-demo] ImageSource a11y projection contrast:');
    console.info('  url (auto)  →', urlImage.getA11yAttributes());
    console.info('  blob (auto) →', blobImage.getA11yAttributes());
    console.info('  url (role)  →', roleImage.getA11yAttributes());
    console.info(
      '[capglyph-demo] Hint: swap fetchCapGlyphBlob body with @capglyph/sdk-js LocalClient.verify to use real CapGlyph assets.',
    );
  } catch (err) {
    console.warn('[capglyph-demo] demoDirectImageA11y failed', err);
  }
}
