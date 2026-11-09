import './app.css';
import { openPdf, type PdfDocumentSource } from './model/pdf-document';
import {
  clampFontSize,
  createRectangle,
  createText,
  DEFAULT_FONT_SIZE,
  MIN_SIZE,
  type PdfObject,
  type TextFont,
} from './model/objects';
import {
  addObject,
  emptyScene,
  findObject,
  insertCopy,
  removeObject,
  updateObject,
  type Scene,
} from './model/scene';
import { importImage } from './controller/import-image';
import { bindKeyboard } from './controller/keyboard';
import { createPagesView, type PagesView } from './view/pages-view';
import { exportPdf } from './serializer/export';

const ui = {
  pages: element<HTMLElement>('pages'),
  hint: element<HTMLElement>('hint'),
  name: element<HTMLElement>('pdf-name'),
  filePdf: element<HTMLInputElement>('file-pdf'),
  fileImage: element<HTMLInputElement>('file-image'),
  labelImage: element<HTMLElement>('label-image'),
  addText: element<HTMLButtonElement>('add-text'),
  addRectangle: element<HTMLButtonElement>('add-rectangle'),
  font: element<HTMLSelectElement>('font'),
  size: element<HTMLInputElement>('size'),
  save: element<HTMLButtonElement>('save'),
  status: element<HTMLElement>('status'),
};

let source: PdfDocumentSource | null = null;
let scene: Scene = [];
let selectedId: string | null = null;
/** Internal clipboard: objects are live payloads (blob + url), not text. */
let clipboard: PdfObject | null = null;
let view: PagesView | null = null;
let saving = false;
let statusTimer = 0;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Élément #${id} absent du document`);
  return found as T;
}

async function open(file: File): Promise<void> {
  source = await openPdf(file);
  scene = emptyScene(source.pageCount);
  selectedId = null;
  clipboard = null;
  ui.name.textContent = source.name;
  ui.hint.hidden = true;
  status(`PDF ouvert : ${source.pageCount} page(s)`);
  ui.labelImage.setAttribute('aria-disabled', 'false');
  for (const control of [ui.addText, ui.addRectangle, ui.font, ui.size, ui.save]) {
    control.disabled = false;
  }
  view = await createPagesView(ui.pages, source, {
    onSelect: select,
    onCommit: commit,
    onDelete: remove,
    onDuplicate: duplicate,
  });
  render();
}

/**
 * One line of feedback in the toolbar. Every import reports what it did — or why
 * it did nothing — so a silent no-op is never the only outcome.
 */
function status(message: string, failed = false): void {
  ui.status.textContent = message;
  ui.status.classList.toggle('failed', failed);
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    ui.status.textContent = '';
  }, 6000);
}

function render(): void {
  view?.render(scene, selectedId);
}

function select(id: string | null): void {
  selectedId = id;
  const located = id ? findObject(scene, id) : undefined;
  // Keep the size picker in sync with the text object being edited.
  if (located?.object.kind === 'text') {
    ui.size.value = String(located.object.size);
  }
  render();
}

/**
 * Font size applies to the selected text object, and becomes the default for the
 * next one. The box is scaled with it so the text is neither clipped nor left
 * with a huge empty area.
 */
function setFontSize(raw: string): void {
  const size = clampFontSize(Number(raw));
  ui.size.value = String(size);
  const located = selectedId ? findObject(scene, selectedId) : undefined;
  if (located?.object.kind !== 'text' || located.object.size === size) return;
  const text = located.object;
  commit({
    ...text,
    size,
    height: Math.max(MIN_SIZE, Math.round((text.height * size) / text.size)),
  });
}

function commit(object: PdfObject): void {
  scene = updateObject(scene, object.id, () => object);
  render();
}

/** Same behaviour as Ctrl+D, shared by the shortcut and the object button. */
function duplicate(id: string | null): void {
  const located = id ? findObject(scene, id) : undefined;
  if (!located) return;
  const inserted = insertCopy(scene, located.page, located.object);
  if (!inserted) return;
  scene = inserted.scene;
  selectedId = inserted.object.id;
  render();
}

