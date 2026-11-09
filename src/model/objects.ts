/**
 * What the user can put on a page: exactly two shapes, an image and a text box.
 * Both are described by a top-left box in PDF points (y grows downwards, like
 * the screen), which is the only contract shared by the scene, the view and the
 * exporter. Plain data, no behaviour, so scene logic stays pure and testable.
 */
export type TextFont = 'Helvetica' | 'Times-Roman' | 'Courier';

export interface BaseObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageObject extends BaseObject {
  kind: 'image';
  /** Bytes embedded at export time; always jpeg or png, see import-image. */
  bytes: Blob;
  /** Object URL of those bytes, display only. */
  url: string;
}

export interface TextObject extends BaseObject {
  kind: 'text';
  text: string;
  size: number;
  lineHeight: number;
  font: TextFont;
}

export type PdfObject = ImageObject | TextObject;

/** Smallest box a user can resize an object to, in points. */
export const MIN_SIZE = 8;

const TEXT_WIDTH = 180;
const TEXT_SIZE = 16;
const TEXT_LINE_HEIGHT = 1.4;

export function createText(x: number, y: number, font: TextFont): TextObject {
  return {
    id: crypto.randomUUID(),
    kind: 'text',
    x,
    y,
    width: TEXT_WIDTH,
    height: Math.round(TEXT_SIZE * TEXT_LINE_HEIGHT),
    text: 'Texte',
    size: TEXT_SIZE,
    lineHeight: TEXT_LINE_HEIGHT,
    font,
  };
}
