import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
} from 'pdf-lib';
import type { PdfSource } from '../model/pdf-source';
import type { ImageObject, TextFont, TextObject } from '../model/objects';
import type { Scene } from '../model/scene';
import { wrapLines } from './wrap';

const FONTS: Record<TextFont, StandardFonts> = {
  Helvetica: StandardFonts.Helvetica,
  'Times-Roman': StandardFonts.TimesRoman,
  Courier: StandardFonts.Courier,
};

/** Ratio of the font size that sits above the baseline, for the first line. */
const ASCENT = 0.8;

/**
 * Build the output document: the original pages plus every object drawn on top.
 * Object coordinates come from the top-left corner, pdf-lib wants them from the
 * bottom-left, hence the `pageHeight - …` flips.
 */
export async function exportPdf(source: PdfSource, scene: Scene): Promise<Blob> {
  const document = await PDFDocument.load(source.bytes);
  const fonts = new Map<TextFont, PDFFont>();
  const pages = document.getPages();

  for (const [index, objects] of scene.entries()) {
    const page = pages[index];
    if (!page) continue;
    const pageHeight = page.getHeight();
    for (const object of objects) {
      if (object.kind === 'image') {
        page.drawImage(await embedImage(document, object), {
          x: object.x,
          y: pageHeight - object.y - object.height,
          width: object.width,
          height: object.height,
        });
      } else if (object.kind === 'text') {
        await drawText(page, object, pageHeight, document, fonts);
      }
    }
  }
  const bytes = await document.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

async function drawText(
  page: ReturnType<PDFDocument['getPages']>[number],
  object: TextObject,
  pageHeight: number,
  document: PDFDocument,
  fonts: Map<TextFont, PDFFont>,
): Promise<void> {
  const font = await fontFor(document, fonts, object.font);
  const lines = wrapLines(object.text, font, object.size, object.width);
  const lineBox = object.size * object.lineHeight;
  const baselineShift = (lineBox - object.size) / 2 + object.size * ASCENT;
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: object.x,
      y: pageHeight - object.y - index * lineBox - baselineShift,
      size: object.size,
      font,
      color: rgb(0, 0, 0),
    });
  });
}

function embedImage(
  document: PDFDocument,
  object: ImageObject,
): Promise<PDFImage> {
  return object.bytes
    .arrayBuffer()
    .then((bytes) =>
      object.bytes.type === 'image/jpeg'
        ? document.embedJpg(bytes)
        : document.embedPng(bytes),
    );
}

function fontFor(
  document: PDFDocument,
  cache: Map<TextFont, PDFFont>,
  name: TextFont,
): Promise<PDFFont> {
  const cached = cache.get(name);
  if (cached) return Promise.resolve(cached);
  return document.embedFont(FONTS[name]).then((font) => {
    cache.set(name, font);
    return font;
  });
}
