import type { CatalogSnapshot } from './models';
import { parseCatalogFile } from './file';
import { type Built, buildCatalog } from './merge';

/**
 * Keeping the catalogue up to date from a hosted file (CATALOG_URL). A plain
 * static JSON file anywhere on the web is enough: no server, no account.
 *
 * On start the app shows what it has straight away, then:
 * 1. the last good copy it saved, if any (works offline);
 * 2. a fresh copy from the link, which it saves if it's good.
 * A missing, broken or unreachable file never replaces good data. Pure: the
 * network and the storage are passed in, so this is tested without either.
 */
export type TextStore = { get: () => Promise<string | null>; set: (text: string) => Promise<void> };
export type FetchText = (url: string) => Promise<string>;

/** Only secure links, so nobody on the network can swap the file. */
export const isCatalogUrl = (url: string) => /^https:\/\/[^\s]+$/i.test(url.trim());

/** Largest file we'll read (about 2 MB), so a wrong link can't flood the app. */
export const MAX_FILE_CHARS = 2_000_000;

export type RemoteOptions = {
  url: string;
  /** What the file is added to (or replaces): the built-in data. */
  base: CatalogSnapshot;
  fetchText: FetchText;
  store: TextStore;
  /** Called with each good catalogue, in order: saved copy, then fresh copy. */
  onCatalog: (built: Built, from: 'saved' | 'online') => void;
  /** Called with the problems of every file read, good or not, for the developer console. */
  onProblems?: (problems: string[], from: 'saved' | 'online') => void;
};

export async function refreshCatalog({ url, base, fetchText, store, onCatalog, onProblems }: RemoteOptions) {
  if (!isCatalogUrl(url)) {
    onProblems?.(['The catalogue link must start with https://, so it was not used.'], 'online');
    return;
  }
  const apply = (text: string, from: 'saved' | 'online') => {
    if (text.length > MAX_FILE_CHARS) {
      onProblems?.(['The catalogue file is too large to read.'], from);
      return false;
    }
    const built = buildCatalog(base, parseCatalogFile(text));
    if (built.problems.length) onProblems?.(built.problems, from);
    if (built.usedFile) onCatalog(built, from);
    return built.usedFile;
  };

  let saved: string | null = null;
  try {
    saved = await store.get();
  } catch {}
  if (saved) apply(saved, 'saved');

  let fresh: string;
  try {
    fresh = await fetchText(url.trim());
  } catch {
    return; // Offline or unreachable: keep what we have.
  }
  if (fresh === saved) return;
  if (apply(fresh, 'online')) {
    try {
      await store.set(fresh);
    } catch {}
  }
}
