import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { es } from '../es';
import { fill, monthNames, resolveLanguage, slots, translate, weekdayNames } from '../translate';

describe('choosing the language', () => {
  it('follows the phone unless a language was chosen', () => {
    expect(resolveLanguage(undefined, ['es-MX', 'en-US'])).toBe('es');
    expect(resolveLanguage('device', ['es_ES'])).toBe('es');
    expect(resolveLanguage('en', ['es-MX'])).toBe('en');
    expect(resolveLanguage('es', ['en-GB'])).toBe('es');
  });
  it('takes the first phone language the app speaks, else English', () => {
    expect(resolveLanguage(undefined, ['ca-ES', 'es-ES', 'en'])).toBe('es');
    expect(resolveLanguage(undefined, ['fr-FR', 'de'])).toBe('en');
    expect(resolveLanguage(undefined, [])).toBe('en');
    expect(resolveLanguage(undefined, [null, undefined, ''])).toBe('en');
  });
});

describe('translating a line', () => {
  it('uses the translation, or the English when there is none', () => {
    expect(translate({ Hello: 'Hola' }, 'Hello')).toBe('Hola');
    expect(translate({ Hello: 'Hola' }, 'Goodbye')).toBe('Goodbye');
    expect(translate(undefined, 'Hello')).toBe('Hello');
  });
  it('fills slots, in whatever order the language puts them', () => {
    expect(translate(es, '{month} {day1} to {day2}', { month: 'oct', day1: 9, day2: 11 })).toBe('9 al 11 de oct');
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and {b}');
  });
  it('has twelve months and seven days in each language', () => {
    for (const lang of ['en', 'es'] as const) {
      expect(monthNames(lang)).toHaveLength(12);
      expect(monthNames(lang, true)).toHaveLength(12);
      expect(weekdayNames(lang)).toHaveLength(7);
      expect(weekdayNames(lang, true)).toHaveLength(7);
    }
  });
});

/** Every English line the app passes to t() or tn() as written text. */
function linesInCode(): { line: string; file: string }[] {
  const root = join(__dirname, '..', '..');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return name === '__tests__' || name === 'i18n' ? [] : walk(p);
      return /\.tsx?$/.test(name) ? [p] : [];
    });
  const str = String.raw`'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"`;
  const one = new RegExp(String.raw`\bt\(\s*(${str})`, 'g');
  const two = new RegExp(String.raw`\btn\([^,]+,\s*(${str})\s*,\s*(${str})`, 'g');
  const withContext = new RegExp(String.raw`\btc\(\s*(${str})\s*,\s*(${str})`, 'g');
  const unquote = (s: string) => JSON.parse(s.startsWith("'") ? `"${s.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"` : s) as string;
  return walk(root).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    if (!/\/i18n['"]/.test(text)) return [];

    const found = [...text.matchAll(one)].map((m) => m[1]);
    for (const m of text.matchAll(two)) found.push(m[1], m[2]);
    // tc('time', 'Leave') looks up 'time|Leave'.
    for (const m of text.matchAll(withContext)) found.push(JSON.stringify(`${unquote(m[1])}|${unquote(m[2])}`));
    return found.map((s) => ({ line: unquote(s), file: file.slice(root.length + 1) }));
  });
}

describe('outside the app', () => {
  it('loads no phone module up front (the website’s nightly scripts run app logic in Node)', () => {
    const src = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');
    expect(src).not.toMatch(/^import [^;]*from '(react-native|expo[^']*)'/m);
    expect(src).not.toMatch(/^import [^;]*from '\.\/storedLanguage'/m);
    expect(src).not.toMatch(/^export [^;]*from '\.\/storedLanguage'/m);
  });
});

describe('the Spanish list', () => {

  const lines = linesInCode();

  it('finds the lines the app translates', () => {
    expect(lines.length).toBeGreaterThan(100);
  });

  it('has every line the code translates', () => {
    const missing = [...new Set(lines.filter((l) => !es[l.line]).map((l) => `${l.file}: ${l.line}`))];
    expect(missing).toEqual([]);
  });

  it('has the plain line too for every line with a context (other languages fall back to it)', () => {
    const plain = Object.keys(es).filter((k) => k.includes('|')).map((k) => k.slice(k.indexOf('|') + 1));
    expect(plain.filter((k) => !es[k])).toEqual([]);
  });

  it('keeps every slot of every line', () => {
    const broken = Object.entries(es).filter(([en, tr]) => slots(en).join() !== slots(tr).join());
    expect(broken).toEqual([]);
  });

  it('has no empty translations', () => {
    expect(Object.entries(es).filter(([, tr]) => !tr.trim())).toEqual([]);
  });
});
