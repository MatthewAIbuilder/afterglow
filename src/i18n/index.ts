import { es } from './es';
import { monthNames, resolveLanguage, translate, weekdayNames, type Dictionary, type Language, type LanguageChoice, type Vars } from './translate';

export { LANGUAGES, type Language, type LanguageChoice } from './translate';

/**
 * What the phone says, read without importing the phone's modules up front:
 * the website's nightly scripts run some of the app's plain logic in Node,
 * where React Native can't load, and there everything is simply English.
 */
function fromPhone(): { choice?: LanguageChoice; codes: string[] } {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    const { readStoredLanguage } = require('./storedLanguage') as typeof import('./storedLanguage');
    /* eslint-enable @typescript-eslint/no-require-imports */
    let codes: string[] = [];
    try {
      codes = getLocales().map((l) => l.languageTag || l.languageCode || '');
    } catch {}
    return { choice: readStoredLanguage(), codes };
  } catch {
    return { codes: [] };
  }
}
const phone = fromPhone();

/** What was chosen in Settings ('device' when nothing was). */
export const LANGUAGE_CHOICE: LanguageChoice = phone.choice ?? 'device';
/**
 * The language the app speaks, worked out once as it starts (from Settings,
 * else the phone's languages). Changing it in Settings restarts the app, like
 * a new theme, so every screen and every line made at start-up follows.
 */
export const LANGUAGE: Language = resolveLanguage(LANGUAGE_CHOICE, phone.codes);
/** For `toLocaleString` and friends. */
export const LOCALE = LANGUAGE === 'es' ? 'es' : 'en-US';

const DICTIONARIES: Partial<Record<Language, Dictionary>> = { es };

// The website: tell the browser (and screen readers) which language the page is in.
if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = LANGUAGE;

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

/**
 * A catalogue day name ('Saturday') for the middle of a sentence: Spanish
 * writes day names in lower case there ("para el sábado"). Use `t(day)` at
 * the start of a line or as a heading.
 */
export function dayWord(day: string): string {
  const said = t(day);
  return LANGUAGE === 'es' && said !== day ? said.toLowerCase() : said;
}

/**
 * The same English word with two meanings, told apart for other languages:
 * tc('time', 'Leave') is "Leave" in English, and the Spanish list's entry for
 * 'time|Leave' ("Salida", a leaving time) rather than plain 'Leave' ("Salir").
 */
export function tc(context: string, english: string, vars?: Vars): string {
  const dict = DICTIONARIES[LANGUAGE];
  return translate(dict?.[`${context}|${english}`] ? { [english]: dict[`${context}|${english}`] } : dict, english, vars);
}
