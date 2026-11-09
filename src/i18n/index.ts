import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import it from './it.json';
import pt from './pt.json';

/**
 * Flat dictionaries: keys are "section.name", values plain strings, so a file
 * can be edited without touching code and a missing key shows up as the key.
 *
 * There is no live language switching: the choice is stored and the page is
 * reloaded, which keeps every label (including the ones built in JS) in sync
 * for free.
 */
export type Dictionary = Record<string, string>;

export interface Language {
  code: string;
  label: string;
  flag: string;
  dictionary: Dictionary;
}

export const LANGUAGES: Language[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷', dictionary: fr },
  { code: 'en', label: 'English', flag: '🇬🇧', dictionary: en },
  { code: 'es', label: 'Español', flag: '🇪🇸', dictionary: es },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', dictionary: de },
  { code: 'it', label: 'Italiano', flag: '🇮🇹', dictionary: it },
  { code: 'pt', label: 'Português', flag: '🇵🇹', dictionary: pt },
];

const FALLBACK = 'en';
const STORAGE_KEY = 'pdf-editor.language';

const current = detect();

export function language(): Language {
  return current;
}

/** Translate one key, replacing {placeholders}. Unknown keys render as-is. */
export function t(key: string, values: Record<string, string | number> = {}): string {
  const template = current.dictionary[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in values ? String(values[name]) : `{${name}}`,
  );
}

/** Store the choice and reload: no translation pass to keep in sync. */
export function chooseLanguage(code: string): void {
  if (code === current.code) return;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, code);
  } catch {
    /* storage disabled: the choice will not survive the reload */
  }
  location.reload();
}

/**
 * Translate the static markup once, at startup. Elements opt in with
 * `data-i18n="key"` (text) or `data-i18n-title="key"` (tooltip + aria-label).
 */
export function applyLanguage(root: ParentNode): void {
  document.documentElement.lang = current.code;
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n ?? '');
  }
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    const label = t(element.dataset.i18nTitle ?? '');
    element.title = label;
    element.setAttribute('aria-label', label);
  }
}

/**
 * Explicit choice first, then the browser preferences. `fr-CA` maps to `fr`, so
 * two letters are enough; an unsupported browser language falls back to English.
 */
function detect(): Language {
  const preferred = [read(), ...browserLanguages()].filter(Boolean) as string[];
  for (const candidate of preferred) {
    const match = LANGUAGES.find((item) => item.code === candidate.slice(0, 2).toLowerCase());
    if (match) return match;
  }
  return LANGUAGES.find((item) => item.code === FALLBACK) ?? LANGUAGES[0]!;
}

function browserLanguages(): string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? [...navigator.languages] : [navigator.language];
}

function read(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}
