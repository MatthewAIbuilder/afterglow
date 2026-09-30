import type { Clip, Festival } from '../../data/models';
import { groupFestivals, type Going } from '../festivals/going';
import { defaultFocus, focusForClip, lineupClips, playsAt } from '../festivals/links';

/**
 * What Discover is showing: one festival's lineup (its id), your mix (a bit
 * of everything from every lineup), or Following (videos from the people you
 * follow). Pure.
 */
export const MIX = 'mix';
export const FOLLOWING = 'following';
/** Focuses that aren't one festival: they draw from every lineup. */
export const isWide = (focus: Focus | undefined) => focus === MIX || focus === FOLLOWING;
export type Focus = string;

/**
 * Where Discover opens: what you last picked, if it's still there with clips
 * to show; otherwise the first festival you're going to that has clips;
 * otherwise the festival with the most clips.
 */
export function startFocus(festivals: Festival[], clips: Clip[], going: Going, stored?: string | null): Focus | undefined {
  if (stored === MIX || stored === FOLLOWING) return stored;
  const withClips = (f: Festival | undefined) => !!f && lineupClips(f, clips).length > 0;
  const saved = festivals.find((f) => f.id === stored);
  if (withClips(saved)) return saved!.id;
  const mine = going.map((id) => festivals.find((f) => f.id === id)).find(withClips);
  return (mine ?? defaultFocus(festivals, clips))?.id;
}

/**
 * Where the focus goes when Discover is asked to open something: a festival
 * (or the mix, or Following) wins; a clip keeps the mix, which has every
 * clip, and Following when it's a video from the crowd; otherwise it moves to
 * a festival the artist plays if needed.
 */
export function nextDiscoverFocus(
  current: Focus | undefined,
  asked: { festival?: string; clip?: Clip },
  festivals: Festival[],
): Focus | undefined {
  if (asked.festival === MIX || asked.festival === FOLLOWING) return asked.festival;
  const festival = asked.festival ? festivals.find((f) => f.id === asked.festival) : undefined;
  if (festival) return festival.id;
  if (!asked.clip || current === MIX) return current;
  if (current === FOLLOWING && asked.clip.source?.provider === 'community') return current;
  const now = festivals.find((f) => f.id === current);
  return (focusForClip(asked.clip, now, festivals) ?? now)?.id ?? current;
}

/**
 * In your mix, which festival a clip is shown against: one you're going to
 * that the artist plays, otherwise the clip's own festival, otherwise the
 * first one that has them.
 */
export function mixContext(clip: Clip, festivals: Festival[], going: Going): Festival | undefined {
  for (const id of going) {
    const f = festivals.find((x) => x.id === id);
    if (f && playsAt(f, clip.artistId)) return f;
  }
  return focusForClip(clip, undefined, festivals);
}

export type FocusChoice = { festival: Festival; clips: number };

/**
 * The festivals Discover offers to focus on: the ones you're going to first
 * (soonest first, even those with no clips yet, so you can see why), then the
 * rest that have clips. Festivals you're not going to with nothing to watch
 * aren't offered.
 */
export function focusChoices(festivals: Festival[], clips: Clip[], going: Going, today: Date) {
  const grouped = groupFestivals(festivals, going, today);
  const choice = (festival: Festival): FocusChoice => ({ festival, clips: lineupClips(festival, clips).length });
  return {
    going: grouped.going.map(choice),
    others: grouped.others.map(choice).filter((c) => c.clips > 0),
  };
}
