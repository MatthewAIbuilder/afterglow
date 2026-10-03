import type { Catalog } from '../../data/catalog';
import type { ParsedFile } from '../../data/file';
import type { Drop, DropStatus } from '../social/models';

/**
 * The HQ inbox, pure: the words for an upload's state, the message that
 * hands an upload to a Claude Code session (with links it can open), and a
 * summary of a catalogue update pasted back.
 */

export const DROP_STATUS_LABEL: Record<DropStatus, string> = { waiting: 'Waiting', sent: 'With Claude', done: 'Done' };

/** "2.1 MB", "340 KB". */
export function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Which festival an upload is for, in words. */
export function dropFor(d: Drop, festivalName?: string): string {
  if (d.festivalId) return festivalName ?? d.festivalId;
  if (d.festivalName) return `New festival: ${d.festivalName}`;
  return 'No festival picked';
}

/** The message to paste into a Claude Code session: what it's for, the note, each file's link, and the text. */
export function claudeBrief(d: Drop, festivalName?: string): string {
  const lines = ['Afterglow HQ upload, please add it to Afterglow.', ''];
  if (d.festivalId) lines.push(`Festival: ${festivalName ?? d.festivalId} (id ${d.festivalId})`);
  else if (d.festivalName) lines.push(`New festival: ${d.festivalName}`);
  if (d.note) lines.push(`Note: ${d.note}`);
  if (d.files.length) {
    lines.push('', 'Files (open the links to read them):');
    d.files.forEach((f, i) => lines.push(`${i + 1}. ${f.name} (${f.type || 'file'}, ${sizeLabel(f.size)}): ${f.url}`));
  }
  if (d.text) lines.push('', 'Text:', d.text);
  lines.push(
    '',
    'Turn it into a catalogue update for this festival (the format in docs/catalogue.md), either added to catalogue/afterglow.json or as a JSON block I can paste into HQ → Data to publish it straight away.',
    `(Upload ${d.id})`,
  );
  return lines.join('\n');
}

/** Pasted text that's a catalogue update (JSON), rather than a set list to read. */
export const looksLikeCatalogFile = (text: string) => /^\s*\{[\s\S]*"version"\s*:\s*1[\s\S]*\}\s*$/.test(text);

export type FileSummary = { festivalId?: string; festivalName?: string; festivals: number; acts: number; newArtists: number; sets: number };

/** What a pasted catalogue update holds, against the catalogue as it is. */
export function fileSummary(file: ParsedFile, catalog: Pick<Catalog, 'artist'>): FileSummary {
  const fs = file.snapshot?.festivals ?? [];
  const f = fs[0];
  return {
    festivals: fs.length,
    acts: f?.lineup.length ?? 0,
    newArtists: (file.snapshot?.artists ?? []).filter((a) => !catalog.artist(a.id)).length,
    sets: f?.sets?.length ?? 0,
    ...(f ? { festivalId: f.id, festivalName: f.name } : {}),
  };
}

/** "EDC Orlando 2026: 112 acts, 4 new to Afterglow, 96 set times". */
export function fileSummaryLine(s: FileSummary): string {
  if (!s.festivalName) return 'No festival in it';
  const parts = [`${s.acts} ${s.acts === 1 ? 'act' : 'acts'}`];
  if (s.newArtists) parts.push(`${s.newArtists} new to Afterglow`);
  if (s.sets) parts.push(`${s.sets} set ${s.sets === 1 ? 'time' : 'times'}`);
  return `${s.festivalName}: ${parts.join(', ')}${s.festivals > 1 ? ` (and ${s.festivals - 1} more ${s.festivals === 2 ? 'festival' : 'festivals'})` : ''}`;
}

/** A plan for Plus: no end, or ending a set time from now. */
export const PLUS_TERMS = [
  { key: 'always', label: 'No end', months: 0 },
  { key: 'month', label: '1 month', months: 1 },
  { key: 'quarter', label: '3 months', months: 3 },
  { key: 'year', label: '1 year', months: 12 },
] as const;

export function plusUntil(months: number, now: Date): string | undefined {
  if (!months) return undefined;
  return new Date(now.getFullYear(), now.getMonth() + months, now.getDate()).toISOString();
}

/** The default caption for each flair. */
export const FLAIR_CAPTION = { artist: 'Artist on Afterglow', team: 'Afterglow team', partner: 'Afterglow partner' } as const;
