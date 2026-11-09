import { describe, expect, it } from 'vitest';
import { LANGUAGES, t } from '../src/i18n';
import fr from '../src/i18n/fr.json';

const keys = Object.keys(fr).sort();

describe('translations', () => {
  it('ships the main languages', () => {
    expect(LANGUAGES.map((language) => language.code)).toEqual([
      'fr',
      'en',
      'es',
      'de',
      'it',
      'pt',
    ]);
  });

  it('has every reference key in every language', () => {
    for (const language of LANGUAGES) {
      expect(Object.keys(language.dictionary).sort(), language.code).toEqual(keys);
    }
  });

  it('has no empty translation', () => {
    for (const language of LANGUAGES) {
      for (const [key, value] of Object.entries(language.dictionary)) {
        expect(value.trim(), `${language.code} ${key}`).not.toBe('');
      }
    }
  });

  it('keeps the same placeholders in every language', () => {
    const placeholders = (value: string): string[] =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
    for (const key of keys) {
      const expected = placeholders(fr[key as keyof typeof fr]);
      for (const language of LANGUAGES) {
        expect(placeholders(language.dictionary[key] ?? ''), `${language.code} ${key}`).toEqual(
          expected,
        );
      }
    }
  });
});

describe('t', () => {
  it('renders the key when it is unknown', () => {
    expect(t('nope.missing')).toBe('nope.missing');
  });

  it('interpolates values', () => {
    expect(t('status.pdfOpened', { count: 12 })).toContain('12');
  });

  it('falls back to the plain english text when no value is given', () => {
    expect(t('status.pdfOpened')).toContain('{count}');
  });
});
