import { File, Paths } from 'expo-file-system';

/**
 * Which theme the app wears, kept in a tiny file so it can be read at once
 * as the app starts, before any screen draws (AsyncStorage answers too late
 * for colours that are fixed when each screen's styles are made). Never
 * throws: no file, or anything unreadable, means the default.
 */
const NAME = 'theme.json';

export function readStoredTheme(): string | undefined {
  try {
    const f = new File(Paths.document, NAME);
    if (!f.exists) return undefined;
    const id = (JSON.parse(f.textSync()) as { id?: unknown }).id;
    return typeof id === 'string' ? id : undefined;
  } catch {
    return undefined;
  }
}

export function writeStoredTheme(id: string): boolean {
  try {
    const f = new File(Paths.document, NAME);
    if (!f.exists) f.create();
    f.write(JSON.stringify({ id }));
    return true;
  } catch {
    return false;
  }
}

/** Whether Liquid Glass is on (App theme page; off unless chosen), kept the same way so it's known before any screen draws. */
const GLASS_NAME = 'glass.json';

export function readStoredGlass(): boolean {
  try {
    const f = new File(Paths.document, GLASS_NAME);
    if (!f.exists) return false;
    return (JSON.parse(f.textSync()) as { on?: unknown }).on === true;
  } catch {
    return false;
  }
}

export function writeStoredGlass(on: boolean): boolean {
  try {
    const f = new File(Paths.document, GLASS_NAME);
    if (!f.exists) f.create();
    f.write(JSON.stringify({ on }));
    return true;
  } catch {
    return false;
  }
}
