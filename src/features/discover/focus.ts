import type { Artist, Clip, Festival, SoundTag } from '../../data/models';
import { SOUND_TAGS } from '../../data/models';
import { groupFestivals, type Going } from '../festivals/going';
import { carriesSound } from '../festivals/search';
import { defaultFocus, focusForClip, lineupClips, playsAt } from '../festivals/links';

/**
 * What Discover is showing: one festival's lineup (its id), your mix (a bit
 * of everything from every lineup), or Following (videos from the people you
 * follow). Pure.
 */
export const MIX = 'mix';
export const FOLLOWING = 'following';
/** Tonight's preview: who plays tonight at the festival you're at, in set order (only while one is on). */
export const TONIGHT = 'tonight';
export type Focus = string;

/** One sound from every lineup: "sound:dubstep". */
const SOUND_PREFIX = 'sound:';
export const soundFocus = (tag: SoundTag): Focus => `${SOUND_PREFIX}${tag}`;
/** The sound a focus is about, when it's a sound. */
export function soundOf(focus: Focus | null | undefined): SoundTag | undefined {
  if (!focus?.startsWith(SOUND_PREFIX)) return undefined;
  const tag = focus.slice(SOUND_PREFIX.length);
  return (SOUND_TAGS as readonly string[]).includes(tag) ? (tag as SoundTag) : undefined;
}
/** Festival mode: only videos people filmed at this festival ("here:cyclops-cove-4"). Never saved as your focus. */
const HERE_PREFIX = 'here:';
export const hereFocus = (festivalId: string): Focus => `${HERE_PREFIX}${festivalId}`;
export const hereOf = (focus: Focus | null | undefined): string | undefined => (focus?.startsWith(HERE_PREFIX) ? focus.slice(HERE_PREFIX.length) || undefined : undefined);

/** Focuses that aren't one festival: they draw from every lineup. */
export const isWide = (focus: Focus | undefined) => focus === MIX || focus === FOLLOWING || !!soundOf(focus);

/** A sound is offered in Discover once this many clips carry it. */
export const SOUND_CLIPS_MIN = 3;

/** The sounds Discover can focus on: ones with enough clips, most first. */
export function soundChoices(clips: readonly Clip[], artist: (id: string) => Artist | undefined, min = SOUND_CLIPS_MIN): { tag: SoundTag; clips: number }[] {
  return SOUND_TAGS.map((tag) => ({ tag, clips: clips.filter((c) => inSound(c, tag, artist)).length }))
    .filter((s) => s.clips >= min)
    .sort((a, b) => b.clips - a.clips || SOUND_TAGS.indexOf(a.tag) - SOUND_TAGS.indexOf(b.tag));
}

/** Whether a clip belongs to a sound: its artist carries it. */
export function inSound(clip: Clip, tag: SoundTag, artist: (id: string) => Artist | undefined): boolean {
  const a = artist(clip.artistId);
  return !!a && carriesSound(a, tag);
}

/**
 * Where Discover opens: what you last picked, if it's still there with clips
 * to show; otherwise the first festival you're going to that has clips;
 * otherwise the festival with the most clips.
 */
export function startFocus(festivals: Festival[], clips: Clip[], going: Going, stored?: string | null): Focus | undefined {
  if (stored === MIX || stored === FOLLOWING || stored === TONIGHT || soundOf(stored)) return stored!;
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
  if (asked.festival === MIX || asked.festival === FOLLOWING || asked.festival === TONIGHT || soundOf(asked.festival)) return asked.festival;
  const festival = asked.festival ? festivals.find((f) => f.id === asked.festival) : undefined;
  if (festival) return festival.id;
  if (!asked.clip || current === MIX) return current;
  if (current === FOLLOWING && asked.clip.source?.provider === 'community') return current;
  // A sound may not have that clip: the mix has every one.
  if (soundOf(current)) return MIX;
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
