import { MIN_SIZE, type PdfObject, type TextObject } from '../model/objects';

const FONT_STACK: Record<TextObject['font'], string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  'Times-Roman': '"Times New Roman", Times, serif',
  Courier: '"Courier New", monospace',
};

/** Screen pixels of movement before a pointer press becomes a drag. */
const DRAG_THRESHOLD = 3;

const CORNERS = ['nw', 'ne', 'sw', 'se'] as const;
type Corner = (typeof CORNERS)[number];

export interface ObjectView {
  element: HTMLElement;
  /** Re-apply model state after a render: geometry, content, selection ring. */
  sync(object: PdfObject, selected: boolean): void;
}

export interface ObjectViewContext {
  /** Screen pixels per PDF point, i.e. the current overlay scale. */
  scale(): number;
  onSelect(id: string): void;
  onCommit(object: PdfObject): void;
  onDelete(id: string): void;
}

/**
 * One object on a page: a body (image or editable text), four resize handles and
 * a delete button. Drag and resize paint locally on every pointer move and only
 * report the final box, so the scene is not rebuilt at 60 fps.
 */
export function createObjectView(
  initial: PdfObject,
  context: ObjectViewContext,
): ObjectView {
  let current = initial;

  const element = document.createElement('div');
  element.className = 'object';
  const body = createBody(initial);
  element.append(body);

  for (const corner of CORNERS) {
    const handle = document.createElement('div');
    handle.className = `handle handle-${corner}`;
    handle.addEventListener('pointerdown', (event) => start(event, corner));
    element.append(handle);
  }

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'remove';
  removeButton.title = 'Supprimer';
  removeButton.textContent = '×';
  removeButton.addEventListener('click', () => context.onDelete(current.id));
  element.append(removeButton);

  element.addEventListener('pointerdown', (event) => {
    if ((event.target as HTMLElement).isContentEditable) return;
    start(event, 'move');
  });

  if (body instanceof HTMLElement && initial.kind === 'text') {
    body.addEventListener('dblclick', () => edit(body));
  }

  function start(event: PointerEvent, mode: 'move' | Corner): void {
    if (event.button !== 0) return;
    // No preventDefault here: cancelling pointerdown also cancels the
    // click/dblclick sequence, which is what opens the text editor.
    event.stopPropagation();
    context.onSelect(current.id);
    const pixelsPerPoint = context.scale();
    const pointer = { x: event.clientX, y: event.clientY };
    const origin = current;
    let dragging = false;
    const move = (moveEvent: PointerEvent) => {
      // Below the threshold it is a click, not a drag: keep the event flow
      // intact so a double click still reaches the text editor.
      if (!dragging) {
        if (Math.hypot(moveEvent.clientX - pointer.x, moveEvent.clientY - pointer.y) < DRAG_THRESHOLD) {
          return;
        }
        dragging = true;
        moveEvent.preventDefault();
      }
      const dx = (moveEvent.clientX - pointer.x) / pixelsPerPoint;
      const dy = (moveEvent.clientY - pointer.y) / pixelsPerPoint;
      current = mode === 'move' ? moved(origin, dx, dy) : resized(origin, mode, dx, dy);
      paint(current);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (current !== origin) context.onCommit(current);
    };
    // Window listeners instead of setPointerCapture: capturing retargets the
    // following mouse events to the wrapper, which kills the dblclick that opens
    // the text editor and the click on the delete button.
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Text objects are editable only while in edit mode, so dragging stays possible. */
  function edit(target: HTMLElement): void {
    if (target.isContentEditable) return;
    target.contentEditable = 'true';
    target.focus();
    window.getSelection()?.selectAllChildren(target);
    target.addEventListener(
      'blur',
      () => {
        target.contentEditable = 'false';
        if (current.kind !== 'text') return;
        current = {
          ...current,
          text: target.textContent ?? '',
          height: Math.max(MIN_SIZE, Math.ceil(target.scrollHeight)),
        };
        context.onCommit(current);
      },
      { once: true },
    );
  }

  function paint(object: PdfObject): void {
    element.style.left = `${object.x}px`;
    element.style.top = `${object.y}px`;
    element.style.width = `${object.width}px`;
    element.style.height = `${object.height}px`;
  }

  function sync(next: PdfObject, selected: boolean): void {
    current = next;
    paint(next);
    element.classList.toggle('selected', selected);
    if (next.kind === 'text' && body instanceof HTMLElement) {
      if (body.textContent !== next.text) body.textContent = next.text;
      body.style.font = `${next.size}px/${next.lineHeight} ${FONT_STACK[next.font]}`;
    }
  }

  paint(initial);
  return { element, sync };
}

function createBody(object: PdfObject): HTMLElement {
  if (object.kind === 'image') {
    const image = document.createElement('img');
    image.src = object.url;
    image.alt = '';
    image.draggable = false;
    return image;
  }
  const text = document.createElement('div');
  text.className = 'text';
  text.textContent = object.text;
  text.style.font = `${object.size}px/${object.lineHeight} ${FONT_STACK[object.font]}`;
  return text;
}

function moved(origin: PdfObject, dx: number, dy: number): PdfObject {
  return { ...origin, x: origin.x + dx, y: origin.y + dy };
}

function resized(origin: PdfObject, corner: Corner, dx: number, dy: number): PdfObject {
  const west = corner === 'nw' || corner === 'sw';
  const north = corner === 'nw' || corner === 'ne';
  const width = Math.max(MIN_SIZE, origin.width + (west ? -dx : dx));
  // Images keep their ratio: a stretched photo is never what the user wants.
  const height =
    origin.kind === 'image'
      ? (width * origin.height) / origin.width
      : Math.max(MIN_SIZE, origin.height + (north ? -dy : dy));
  return {
    ...origin,
    x: west ? origin.x + origin.width - width : origin.x,
    y: north ? origin.y + origin.height - height : origin.y,
    width,
    height,
  };
}
