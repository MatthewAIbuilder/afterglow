/** The website keeps the theme in the browser's own storage (read at once as the page starts). */
const KEY = 'afterglow.theme';

export function readStoredTheme(): string | undefined {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeStoredTheme(id: string): boolean {
  try {
    globalThis.localStorage?.setItem(KEY, id);
    return true;
  } catch {
    return false;
  }
}
