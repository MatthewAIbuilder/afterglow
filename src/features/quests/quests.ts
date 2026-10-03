import type { Artist, Festival, SoundTag } from '../../data/models';
import { runsOf } from '../festivals/when';
import { guessArtists, nightOf } from '../memories/guess';
import type { Memory } from '../memories/models';
import type { Milestone } from '../profile/milestones';
import type { CrewUpdate } from '../social/models';
import { topSound } from '../taste/thisOrThat';

/**
 * Side quests: badges for the things that make a festival yours: meeting
 * people (PLUR), looking out for your crew, and little adventures. Each is
 * worked out on the phone from what you actually did, at a festival you're
 * going to, on its nights. Pure.
 */
export type QuestId = 'plur' | 'wavelength' | 'fam' | 'crew4' | 'sync' | 'lookout' | 'beacon' | 'sunrise' | 'everynight' | 'stages';

export type QuestSpec = { id: QuestId; title: string; how: string; about: string; target: number; kind: 'connect' | 'adventure' };

export const QUESTS: readonly QuestSpec[] = [
  { id: 'plur', kind: 'connect', target: 1, title: 'PLUR trade', how: 'Swap friend codes with someone at a festival', about: 'Peace, love, unity, respect. For scanning someone’s friend code face to face at a festival.' },
  {
    id: 'wavelength',
    kind: 'connect',
    target: 1,
    title: 'Same wavelength',
    how: 'Make a friend at a set you both love',
    about: 'For meeting someone new during a set by an artist you love, when their sound matches it too. Scan their code right there.',
  },
  { id: 'fam', kind: 'connect', target: 5, title: 'Festival fam', how: 'Make 5 friends at one festival', about: 'For swapping codes with 5 people at the same festival. Strangers at the start, fam by the end.' },
  { id: 'crew4', kind: 'connect', target: 4, title: 'Squad up', how: 'Go with a crew of 4 or more', about: 'For being at a festival with a crew of at least 4 on Afterglow.' },
  { id: 'sync', kind: 'connect', target: 1, title: 'In sync', how: 'Post from the same set as a crewmate', about: 'For you and a crewmate posting from the same stage or set within half an hour of each other.' },
  { id: 'lookout', kind: 'connect', target: 1, title: 'Looking out', how: 'Answer a crewmate who asks for help', about: 'For replying when someone in your crew asked for help. Festivals are better when everyone gets home.' },
  { id: 'beacon', kind: 'connect', target: 1, title: 'Beacon', how: 'Set a meeting spot for your crew', about: 'For picking a meeting spot for your crew, so nobody stays lost for long.' },
  { id: 'sunrise', kind: 'adventure', target: 1, title: 'Sunrise set', how: 'Film a moment at a festival after 5 AM', about: 'For filming a moment at a festival between 5 and 8 in the morning. You stayed for the sunrise.' },
  { id: 'everynight', kind: 'adventure', target: 2, title: 'Every night', how: 'Film a moment on every night of a festival', about: 'For filming at least one moment on every night of a festival with two or more nights.' },
  { id: 'stages', kind: 'adventure', target: 3, title: 'Stage hopper', how: 'Post from 3 stages in one night', about: 'For posting to your crew from 3 different stages in a single night.' },
];

/** A friend you added by scanning their code. */
export type QuestFriend = { uid: string; at: number };

export type QuestInput = {
  /** Festivals you're going to, as they are for you. */
  festivals: readonly Festival[];
  artists: readonly Artist[];
  friends: readonly QuestFriend[];
  /** The top sounds someone shows on their profile (undefined until read, or when they don't show them). */
  theirSounds: (uid: string) => readonly SoundTag[] | undefined;
  loves: (artistId: string) => boolean;
  me?: string;
  memories: readonly Memory[];
  /** Your crews: who's in them and which festival. */
  crews: readonly { id: string; festivalId: string; members: readonly string[] }[];
  /** Every crew update the phone has (yours and crewmates'). */
  updates: readonly CrewUpdate[];
  /** Crews whose meeting spot you set. */
  spotsSetByMe: number;
  now: number;
};

export type QuestDone = { at: number; festivalId?: string };
export type QuestProgress = { current: number; done?: QuestDone };

