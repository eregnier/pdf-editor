import type { PdfObject } from './objects';

/**
 * The scene is the list of objects laid over each page: `scene[page]` holds the
 * objects of that page. Every function here is pure and returns a new scene, so
 * the view can re-render by identity and the logic is testable without a DOM.
 */
export type Scene = PdfObject[][];

export const emptyScene = (pageCount: number): Scene =>
  Array.from({ length: pageCount }, () => []);

export interface Located {
  page: number;
  object: PdfObject;
}

export function findObject(scene: Scene, id: string): Located | undefined {
  for (const [page, objects] of scene.entries()) {
    const object = objects.find((candidate) => candidate.id === id);
    if (object) return { page, object };
  }
  return undefined;
}

export function addObject(scene: Scene, page: number, object: PdfObject): Scene {
  return scene.map((objects, index) =>
    index === page ? [...objects, object] : objects,
  );
}

/** `change` returns the new version of the object; the id never changes. */
export function updateObject(
  scene: Scene,
  id: string,
  change: (object: PdfObject) => PdfObject,
): Scene {
  return scene.map((objects) =>
    objects.map((object) => (object.id === id ? change(object) : object)),
  );
}

export function removeObject(scene: Scene, id: string): Scene {
  return scene.map((objects) => objects.filter((object) => object.id !== id));
}

export interface Inserted {
  scene: Scene;
  object: PdfObject;
}

/**
 * Insert a copy of `object` on `page`, shifted so it never hides its source.
 * Duplicate and paste both go through here: the clipboard is just a detached
 * object, so pasting is inserting a copy of it.
 */
export function insertCopy(
  scene: Scene,
  page: number,
  object: PdfObject,
  offset = 10,
): Inserted | null {
  if (!scene[page]) return null;
  // The spread keeps the discriminated union intact; the cast is just TS not
  // tracking that id stays a string.
  const copy = {
    ...object,
    id: crypto.randomUUID(),
    x: object.x + offset,
    y: object.y + offset,
  } as PdfObject;
  return { scene: addObject(scene, page, copy), object: copy };
}
