import { chooseLanguage, LANGUAGES, language } from '../i18n';

/**
 * Flag button in the top right corner and the list of supported languages under
 * it. Picking one stores the choice and reloads the page, so nothing else in the
 * app has to care about language changes.
 */
export function mountLanguageMenu(toggle: HTMLButtonElement, menu: HTMLElement): void {
  toggle.textContent = language().flag;
  toggle.title = toggle.getAttribute('aria-label') ?? '';

  const build = (): void => {
    menu.replaceChildren(
      ...LANGUAGES.map((item) => {
        const entry = document.createElement('button');
        entry.type = 'button';
        entry.className = 'language-item';
        entry.setAttribute('role', 'option');
        entry.setAttribute('aria-selected', String(item.code === language().code));
        entry.textContent = `${item.flag} ${item.label}`;
        entry.addEventListener('click', () => chooseLanguage(item.code));
        return entry;
      }),
    );
  };

  const close = (): void => {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    if (menu.hidden) build();
    menu.hidden = !menu.hidden;
    toggle.setAttribute('aria-expanded', String(!menu.hidden));
  });

  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node;
    if (!menu.hidden && !menu.contains(target) && target !== toggle) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) close();
  });
}
