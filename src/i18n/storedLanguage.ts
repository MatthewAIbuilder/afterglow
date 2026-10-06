import { File, Paths } from 'expo-file-system';
import type { LanguageChoice } from './translate';

/**
 * The language chosen in Settings, kept in a tiny file so it can be read at
 * once as the app starts, before any screen draws (like the theme). Never
 * throws: no file, or anything unreadable, means "follow the phone".
 */
const NAME = 'language.json';

export function readStoredLanguage(): LanguageChoice | undefined {
  try {
    const f = new File(Paths.document, NAME);
    if (!f.exists) return undefined;
    const id = (JSON.parse(f.textSync()) as { id?: unknown }).id;
    return id === 'device' || id === 'en' || id === 'es' ? id : undefined;
  } catch {
    return undefined;
  }
}

export function writeStoredLanguage(id: LanguageChoice): boolean {
  try {
    const f = new File(Paths.document, NAME);
    if (!f.exists) f.create();
    f.write(JSON.stringify({ id }));
    return true;
  } catch {
    return false;
  }
}
