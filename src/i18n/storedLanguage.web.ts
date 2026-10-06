import type { LanguageChoice } from './translate';

/** The website keeps the language choice in the browser's own storage (read at once as the page starts). */
const KEY = 'afterglow.language';

export function readStoredLanguage(): LanguageChoice | undefined {
  try {
    const id = globalThis.localStorage?.getItem(KEY);
    return id === 'device' || id === 'en' || id === 'es' ? id : undefined;
  } catch {
    return undefined;
  }
}

export function writeStoredLanguage(id: LanguageChoice): boolean {
  try {
    globalThis.localStorage?.setItem(KEY, id);
    return true;
  } catch {
    return false;
  }
}
