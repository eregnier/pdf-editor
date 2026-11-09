import type { ImageObject } from '../model/objects';

/** Biggest side of a freshly placed image, in points. */
const MAX_SIDE = 400;

/**
 * Turn a picked file into a scene object. pdf-lib only embeds jpeg and png, so
 * anything else is re-encoded through a canvas first; the placed box is capped
 * so a phone photo does not cover the whole page.
 */
export async function importImage(file: File): Promise<ImageObject> {
  const bytes = await toEmbeddable(file);
  const url = URL.createObjectURL(bytes);
  const { width, height } = await imageSize(url);
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  return {
    id: crypto.randomUUID(),
    kind: 'image',
    x: 0,
    y: 0,
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    bytes,
    url,
  };
}

async function toEmbeddable(file: File): Promise<Blob> {
  if (file.type === 'image/jpeg' || file.type === 'image/png') return file;
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

function imageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Image illisible'));
    image.src = url;
  });
}
