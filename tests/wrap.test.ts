import { PDFDocument, StandardFonts } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import type { PDFFont } from 'pdf-lib';
import { wrapLines } from '../src/serializer/wrap';

let font: PDFFont;

beforeAll(async () => {
  const document = await PDFDocument.create();
  font = await document.embedFont(StandardFonts.Helvetica);
});

describe('wrapLines', () => {
  it('keeps a short text on one line', () => {
    expect(wrapLines('Bonjour', font, 12, 200)).toEqual(['Bonjour']);
  });

  it('breaks a long text on several lines within the width', () => {
    const lines = wrapLines('a '.repeat(60).trim(), font, 12, 100);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 12)).toBeLessThanOrEqual(100);
    }
  });

  it('keeps explicit newlines as separate lines', () => {
    expect(wrapLines('un\ndeux', font, 12, 200)).toEqual(['un', 'deux']);
  });

  it('does not loop forever on a single word wider than the box', () => {
    const lines = wrapLines('anticonstitutionnellement', font, 12, 10);
    expect(lines).toEqual(['anticonstitutionnellement']);
  });
});
