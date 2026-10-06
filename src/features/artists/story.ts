import type { Clip, Festival } from '../../data/models';
import { setFor } from '../../data/festival';
import { filmedThere } from '../badges/badges';
import { countdown } from '../festivals/when';
import { describeSet } from '../festivals/format';
import { bySoonest, isOver } from '../festivals/shelves';
import { pastLabel, type PastEvent } from '../memories/past';
import { t, tn } from '../../i18n';

/**
 * The deeper artist page, worked out on the phone. Pure.
 *
 * - Their next show: the soonest festival they play that isn't over, with
 *   its set time once it's out and a countdown.
 * - You and them: what you've done with their music on Afterglow (sets
 *   watched, liked and kept, your videos of them, the festivals where you
 *   saw them live), so the page remembers you.
 */

/** The soonest festival they play that isn't over (dated ones first). */
export function nextShow(festivals: readonly Festival[], artistId: string, today: Date): Festival | undefined {
  return bySoonest(
    festivals.filter((f) => f.lineup.includes(artistId) && !isOver(f, today)),
    today,
  )[0];
}

/** "Saturday 11:40 PM, Bass Tent · In 2 months", "Saturday · In 2 months", or just the countdown. */
export function nextShowLine(festival: Festival, artistId: string, today: Date, dayOf?: (f: Festival, a: string) => string | undefined): string {
  const set = setFor(festival, artistId);
  return [set ? describeSet(festival, set) : dayOf?.(festival, artistId), countdown(festival, today)].filter(Boolean).join(' · ');
}

type Reaction = { liked?: boolean; saved?: boolean; skipped?: boolean; watched?: string };
type MemoryLike = { id: string; capturedAt: string; artistId?: string; festivalId?: string; past?: PastEvent };

export type ArtistStory = {
  /** Their sets you've had on screen. */
  watched: number;
  liked: number;
  saved: number;
  /** Your videos of them. */
  filmed: number;
  /** Where you saw them live: festivals you filmed them at on its dates, and throwbacks. Most recent first. */
  seenLive: string[];
  /** When you first filmed them (ISO), if you have. */
  firstFilmed?: string;
};

export function artistStory(input: {
  artistId: string;
  clips: readonly Clip[];
  reactions: Readonly<Record<string, Reaction>>;
  seen: Readonly<Record<string, number>>;
  memories: readonly MemoryLike[];
  festivalOf: (id: string) => Festival | undefined;
}): ArtistStory {
  const ids = input.clips.map((c) => c.id);
  const mine = input.memories.filter((m) => m.artistId === input.artistId).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const live: { label: string; at: string }[] = [];
  for (const m of mine) {
    const f = m.festivalId ? input.festivalOf(m.festivalId) : undefined;
    const label = m.past ? pastLabel(m.past) : f && filmedThere(f, m.capturedAt) ? f.name : undefined;
    if (label && !live.some((l) => l.label === label)) live.push({ label, at: m.capturedAt });
  }
  return {
    watched: ids.filter((id) => input.seen[id]).length,
    liked: ids.filter((id) => input.reactions[id]?.liked).length,
    saved: ids.filter((id) => input.reactions[id]?.saved).length,
    filmed: mine.length,
    seenLive: live.sort((a, b) => b.at.localeCompare(a.at)).map((l) => l.label),
    ...(mine.length ? { firstFilmed: mine[0].capturedAt } : {}),
  };
}

/** Is there anything to say? */
export const hasStory = (s: ArtistStory) => s.watched + s.liked + s.saved + s.filmed > 0;

/** "a, b and c", in the app's language. */
const list = (names: readonly string[]) => (names.length <= 1 ? (names[0] ?? '') : t('{list} and {last}', { list: names.slice(0, -1).join(', '), last: names[names.length - 1] }));

/** The story as short lines: "Seen live at EDC Orlando 2026 and Lost Lands 2024", "3 videos of them", "Watched 4 sets · liked 2 · kept 1". */
export function storyLines(s: ArtistStory): string[] {
  const out: string[] = [];
  if (s.seenLive.length) {
    const places = list(s.seenLive.slice(0, 3));
    out.push(s.seenLive.length > 3 ? t('Seen live at {places} and {n} more', { places, n: s.seenLive.length - 3 }) : t('Seen live at {places}', { places }));
  }
  if (s.filmed) out.push(tn(s.filmed, '{n} video of them in your Memories', '{n} videos of them in your Memories'));
  const clips = [s.watched ? tn(s.watched, 'Watched {n} set', 'Watched {n} sets') : '', s.liked ? t('liked {n}', { n: s.liked }) : '', s.saved ? t('kept {n}', { n: s.saved }) : ''].filter(Boolean);
  if (clips.length) {
    const line = clips.join(' · ');
    out.push(line[0].toUpperCase() + line.slice(1));
  }
  return out;
}
