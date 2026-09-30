import { SOUND_LABEL, type SoundTag } from '../../data/models';

/**
 * What you have in common with someone, from what they chose to show
 * (festivals they're going to, their top sounds, the videos they shared) and
 * what your phone knows about you. Pure; nothing about you leaves the phone.
 */
export type CommonInput = {
  theirs: { festivals: readonly string[]; sounds: readonly SoundTag[]; filmed: readonly string[] };
  mine: { going: readonly string[]; sounds: readonly SoundTag[]; loves: (artistId: string) => boolean };
  /** Name of a festival that's still to come (undefined when it's unknown or over). */
  festivalName: (id: string) => string | undefined;
  artistName: (id: string) => string | undefined;
};

export type CommonLine = { kind: 'festivals' | 'sounds' | 'filmed'; text: string; ids: string[] };

const list = (names: string[], more = 0) => {
  const shown = names.slice(0, 2);
  const extra = names.length - shown.length + more;
  if (extra > 0) return `${shown.join(', ')} and ${extra} more`;
  return shown.length === 2 ? `${shown[0]} and ${shown[1]}` : (shown[0] ?? '');
};

export function inCommon(i: CommonInput): CommonLine[] {
  const lines: CommonLine[] = [];
  const mineGoing = new Set(i.mine.going);
  const festivals = i.theirs.festivals.filter((id, k, all) => mineGoing.has(id) && all.indexOf(id) === k && i.festivalName(id));
  if (festivals.length)
    lines.push({ kind: 'festivals', ids: festivals, text: `You’re both going to ${list(festivals.map((id) => i.festivalName(id)!))}` });

  const mySounds = new Set(i.mine.sounds);
  const sounds = i.theirs.sounds.filter((s) => mySounds.has(s));
  if (sounds.length)
    lines.push({ kind: 'sounds', ids: sounds, text: `You both lean ${list(sounds.map((s) => SOUND_LABEL[s].toLowerCase()))}` });

  // Artists they filmed that you love, most filmed first.
  const counts = new Map<string, number>();
  for (const a of i.theirs.filmed) if (i.mine.loves(a) && i.artistName(a)) counts.set(a, (counts.get(a) ?? 0) + 1);
  const filmed = [...counts].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  if (filmed.length)
    lines.push({ kind: 'filmed', ids: filmed, text: `They filmed ${list(filmed.map((a) => i.artistName(a)!))}, ${filmed.length === 1 ? 'who you love' : 'artists you love'}` });
  return lines;
}