function remove(id: string): void {
  scene = removeObject(scene, id);
  if (selectedId === id) selectedId = null;
  render();
}

/**
 * Every creation path lands where the user is looking, not at the page origin.
 * Returns false when there is no document: an orphan object would be invisible
 * and silently lost.
 */
function addToVisiblePage(object: PdfObject): boolean {
  if (!view) return false;
  const spot = view.visibleSpot();
  const placed = { ...object, x: spot.x, y: spot.y } as PdfObject;
  scene = addObject(scene, spot.page, placed);
  selectedId = placed.id;
  render();
  return true;
}

async function save(): Promise<void> {
  if (!source || saving) return;
  saving = true;
  ui.save.textContent = 'Enregistrement…';
  try {
    const blob = await exportPdf(source, scene);
    download(blob, source.name);
    status(`PDF exporté (${Math.round(blob.size / 1024)} Ko)`);
  } catch (error) {
    console.error(error);
    status("L'export a échoué", true);
  } finally {
    saving = false;
    ui.save.textContent = 'Enregistrer';
  }
}

/** Local download through a temporary blob URL: no library, no network. */
function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/\.pdf$/i, '')}-edite.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

ui.filePdf.addEventListener('change', () => {
  const file = ui.filePdf.files?.[0];
  if (file) void open(file);
});

ui.fileImage.addEventListener('change', () => {
  const file = ui.fileImage.files?.[0];
  ui.fileImage.value = '';
  if (file) void addImageFile(file);
});

// A dismissed or failed native dialog fires `cancel` and nothing else: without
// this the click looks like it did nothing at all.
ui.fileImage.addEventListener('cancel', () => {
  status("Sélection d'image annulée — glisse le fichier dans la fenêtre", true);
});

/**
 * Image import never fails silently: a rejected decode (heic, corrupted file) or
 * an unreadable format must show up in the console and in the hint, otherwise
 * "the button does nothing" is impossible to diagnose.
 */
async function addImageFile(file: File): Promise<void> {
  status(`Import de ${file.name}…`);
  try {
    const image = await importImage(file);
    if (!addToVisiblePage(image)) {
      status("Ouvre un PDF avant d'ajouter une image", true);
      return;
    }
    status(`Image ajoutée : ${Math.round(image.width)}×${Math.round(image.height)} pt`);
  } catch (error) {
    console.error('Import image impossible', file.name, file.type, error);
    status(`Import impossible : ${file.type || file.name}`, true);
  }
}



ui.addText.addEventListener('click', () => {
  addToVisiblePage(
    createText(24, 24, ui.font.value as TextFont, Number(ui.size.value) || DEFAULT_FONT_SIZE),
  );
});

ui.addRectangle.addEventListener('click', () => {
  addToVisiblePage(createRectangle(24, 24));
});

ui.size.addEventListener('change', () => setFontSize(ui.size.value));

ui.save.addEventListener('click', () => void save());

// Ctrl+V: an image in the system clipboard wins (screenshot, copied picture),
// otherwise the internal object clipboard is pasted. The `paste` event is used
// instead of keydown because it is the only access to clipboard images.
window.addEventListener('paste', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.isContentEditable || target instanceof HTMLInputElement) return;
  const image = [...(event.clipboardData?.files ?? [])].find((file) =>
    file.type.startsWith('image/'),
  );
  if (image) {
    event.preventDefault();
    void addImageFile(image);
    return;
  }
  if (!clipboard) return;
  event.preventDefault();
  const inserted = insertCopy(scene, view?.visibleSpot().page ?? 0, clipboard);
  if (!inserted) return;
  scene = inserted.scene;
  selectedId = inserted.object.id;
  render();
});

window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files[0];
  if (file?.type === 'application/pdf') void open(file);
  else if (file?.type.startsWith('image/')) void addImageFile(file);
});

bindKeyboard({
  copy() {
    const located = selectedId ? findObject(scene, selectedId) : undefined;
    if (located) clipboard = located.object;
  },
  duplicate() {
    duplicate(selectedId);
  },
  remove() {
    if (selectedId) remove(selectedId);
  },
});
