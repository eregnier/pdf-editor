import type { PdfDocumentSource } from '../model/pdf-document';
import type { PdfObject } from '../model/objects';
import type { Scene } from '../model/scene';
import { createObjectView, type ObjectView } from './object-view';

export interface Spot {
  page: number;
  /** Point inside that page, in PDF points, currently on screen. */
  x: number;
  y: number;
}

export interface PagesView {
  render(scene: Scene, selectedId: string | null): void;
  /** Where a new object should land: on the visible page, in the visible area. */
  visibleSpot(): Spot;
}

export interface PagesViewOptions {
  onSelect(id: string | null): void;
  onCommit(object: PdfObject): void;
  onDelete(id: string): void;
}

interface PageEntry {
  frame: HTMLElement;
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
  width: number;
  height: number;
  views: Map<string, ObjectView>;
}

/** Gap, in points, between a newly placed object and the visible area corner. */
const INSET = 16;

/** How far outside the viewport a page is rasterised ahead of scrolling. */
const PRELOAD = '150% 0px';

/**
 * Build one frame per PDF page and rasterise a page only when it approaches the
 * viewport. Rendering every page at once is what used to blow up memory and CPU
 * on large documents. The overlay holds the objects, in PDF points, scaled by a
 * CSS transform so drag maths stays in document units.
 */
export async function createPagesView(
  host: HTMLElement,
  source: PdfDocumentSource,
  options: PagesViewOptions,
): Promise<PagesView> {
  const sizes = await Promise.all(
    Array.from({ length: source.pageCount }, async (_, index) => {
      const page = await source.page(index);
      const viewport = page.getViewport({ scale: 1 });
      return { width: viewport.width, height: viewport.height };
    }),
  );

  host.replaceChildren();
  const entries: PageEntry[] = sizes.map((size, index) => {
    const frame = document.createElement('div');
    frame.className = 'frame';
    // Reserve the page box before rasterising, so scrolling never jumps.
    frame.style.aspectRatio = `${size.width} / ${size.height}`;

    const canvas = document.createElement('canvas');
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.width = `${size.width}px`;
    overlay.style.height = `${size.height}px`;
    frame.append(canvas, overlay);

    const section = document.createElement('section');
    section.className = 'page';
    section.dataset.page = String(index);
    section.append(frame);
    host.append(section);

    frame.addEventListener('pointerdown', (event) => {
      if (event.target === frame || event.target === canvas) options.onSelect(null);
    });

    return { frame, canvas, overlay, width: size.width, height: size.height, views: new Map() };
  });

  const observer = new IntersectionObserver(
    (observed) => {
      for (const entry of observed) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const index = Number((entry.target as HTMLElement).dataset.page);
        const page = entries[index];
        if (page) void rasterise(page, index);
      }
    },
    { rootMargin: PRELOAD },
  );
  entries.forEach((entry, index) => {
    const section = host.children[index];
    if (section) observer.observe(section);
  });

  // shortcut: a page is rasterised once at its first display width, so a later
  // zoom or window resize only scales the bitmap; re-render on resize if the
  // blur becomes visible.
  async function rasterise(entry: PageEntry, index: number): Promise<void> {
    const page = await source.page(index);
    // Cap the pixel density: 4K screens do not need more than 2x for a preview.
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const scale = (entry.frame.clientWidth / entry.width || 1) * density;
    const viewport = page.getViewport({ scale });
    entry.canvas.width = Math.round(viewport.width);
    entry.canvas.height = Math.round(viewport.height);
    await page.render({ canvas: entry.canvas, viewport }).promise;
  }

  /** Overlay is laid out in points; one transform maps it to the frame width. */
  function rescale(): void {
    for (const entry of entries) {
      const pixelsPerPoint = entry.frame.clientWidth / entry.width;
      entry.overlay.style.transform = `scale(${pixelsPerPoint})`;
    }
  }
  new ResizeObserver(rescale).observe(host);
  rescale();

  function render(scene: Scene, selectedId: string | null): void {
    entries.forEach((entry, index) => {
      const objects = scene[index] ?? [];
      const seen = new Set<string>();
      for (const object of objects) {
        seen.add(object.id);
        let view = entry.views.get(object.id);
        if (!view) {
          view = createObjectView(object, {
            scale: () => entry.frame.clientWidth / entry.width || 1,
            onSelect: options.onSelect,
            onCommit: options.onCommit,
            onDelete: options.onDelete,
          });
          entry.views.set(object.id, view);
          entry.overlay.append(view.element);
          // Whatever the scroll state, a brand new object must be visible now.
          if (object.id === selectedId) ensureVisible(view.element);
        }
        view.sync(object, object.id === selectedId);
      }
      for (const [id, view] of entry.views) {
        if (seen.has(id)) continue;
        view.element.remove();
        entry.views.delete(id);
      }
    });
  }

  function ensureVisible(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const onScreen =
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth;
    if (onScreen) return;
    element.scrollIntoView({ block: 'center', inline: 'center' });
  }

  // Most visible page wins, and the spot is its top-left corner clipped to the
  // viewport: an object dropped at the page origin would land off-screen as soon
  // as the user is scrolled inside the page.
  function visibleSpot(): Spot {
    const viewportHeight = window.innerHeight;
    let best = 0;
    let bestOverlap = 0;
    entries.forEach((entry, index) => {
      const rect = entry.frame.getBoundingClientRect();
      const overlap = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = index;
      }
    });
    const entry = entries[best];
    if (!entry) return { page: 0, x: 0, y: 0 };
    const rect = entry.frame.getBoundingClientRect();
    const pixelsPerPoint = rect.width / entry.width || 1;
    const inset = INSET / pixelsPerPoint;
    return {
      page: best,
      x: Math.max(0, inset),
      y: Math.max(0, (Math.max(rect.top, 0) - rect.top) / pixelsPerPoint + inset),
    };
  }

  return { render, visibleSpot };
}
