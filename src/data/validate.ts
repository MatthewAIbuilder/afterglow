import type { CatalogSnapshot, Clip, ClipSource, Festival, FestivalLineup, SetTime, SoundTag } from './models';
import { SOUND_TAGS } from './models';

/**
 * Checks a catalogue before the app uses it. Real sources will have gaps and
 * mistakes (an artist removed but still on a lineup, a set time for someone
 * not announced, a broken video link), and the app should quietly leave
 * those out rather than crash or show something wrong. Pure.
 *
 * Returns a cleaned copy and a plain list of what was dropped. The mock data
 * must come back with no problems at all (see the tests).
 */
export type Validation = { snapshot: CatalogSnapshot; problems: string[] };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Structurally sound footage: a known provider, a real video id and a section that makes sense. */
export function validSource(s: ClipSource | undefined): boolean {
  if (!s) return true;
  if (s.provider !== 'youtube') return false;
  return (
    VIDEO_ID.test(s.videoId) &&
    Number.isFinite(s.start) &&
    Number.isFinite(s.end) &&
    s.start >= 0 &&
    s.end > s.start &&
    typeof s.channel === 'string' &&
    s.channel.length > 0
  );
}

const validSet = (s: SetTime, lineup: ReadonlySet<string>, days: readonly string[], stages: ReadonlySet<string>) =>
  lineup.has(s.artistId) && days.includes(s.day) && stages.has(s.stageId) && TIME.test(s.start) && TIME.test(s.end);

