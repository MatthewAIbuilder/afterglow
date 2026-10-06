import { SOUND_LABEL, type SoundTag } from '../../data/models';
import { t } from '../../i18n';

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
  if (extra > 0) return t('{names} and {n} more', { names: shown.join(', '), n: extra });
  return shown.length === 2 ? t('{a} and {b}', { a: shown[0], b: shown[1] }) : (shown[0] ?? '');
};

export function inCommon(i: CommonInput): CommonLine[] {
  const lines: CommonLine[] = [];
  const mineGoing = new Set(i.mine.going);
  const festivals = i.theirs.festivals.filter((id, k, all) => mineGoing.has(id) && all.indexOf(id) === k && i.festivalName(id));
  if (festivals.length)
    lines.push({ kind: 'festivals', ids: festivals, text: t('You’re both going to {festivals}', { festivals: list(festivals.map((id) => i.festivalName(id)!)) }) });

  const mySounds = new Set(i.mine.sounds);
  const sounds = i.theirs.sounds.filter((s) => mySounds.has(s));
  if (sounds.length)
    lines.push({ kind: 'sounds', ids: sounds, text: t('You both lean {sounds}', { sounds: list(sounds.map((s) => SOUND_LABEL[s].toLowerCase())) }) });

  // Artists they filmed that you love, most filmed first.
  const counts = new Map<string, number>();
  for (const a of i.theirs.filmed) if (i.mine.loves(a) && i.artistName(a)) counts.set(a, (counts.get(a) ?? 0) + 1);
  const filmed = [...counts].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  if (filmed.length)
    lines.push({ kind: 'filmed', ids: filmed, text: filmed.length === 1
        ? t('They filmed {artists}, who you love', { artists: list(filmed.map((a) => i.artistName(a)!)) })
        : t('They filmed {artists}, artists you love', { artists: list(filmed.map((a) => i.artistName(a)!)) }),
    });
  return lines;
}
