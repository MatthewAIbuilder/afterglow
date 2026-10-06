/**
 * The pure part of languages: which language to use, and turning an English
 * line into that language. No React, no device calls, so it's easy to test.
 *
 * The English line itself is the key: `t('Settings')` looks up 'Settings' in
 * the Spanish list. Anything not in the list yet stays in English, so a screen
 * that isn't translated still works, just in English.
 */

/** The languages the app speaks. English is always the fallback. */
export type Language = 'en' | 'es';
/** What the person chose in Settings: follow the phone, or one language. */
export type LanguageChoice = 'device' | Language;

export const LANGUAGES: readonly { id: Language; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
];

export type Dictionary = Readonly<Record<string, string>>;
export type Vars = Readonly<Record<string, string | number>>;

export function isLanguage(x: unknown): x is Language {
  return x === 'en' || x === 'es';
}

/**
 * The language to use: a language chosen in Settings wins; otherwise the
 * first of the phone's languages the app speaks (so a phone set to Catalan
 * then Spanish gets Spanish); otherwise English.
 */
export function resolveLanguage(choice: LanguageChoice | undefined, deviceCodes: readonly (string | null | undefined)[]): Language {
  if (isLanguage(choice)) return choice;
  for (const code of deviceCodes) {
    const base = code?.toLowerCase().split(/[-_]/)[0];
    if (isLanguage(base)) return base;
  }
  return 'en';
}

/** Put `{name}` values into a line. Unknown names are left as they are. */
export function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** The line in the language (or the English line if there's no translation), with its values filled in. */
export function translate(dict: Dictionary | undefined, text: string, vars?: Vars): string {
  return fill(dict?.[text] || text, vars);
}

/** The `{name}` slots in a line, sorted, for checking a translation keeps every one. */
export function slots(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
}

const MONTHS: Record<Language, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
};
const MONTHS_SHORT: Record<Language, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
};
const WEEKDAYS: Record<Language, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
};
const WEEKDAYS_SHORT: Record<Language, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
};

/** Month names (0 = January), in the language. Spanish keeps them lower case, as Spanish does mid-sentence. */
export const monthNames = (lang: Language, short = false) => (short ? MONTHS_SHORT : MONTHS)[lang];
/** Day names (0 = Sunday), in the language. */
export const weekdayNames = (lang: Language, short = false) => (short ? WEEKDAYS_SHORT : WEEKDAYS)[lang];