export function validateSnapshot(input: CatalogSnapshot): Validation {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  const unique = <T extends { id: string }>(kind: string, list: T[]) =>
    list.filter((x) => {
      const key = `${kind}:${x.id}`;
      if (!x.id || seenIds.has(key)) {
        problems.push(`Two ${kind}s share the id "${x.id}" (or one has none). Only the first was kept.`);
        return false;
      }
      seenIds.add(key);
      return true;
    });

  const artists = unique('artist', input.artists).map((a) => {
    const sound: Partial<Record<SoundTag, number>> = {};
    for (const [tag, w] of Object.entries(a.sound ?? {})) {
      if ((SOUND_TAGS as readonly string[]).includes(tag) && typeof w === 'number' && w >= 0 && w <= 1) sound[tag as SoundTag] = w;
      else problems.push(`Artist "${a.id}": sound "${tag}" was ignored.`);
    }
    return { ...a, sound };
  });
  const artistIds = new Set(artists.map((a) => a.id));

  const festivals: Festival[] = unique('festival', input.festivals).map((f) => {
    const lineup = f.lineup.filter((id, i) => {
      const ok = artistIds.has(id) && f.lineup.indexOf(id) === i;
      if (!ok) problems.push(`Festival "${f.id}": "${id}" is on the lineup but isn't in the artist list (or is listed twice), so it was left out.`);
      return ok;
    });
    const stageIds = new Set(f.stages.map((s) => s.id));
    const inLineup = new Set(lineup);
    const base: Festival = { ...f, lineup };
    if (f.notes) {
      const notes = Object.fromEntries(Object.entries(f.notes).filter(([id]) => inLineup.has(id)));
      if (Object.keys(notes).length < Object.keys(f.notes).length)
        problems.push(`Festival "${f.id}": a set note was left out because that artist isn't on the lineup.`);
      if (Object.keys(notes).length) base.notes = notes;
      else delete base.notes;
    }
    if (f.artistDays) {
      const days = new Set(f.days);
      const kept = Object.entries(f.artistDays).flatMap(([id, ds]) => {
        const valid = ds.filter((d) => days.has(d));
        return inLineup.has(id) && valid.length ? [[id, valid] as const] : [];
      });
      const total = Object.values(f.artistDays).reduce((n, ds) => n + ds.length, 0);
      if (kept.reduce((n, [, ds]) => n + ds.length, 0) < total)
        problems.push(`Festival "${f.id}": a day was left out because that artist isn't on the lineup or the day isn't one of the festival's days.`);
      if (kept.length) base.artistDays = Object.fromEntries(kept);
      else delete base.artistDays;
    }
    if (f.artistWeekends) {
      const count = f.weekends?.length ?? 0;
      const kept = Object.entries(f.artistWeekends).filter(([id, w]) => inLineup.has(id) && w >= 1 && w <= count);
      if (kept.length < Object.keys(f.artistWeekends).length)
        problems.push(`Festival "${f.id}": a weekend was left out because that artist isn't on the lineup or the festival doesn't have that weekend.`);
      if (kept.length) base.artistWeekends = Object.fromEntries(kept);
      else delete base.artistWeekends;
    }
    if (!f.sets) return base;
    const sets = f.sets.filter((s) => {
      const ok = validSet(s, inLineup, f.days, stageIds);
      if (!ok) problems.push(`Festival "${f.id}": the set for "${s.artistId}" was left out. Check they're on the lineup, and that the day and stage exist.`);
      return ok;
    });
    return { ...base, sets };
  });
  const festivalIds = new Set(festivals.map((f) => f.id));

  const clips: Clip[] = unique('clip', input.clips)
    .filter((c) => {
      const ok = artistIds.has(c.artistId) && festivalIds.has(c.festivalId) && c.durationSec > 0;
      if (!ok) problems.push(`Clip "${c.id}" was left out: its artist or festival isn't in the file, or it has no length.`);
      return ok;
    })
    .map((c) => {
      // A back to back keeps only the other artists who are in the file.
      if (c.withArtistIds) {
        const others = c.withArtistIds.filter((x) => artistIds.has(x) && x !== c.artistId);
        c = others.length ? { ...c, withArtistIds: others } : (({ withArtistIds: _gone, ...rest }) => rest)(c);
      }
      if (validSource(c.source)) return c;
      problems.push(`Clip "${c.id}": the video doesn't look right, so it shows the stage instead.`);
      const { source: _dropped, ...rest } = c;
      return rest;
    });

  const lineups: FestivalLineup[] | undefined = input.lineups
    ?.filter((l) => {
      const ok = festivalIds.has(l.festivalId);
      if (!ok) problems.push(`A lineup for "${l.festivalId}" was left out: there's no festival with that id.`);
      return ok;
    })
    .map((l) => {
      const artistIdsInLineup = l.artistIds.filter((id, i) => {
        const ok = artistIds.has(id) && l.artistIds.indexOf(id) === i;
        if (!ok) problems.push(`Lineup for "${l.festivalId}": "${id}" isn't in the artist list (or is listed twice), so it was left out.`);
        return ok;
      });
      if (!l.sets) return { ...l, artistIds: artistIdsInLineup };
      const festival = festivals.find((f) => f.id === l.festivalId)!;
      const days = l.days ?? festival.days;
      const stages = new Set((l.stages ?? festival.stages).map((s) => s.id));
      const inLineup = new Set(artistIdsInLineup);
      const sets = l.sets.filter((s) => {
        const ok = validSet(s, inLineup, days, stages);
        if (!ok) problems.push(`Lineup for "${l.festivalId}": the set for "${s.artistId}" was left out. Check they're on the lineup, and that the day and stage exist.`);
        return ok;
      });
      return { ...l, artistIds: artistIdsInLineup, sets };
    });

  const similarities = input.similarities?.filter((s) => {
    const ok = artistIds.has(s.artistId) && artistIds.has(s.otherId) && s.artistId !== s.otherId && s.score >= 0 && s.score <= 1;
    if (!ok) problems.push(`The similarity between "${s.artistId}" and "${s.otherId}" was left out: both must be artists in the file, and the score from 0 to 1.`);
    return ok;
  });

  // Club shows keep only the artists still on Afterglow, quietly (they're the nightly feed's, not anyone's typing);
  // a show with none of them left goes. Soonest first.
  const showIds = new Set<string>();
  const shows = input.shows
    ?.flatMap((s) => {
      if (showIds.has(s.id)) return [];
      showIds.add(s.id);
      const ids = s.artistIds.filter((a, i) => artistIds.has(a) && s.artistIds.indexOf(a) === i);
      return ids.length ? [ids.length === s.artistIds.length ? s : { ...s, artistIds: ids }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // SoundCloud pages keep only artists still on Afterglow, quietly (the nightly match's, not anyone's typing).
  const soundcloud = input.soundcloud && Object.fromEntries(Object.entries(input.soundcloud).filter(([id, p]) => artistIds.has(id) && !!p?.url));

  const snapshot: CatalogSnapshot = { artists, festivals, clips };
  if (shows?.length) snapshot.shows = shows;
  if (soundcloud && Object.keys(soundcloud).length) snapshot.soundcloud = soundcloud;
  if (lineups) snapshot.lineups = lineups;
  if (similarities) snapshot.similarities = similarities;
  return { snapshot, problems };
}
