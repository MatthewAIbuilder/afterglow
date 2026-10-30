import type { Track } from '../memories/track';
import type { SharedMemory } from '../social/models';

/**
 * Crowd tracklists: the songs people's Track IDs found in their videos of a
 * set, put together. Every video shared with a track (the person who filmed
 * it confirmed it) adds that song to the set's list, in the order it was
 * heard, with how many people caught it. Pure.
 *
 * A set is a festival, a night and an artist; a video without a festival or
 * an artist can't be placed and is left out (throwbacks and shows have
 * their own pages).
 */
export type TrackHeard = {
  track: Track;
  /** When it was first heard (the earliest video's capture time). */
  at: string;
  /** How many people's videos caught it. */
  people: number;
  /** A video of it, to watch. */
  memoryId: string;
};

export type Tracklist = { festivalId: string; artistId: string; night?: string; tracks: TrackHeard[]; last: string };

const songKey = (t: Track) => `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;

export function tracklists(memories: readonly SharedMemory[]): Tracklist[] {
  const sets = new Map<string, { festivalId: string; artistId: string; night?: string; songs: Map<string, { track: Track; at: string; uids: Set<string>; memoryId: string }> }>();
  for (const m of memories) {
    if (!m.track || !m.festivalId || !m.artistId || m.past || m.show) continue;
    const setKey = `${m.festivalId}|${m.night ?? ''}|${m.artistId}`;
    const set = sets.get(setKey) ?? { festivalId: m.festivalId, artistId: m.artistId, ...(m.night ? { night: m.night } : {}), songs: new Map() };
    const k = songKey(m.track);
    const was = set.songs.get(k);
    if (!was) set.songs.set(k, { track: m.track, at: m.capturedAt, uids: new Set([m.uid]), memoryId: m.id });
    else {
      was.uids.add(m.uid);
      if (m.capturedAt < was.at) Object.assign(was, { at: m.capturedAt, memoryId: m.id });
    }
    sets.set(setKey, set);
  }
  return [...sets.values()]
    .map((s) => {
      const tracks = [...s.songs.values()].map((x) => ({ track: x.track, at: x.at, people: x.uids.size, memoryId: x.memoryId })).sort((a, b) => a.at.localeCompare(b.at));
      return { festivalId: s.festivalId, artistId: s.artistId, ...(s.night ? { night: s.night } : {}), tracks, last: tracks[tracks.length - 1]?.at ?? '' };
    })
    .sort((a, b) => b.last.localeCompare(a.last));
}
