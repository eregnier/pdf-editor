export interface ShortcutActions {
  copy(): void;
  duplicate(): void;
  remove(): void;
}

/**
 * Ctrl+C / Ctrl+D / Delete on the selection.
 * Keys are ignored while the focus is in an input, a select or an editable text
 * object, so native editing keeps working there. Paste is not handled here: it
 * goes through the `paste` event, which is the only way to reach the system
 * clipboard (an image) as well as the internal object clipboard.
 */
export function bindKeyboard(actions: ShortcutActions): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (
      target?.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    const withModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
    if (withModifier && key === 'c') actions.copy();
    else if (withModifier && key === 'd') actions.duplicate();
    else if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      (key === 'delete' || key === 'backspace')
    ) {
      actions.remove();
    } else return;
    event.preventDefault();
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
