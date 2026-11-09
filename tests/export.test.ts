import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { createText } from '../src/model/objects';
import type { PdfSource } from '../src/model/pdf-source';
import { addObject, emptyScene } from '../src/model/scene';
import { exportPdf } from '../src/serializer/export';

/** 1x1 transparent png, enough to exercise the image embedding path. */
const PIXEL = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wD/AL0AAAAASUVORK5CYII=',
  ),
  (char) => char.charCodeAt(0),
);

async function blankSource(pageCount: number): Promise<PdfSource> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) document.addPage([595, 842]);
  const bytes = await document.save();
  return {
    name: 'entree.pdf',
    bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    pageCount,
    page: () => Promise.reject(new Error('rendu inutile dans ce test')),
  };
}

describe('exportPdf', () => {
  it('keeps the pages of the source document', async () => {
    const source = await blankSource(2);
    const blob = await exportPdf(source, emptyScene(2));
    const output = await PDFDocument.load(await blob.arrayBuffer());
    expect(output.getPageCount()).toBe(2);
    expect(blob.type).toBe('application/pdf');
  });

  it('draws text and images without touching the other pages', async () => {
    const source = await blankSource(2);
    const text = createText(10, 20, 'Helvetica');
    let scene = addObject(emptyScene(2), 0, text);
    scene = addObject(scene, 1, {
      id: 'pixel',
      kind: 'image',
      x: 5,
      y: 5,
      width: 20,
      height: 20,
      bytes: new Blob([PIXEL], { type: 'image/png' }),
      url: 'blob:pixel',
    });

    const blob = await exportPdf(source, scene);
    const output = await PDFDocument.load(await blob.arrayBuffer());
    expect(output.getPageCount()).toBe(2);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('produces a document pdf readers can open', async () => {
    const source = await blankSource(1);
    const blob = await exportPdf(source, emptyScene(1));
    const header = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5));
    expect(header).toBe('%PDF-');
  });
});
