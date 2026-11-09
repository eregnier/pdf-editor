import { describe, expect, it } from 'vitest';
import {
  clampFontSize,
  createText,
  DEFAULT_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
} from '../src/model/objects';

describe('createText', () => {
  it('uses the default font size when none is given', () => {
    const text = createText(0, 0, 'Helvetica');
    expect(text.size).toBe(DEFAULT_FONT_SIZE);
    expect(text.height).toBe(Math.round(DEFAULT_FONT_SIZE * text.lineHeight));
  });

  it('keeps the requested font size and grows the box with it', () => {
    const text = createText(0, 0, 'Courier', 42);
    expect(text.size).toBe(42);
    expect(text.height).toBe(Math.round(42 * text.lineHeight));
  });
});

describe('clampFontSize', () => {
  it('bounds the size to the supported range', () => {
    expect(clampFontSize(1)).toBe(MIN_FONT_SIZE);
    expect(clampFontSize(9999)).toBe(MAX_FONT_SIZE);
  });

  it('rounds and falls back on garbage input', () => {
    expect(clampFontSize(18.6)).toBe(19);
    expect(clampFontSize(Number.NaN)).toBe(DEFAULT_FONT_SIZE);
  });
});
