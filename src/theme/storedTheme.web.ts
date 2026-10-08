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

/** Whether Liquid Glass is on (App theme page; off unless chosen). */
const GLASS_KEY = 'afterglow.glass';

export function readStoredGlass(): boolean {
  try {
    return globalThis.localStorage?.getItem(GLASS_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeStoredGlass(on: boolean): boolean {
  try {
    globalThis.localStorage?.setItem(GLASS_KEY, on ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}
