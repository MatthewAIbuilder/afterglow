import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';
import { es } from './es';
import { readStoredLanguage } from './storedLanguage';
import { monthNames, resolveLanguage, translate, weekdayNames, type Dictionary, type Language, type LanguageChoice, type Vars } from './translate';

export { LANGUAGES, type Language, type LanguageChoice } from './translate';
export { writeStoredLanguage } from './storedLanguage';

function deviceCodes(): string[] {
  try {
    return getLocales().map((l) => l.languageTag || l.languageCode || '');
  } catch {
    return [];
  }
}

/** What was chosen in Settings ('device' when nothing was). */
export const LANGUAGE_CHOICE: LanguageChoice = readStoredLanguage() ?? 'device';
/**
 * The language the app speaks, worked out once as it starts (from Settings,
 * else the phone's languages). Changing it in Settings restarts the app, like
 * a new theme, so every screen and every line made at start-up follows.
 */
export const LANGUAGE: Language = resolveLanguage(LANGUAGE_CHOICE, deviceCodes());
/** For `toLocaleString` and friends. */
export const LOCALE = LANGUAGE === 'es' ? 'es' : 'en-US';

const DICTIONARIES: Partial<Record<Language, Dictionary>> = { es };

if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = LANGUAGE;

/**
 * A line in the app's language: write the English, get it back translated
 * (or as it is, when there's no translation yet). `{name}` slots are filled
 * from `vars`: t('{n} friends going', { n: 3 }).
 */
export function t(english: string, vars?: Vars): string {
  return translate(DICTIONARIES[LANGUAGE], english, vars);
}

/** One or many: tn(n, '{n} reply', '{n} replies'). Both lines go in the dictionary. */
export function tn(n: number, one: string, other: string, vars?: Vars): string {
  return t(n === 1 ? one : other, { n, ...vars });
}

/** Month names (0 = January) in the app's language. */
export const months = (short = false) => monthNames(LANGUAGE, short);
/** Day names (0 = Sunday) in the app's language. */
export const weekdays = (short = false) => weekdayNames(LANGUAGE, short);
