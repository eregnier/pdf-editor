import { describe, expect, it } from 'vitest';
import { createText, type ImageObject } from '../src/model/objects';
import {
  addObject,
  emptyScene,
  findObject,
  insertCopy,
  removeObject,
  updateObject,
} from '../src/model/scene';

const image = (x = 0, y = 0): ImageObject => ({
  id: 'image-1',
  kind: 'image',
  x,
  y,
  width: 100,
  height: 50,
  bytes: new Blob(['png']),
  url: 'blob:x',
});

describe('scene', () => {
  it('starts with one empty list per page', () => {
    expect(emptyScene(3)).toEqual([[], [], []]);
  });

  it('adds an object on the requested page only', () => {
    const scene = addObject(emptyScene(2), 1, image());
    expect(scene[0]).toEqual([]);
    expect(scene[1]).toHaveLength(1);
  });

  it('updates an object through the change callback', () => {
    const object = image();
    const scene = updateObject(addObject(emptyScene(1), 0, object), object.id, (current) => ({
      ...current,
      x: 42,
    }));
    expect(findObject(scene, object.id)?.object.x).toBe(42);
  });

  it('does not mutate the previous scene', () => {
    const before = addObject(emptyScene(1), 0, image());
    updateObject(before, 'image-1', (current) => ({ ...current, x: 99 }));
    expect(before[0]?.[0]?.x).toBe(0);
  });

  it('removes an object by id', () => {
    const object = createText(0, 0, 'Helvetica');
    expect(removeObject(addObject(emptyScene(1), 0, object), object.id)[0]).toEqual([]);
  });

  it('copies an object with a new id and an offset', () => {
    const object = image(10, 20);
    const inserted = insertCopy(addObject(emptyScene(1), 0, object), 0, object);
    expect(inserted?.scene[0]).toHaveLength(2);
    expect(inserted?.object.id).not.toBe(object.id);
    expect(inserted?.object).toMatchObject({ x: 20, y: 30 });
  });

  it('refuses to copy onto a page that does not exist', () => {
    expect(insertCopy(emptyScene(1), 5, image())).toBeNull();
  });

  it('keeps the kind of the copied object', () => {
    const text = createText(0, 0, 'Courier');
    const inserted = insertCopy(addObject(emptyScene(1), 0, text), 0, text);
    expect(inserted?.object.kind).toBe('text');
    expect(inserted?.object).toMatchObject({ font: 'Courier' });
  });
});