const HALF_HOUR = 30 * 60_000;
const pad = (n: number) => String(n).padStart(2, '0');
/** The festival night a moment belongs to: nights run noon to noon. */
export function nightKey(t: number): string {
  const d = new Date(t);
  if (d.getHours() < 12) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Which of your festivals a moment falls on, by its nights. */
export function festivalAt(festivals: readonly Festival[], t: number): Festival | undefined {
  const day = nightKey(t);
  return festivals.find((f) => runsOf(f).some((r) => r.start <= day && day <= r.end));
}
/** Nights in the run of a festival that a moment falls in. */
function runNights(f: Festival, t: number): number {
  const day = nightKey(t);
  const run = runsOf(f).find((r) => r.start <= day && day <= r.end);
  if (!run) return 0;
  return Math.round((Date.parse(`${run.end}T12:00:00`) - Date.parse(`${run.start}T12:00:00`)) / 86_400_000) + 1;
}
const ms = (iso: string) => Date.parse(iso);

/** Who was playing at that moment (by set times, or your plan); undefined before set times. */
function playingAt(f: Festival, t: number, artists: readonly Artist[]): Artist | undefined {
  if (!f.sets?.length) return undefined;
  const n = nightOf(f, new Date(t));
  if (!n) return undefined;
  const g = guessArtists({ festival: f, night: n.night, minute: n.minute, artists: artists as Artist[], taste: {} });
  return g.find((x) => x.reason === 'on-now' || x.reason === 'plan')?.artist;
}

/** How far along each side quest is, and when it was done (the first time it was). */
export function questProgress(i: QuestInput): Record<QuestId, QuestProgress> {
  const out = {} as Record<QuestId, QuestProgress>;
  const done = (id: QuestId, current: number, d?: QuestDone) => (out[id] = { current, ...(d ? { done: d } : {}) });

  // Friends met at a festival, oldest first.
  const met = [...i.friends]
    .map((f) => ({ ...f, festival: festivalAt(i.festivals, f.at) }))
    .filter((f) => f.festival)
    .sort((a, b) => a.at - b.at);
  done('plur', met.length ? 1 : 0, met[0] && { at: met[0].at, festivalId: met[0].festival!.id });

  const kindred = met.find((f) => {
    const artist = playingAt(f.festival!, f.at, i.artists);
    if (!artist || !i.loves(artist.id)) return false;
    const sound = topSound(artist);
    return !!sound && !!i.theirSounds(f.uid)?.includes(sound);
  });
  done('wavelength', kindred ? 1 : 0, kindred && { at: kindred.at, festivalId: kindred.festival!.id });

  const perFestival = new Map<string, number[]>();
  for (const f of met) perFestival.set(f.festival!.id, [...(perFestival.get(f.festival!.id) ?? []), f.at]);
  let famBest = 0;
  let famDone: QuestDone | undefined;
  for (const [id, times] of perFestival) {
    famBest = Math.max(famBest, times.length);
    if (times.length >= 5 && (!famDone || times[4] < famDone.at)) famDone = { at: times[4], festivalId: id };
  }
  done('fam', Math.min(5, famBest), famDone);

  // Crews at your festivals.
  const mine = i.crews.filter((c) => i.festivals.some((f) => f.id === c.festivalId) && (!i.me || c.members.includes(i.me)));
  const biggest = mine.reduce((m, c) => Math.max(m, c.members.length), 0);
  const big = mine.find((c) => c.members.length >= 4);
  // Done once the festival is on (the night it starts), with that crew.
  const bigFestival = big && i.festivals.find((f) => f.id === big.festivalId);
  const bigOn = bigFestival && festivalAt([bigFestival], i.now) ? { at: i.now, festivalId: bigFestival.id } : undefined;
  done('crew4', Math.min(4, biggest), bigOn);

  // Crew updates at your festivals, on their nights.
  const atFest = i.updates.filter((u) => u.kind !== 'reply' && festivalAt(i.festivals, ms(u.at))?.id === u.festivalId);
  const ownUpdates = atFest.filter((u) => u.uid === i.me);
  const theirs = atFest.filter((u) => u.uid !== i.me);
  let sync: QuestDone | undefined;
  for (const a of ownUpdates) {
    const match = theirs.find(
      (b) =>
        b.crewId === a.crewId &&
        Math.abs(ms(a.at) - ms(b.at)) <= HALF_HOUR &&
        ((a.stage && b.stage && a.stage.toLowerCase() === b.stage.toLowerCase()) || (a.artistId && a.artistId === b.artistId)),
    );
    if (match) {
      const at = Math.max(ms(a.at), ms(match.at));
      if (!sync || at < sync.at) sync = { at, festivalId: a.festivalId };
    }
  }
  done('sync', sync ? 1 : 0, sync);

  const helps = new Map(i.updates.filter((u) => u.care === 'help' && u.uid !== i.me).map((u) => [u.id, u]));
  const answer = i.updates.find((u) => u.kind === 'reply' && u.uid === i.me && u.replyTo && helps.has(u.replyTo));
  done('lookout', answer ? 1 : 0, answer && { at: ms(answer.at), festivalId: answer.festivalId });

  done('beacon', i.spotsSetByMe ? 1 : 0, i.spotsSetByMe ? { at: i.now } : undefined);

  // Your own videos at your festivals.
  const filmed = i.memories
    .map((m) => ({ m, t: ms(m.capturedAt) }))
    .filter(({ m, t }) => Number.isFinite(t) && (!m.festivalId || festivalAt(i.festivals, t)?.id === m.festivalId))
    .map(({ m, t }) => ({ t, festival: festivalAt(i.festivals, t) }))
    .filter((x): x is { t: number; festival: Festival } => !!x.festival)
    .sort((a, b) => a.t - b.t);
  const dawn = filmed.find(({ t }) => {
    const h = new Date(t).getHours();
    return h >= 5 && h < 8;
  });
  done('sunrise', dawn ? 1 : 0, dawn && { at: dawn.t, festivalId: dawn.festival.id });

  // Every night of a run: nights filmed per festival run.
  const nights = new Map<string, { nights: Set<string>; need: number; last: number }>();
  for (const { t, festival } of filmed) {
    const need = runNights(festival, t);
    const key = `${festival.id}:${need}`;
    const e = nights.get(key) ?? { nights: new Set<string>(), need, last: 0 };
    e.nights.add(nightKey(t));
    e.last = t;
    nights.set(key, e);
  }
  let every: QuestDone | undefined;
  let everyBest = 0;
  for (const [key, e] of nights) {
    everyBest = Math.max(everyBest, Math.min(2, e.nights.size));
    if (e.need >= 2 && e.nights.size >= e.need && !every) every = { at: e.last, festivalId: key.split(':')[0] };
  }
  done('everynight', every ? 2 : everyBest, every);

  // Stages in one night, from your own posts.
  const byNight = new Map<string, { stages: Set<string>; at: number; festivalId: string }>();
  for (const u of ownUpdates) {
    if (!u.stage) continue;
    const key = `${u.festivalId}:${nightKey(ms(u.at))}`;
    const e = byNight.get(key) ?? { stages: new Set<string>(), at: 0, festivalId: u.festivalId };
    e.stages.add(u.stage.toLowerCase());
    if (e.stages.size === 3 && !e.at) e.at = ms(u.at);
    byNight.set(key, e);
  }
  const hop = [...byNight.values()].find((e) => e.stages.size >= 3);
  const stagesBest = [...byNight.values()].reduce((m, e) => Math.max(m, e.stages.size), 0);
  done('stages', Math.min(3, stagesBest), hop && { at: hop.at || i.now, festivalId: hop.festivalId });

  return out;
}

/** Quests done now that aren't in the log yet. */
export function newlyDone(progress: Record<QuestId, QuestProgress>, log: Readonly<Record<string, QuestDone>>): [QuestId, QuestDone][] {
  return QUESTS.flatMap((q) => {
    const d = progress[q.id]?.done;
    return d && !log[q.id] ? [[q.id, d] as [QuestId, QuestDone]] : [];
  });
}

/** Side quests as badges: done ones (from the log, so they stay done) first, then the rest with their progress. */
export function questBadges(progress: Partial<Record<QuestId, QuestProgress>>, log: Readonly<Record<string, QuestDone>>): Milestone[] {
  const list: Milestone[] = QUESTS.map((q) => {
    const earned = !!log[q.id];
    const current = earned ? q.target : Math.min(q.target, progress[q.id]?.current ?? 0);
    return { id: q.id, title: q.title, how: q.how, about: q.about, current, target: q.target, earned, quest: true };
  });
  return [...list.filter((m) => m.earned), ...list.filter((m) => !m.earned)];
}

/** Stored log, cleaned: known quests with a time. */
export function cleanQuestLog(raw: unknown): Record<string, QuestDone> {
  const out: Record<string, QuestDone> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const q of QUESTS) {
    const v = (raw as Record<string, unknown>)[q.id] as { at?: unknown; festivalId?: unknown } | undefined;
    if (v && typeof v.at === 'number' && Number.isFinite(v.at)) out[q.id] = { at: v.at, ...(typeof v.festivalId === 'string' ? { festivalId: v.festivalId } : {}) };
  }
  return out;
}

/** Quests still open for a festival night, best to try first: connection ones first. */
export function openQuests(log: Readonly<Record<string, QuestDone>>, max = 3): QuestSpec[] {
  return QUESTS.filter((q) => !log[q.id]).slice(0, max);
}
