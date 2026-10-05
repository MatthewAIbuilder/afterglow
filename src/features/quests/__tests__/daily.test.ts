import { describe, expect, it } from '@jest/globals';
import {
  ALL_DONE_BONUS,
  DAILY,
  NO_COUNTS,
  type QuestBook,
  type QuestSnapshot,
  canDo,
  cleanBook,
  dailyCurrent,
  dailyPicks,
  dayLetter,
  dayStart,
  levelOf,
  longestStreak,
  bestStreakOf,
  glowShareText,
  added,
  badgeGlowCount,
  picksFor,
  questDay,
  questWeek,
  settleQuests,
  shiftDay,
  streakOf,
  totalGlow,
  turnOver,
  turnsOverIn,
  weekRow,
  weeklyPick,
  withEvent,
} from '../daily';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const ids = (n: number, p = 'c') => Array.from({ length: n }, (_, i) => `${p}${i}`);
const snap = (counts: Partial<typeof NO_COUNTS> = {}, seen: Record<string, number> = {}, sounds: Record<string, string> = {}): QuestSnapshot => ({
  counts: { ...NO_COUNTS, ...counts },
  seen,
  soundOf: (id) => sounds[id],
});

describe('days and weeks', () => {
  it('turns days over at 4 AM, so a late night counts as the night it was', () => {
    expect(questDay(at(2026, 10, 3, 23))).toBe('2026-10-03');
    expect(questDay(at(2026, 10, 4, 3, 30))).toBe('2026-10-03');
    expect(questDay(at(2026, 10, 4, 4, 1))).toBe('2026-10-04');
    expect(dayStart('2026-10-03')).toBe(at(2026, 10, 3, 4));
  });

  it('weeks start on Monday', () => {
    expect(questWeek(at(2026, 10, 3))).toBe('2026-09-28'); // Saturday → that Monday
    expect(questWeek(at(2026, 10, 5, 10))).toBe('2026-10-05');
    expect(questWeek(at(2026, 10, 5, 2))).toBe('2026-09-28'); // still Sunday night
    expect(shiftDay('2026-10-01', 1)).toBe('2026-09-30');
    expect(dayLetter('2026-10-03')).toBe('S');
  });

  it('says when new quests arrive', () => {
    expect(turnsOverIn(at(2026, 10, 3, 23))).toBe('New quests in 5 h');
    expect(turnsOverIn(at(2026, 10, 4, 3, 20))).toBe('New quests in 40 min');
  });
});

describe('picking quests', () => {
  it('draws one quest per lane, the same all day, different on other days', () => {
    const a = dailyPicks('2026-10-03');
    expect(a.map((q) => q.lane)).toEqual(['watch', 'taste', 'plan']);
    expect(dailyPicks('2026-10-03')).toEqual(a);
    const days = Array.from({ length: 10 }, (_, i) => dailyPicks(shiftDay('2026-10-03', -i)).map((q) => q.id).join());
    expect(new Set(days).size).toBeGreaterThan(5);
  });

  it('leaves out what you can’t do right now', () => {
    for (let i = 0; i < 40; i++) {
      const picks = dailyPicks(shiftDay('2026-10-03', -i), canDo({ planning: false, enoughSets: false }));
      expect(picks.some((q) => ['stars', 'thisorthat', 'chat', 'door', 'crowd', 'sprout'].includes(q.id))).toBe(false);
      expect(picks).toHaveLength(3);
    }
  });

  it('Crew call is offered only when you’re in a crew', () => {
    expect(canDo({ planning: true, enoughSets: true })('chat')).toBe(false);
    expect(canDo({ planning: true, enoughSets: true, crew: true })('chat')).toBe(true);
  });

  it('Knock knock needs a festival week door, In the crowd needs you signed in', () => {
    expect(canDo({ planning: true, enoughSets: true })('door')).toBe(false);
    expect(canDo({ planning: true, enoughSets: true, door: true })('door')).toBe(true);
    expect(canDo({ planning: true, enoughSets: true })('crowd')).toBe(false);
    expect(canDo({ planning: true, enoughSets: true, crowd: true })('crowd')).toBe(true);
  });

  it('In the crowd counts each crowd video seen today once', () => {
    const crowd = DAILY.find((q) => q.id === 'crowd')!;
    const since = at(2026, 10, 3, 4);
    const seen = { 'community:a': at(2026, 10, 3, 9), 'community:old': at(2026, 10, 2, 22), c1: at(2026, 10, 3, 10) };
    expect(dailyCurrent(crowd, snap({}, seen), NO_COUNTS, {}, since)).toBe(1);
    expect(dailyCurrent(crowd, snap({}, { ...seen, 'community:b': at(2026, 10, 3, 11) }), NO_COUNTS, {}, since)).toBe(2);
    const sprout = DAILY.find((q) => q.id === 'sprout')!;
    expect(dailyCurrent(sprout, snap(), NO_COUNTS, { sprout: 1 }, since)).toBe(1);
    expect(canDo({ planning: true, enoughSets: true })('sprout')).toBe(false);
    const door = DAILY.find((q) => q.id === 'door')!;
    expect(dailyCurrent(door, snap(), NO_COUNTS, { door: 1 }, since)).toBe(1);
  });

  it('every quest can be drawn', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) dailyPicks(shiftDay('2026-01-01', -i)).forEach((q) => seen.add(q.id));
    expect(seen.size).toBe(DAILY.length);
    expect(weeklyPick('2026-09-28')).toEqual(weeklyPick('2026-09-28'));
  });
});

describe('progress', () => {
  const day = '2026-10-03';
  const since = dayStart(day);
  const spec = (id: string) => DAILY.find((q) => q.id === id)!;

  it('counts what changed since the day began', () => {
    const base = { ...NO_COUNTS, likes: ids(10) };
    expect(dailyCurrent(spec('like'), snap({ likes: ids(12) }), base, {}, since)).toBe(2);
    expect(dailyCurrent(spec('like'), snap({ likes: ids(20) }), base, {}, since)).toBe(3); // capped
    expect(dailyCurrent(spec('like'), snap({ likes: ids(4) }), base, {}, since)).toBe(0);
    // Taking an old like back and giving it again never counts.
    expect(dailyCurrent(spec('like'), snap({ likes: [...ids(9), 'c9'] }), base, {}, since)).toBe(0);
    expect(added(['a', 'b', 'c'], ['b'])).toBe(2);
  });

  it('counts sets watched today and the sounds they span', () => {
    const s = snap({}, { a: since + 10, b: since + 20, c: since - 10, d: since + 30 }, { a: 'dubstep', b: 'dubstep', d: 'house', c: 'trap' });
    expect(dailyCurrent(spec('watch'), s, NO_COUNTS, {}, since)).toBe(3);
    expect(dailyCurrent(spec('sounds'), s, NO_COUNTS, {}, since)).toBe(2);
  });

  it('counts events', () => {
    expect(dailyCurrent(spec('map'), snap(), NO_COUNTS, { map: 1 }, since)).toBe(1);
    expect(dailyCurrent(spec('bubble'), snap(), NO_COUNTS, { bubble: 2 }, since)).toBe(2);
  });
});

describe('the book', () => {
  const now = at(2026, 10, 3, 15);

  it('starts with a snapshot, and turns the day over keeping the history and glow', () => {
    const book = turnOver(undefined, now, { ...NO_COUNTS, likes: ids(5) });
    expect(book.base.likes).toHaveLength(5);
    expect(turnOver(book, now + 60_000, { ...NO_COUNTS, likes: ids(9) })).toBe(book);
    const tomorrow = turnOver({ ...book, done: ['like'], picks: ['like', 'rate', 'map'], glow: 80, lit: ['2026-10-03'] }, at(2026, 10, 4, 9), { ...NO_COUNTS, likes: ids(9) });
    expect(tomorrow.day).toBe('2026-10-04');
    expect(tomorrow.done).toEqual([]);
    expect(tomorrow.picks).toBeUndefined();
    expect(tomorrow.base.likes).toHaveLength(9);
    expect(tomorrow.glow).toBe(80);
    expect(tomorrow.lit).toEqual(['2026-10-03']);
  });

  it('keeps today as it is when the clock or time zone goes back a day', () => {
    const today: QuestBook = { ...turnOver(undefined, now, NO_COUNTS), done: ['like'], picks: ['like', 'rate', 'map'], glow: 30 };
    const back = turnOver(today, at(2026, 10, 2, 15), { ...NO_COUNTS, likes: ids(4) });
    expect(back).toBe(today);
    // Once the clock is right again, it's still the same day: the done quest stays done.
    expect(turnOver(back, now + 60_000, NO_COUNTS)).toBe(today);
  });

  it('counts claimed badges for glow once, and throwbacks only while you have them', () => {
    const side = new Set(['ms:sprout-swap']);
    const claimed = new Set(['pin:edc', 'ms:ten-sets', 'ms:sprout-swap', 'past:edc-orlando-2024', 'past:edc-orlando-2023', 'past:sunset-sessions-2022']);
    expect(badgeGlowCount(claimed, side, new Set(['past:edc-orlando-2024']))).toBe(3);
    expect(badgeGlowCount(claimed, side, new Set(['past:edc-orlando-2024', 'past:edc-orlando-2023', 'past:sunset-sessions-2022']))).toBe(5);
    expect(badgeGlowCount(undefined, side, new Set())).toBe(0);
  });

  it('finishes quests once, adds their glow, and the bonus for all three', () => {
    let book = turnOver(undefined, now, NO_COUNTS);
    const picks = DAILY.filter((q) => ['like', 'rate', 'map'].includes(q.id));
    let r = settleQuests(book, picks, snap({ likes: ids(3) }));
    expect(r.finished.map((f) => f.kind)).toEqual(['daily']);
    expect(r.book.glow).toBe(15);
    book = withEvent(r.book, 'map');
    r = settleQuests(book, picks, snap({ likes: ids(3), rated: ids(5, 'a') }));
    expect(r.finished.map((f) => (f.kind === 'daily' ? f.spec.id : f.kind))).toEqual(['rate', 'map', 'all']);
    expect(r.book.glow).toBe(15 + 25 + 10 + ALL_DONE_BONUS);
    expect(r.book.lit).toEqual(['2026-10-03']);
    expect(settleQuests(r.book, picks, snap({ likes: ids(3), rated: ids(5, 'a') })).book).toBe(r.book);
  });

  it('keeps the day’s three once drawn, even when what you can do changes', () => {
    const book = { ...turnOver(undefined, now, NO_COUNTS), picks: ['like' as const, 'rate' as const, 'map' as const] };
    expect(picksFor(book, () => false).map((q) => q.id)).toEqual(['like', 'rate', 'map']);
    expect(picksFor({ ...book, picks: undefined }, () => true)).toHaveLength(3);
  });

  it('reads a saved book back, or nothing when it’s broken', () => {
    const book = turnOver(undefined, now, NO_COUNTS);
    expect(cleanBook(JSON.parse(JSON.stringify({ ...book, done: ['like', 'nope'], glow: 12.7 })))).toEqual({ ...book, done: ['like'], glow: 12, picks: undefined });
    // An older book that kept numbers keeps its glow and streak; only its snapshots start again.
    const old = cleanBook({ ...book, base: { likes: 3 }, glow: 300, lit: ['2026-10-02'], bestStreak: 9 })!;
    expect(old.glow).toBe(300);
    expect(old.lit).toEqual(['2026-10-02']);
    expect(old.bestStreak).toBe(9);
    expect(old.needsBase).toBe(true);
    const fixed = turnOver(old, now + 60_000, { ...NO_COUNTS, likes: ['x'] });
    expect(fixed.base.likes).toEqual(['x']);
    expect(fixed.needsBase).toBeUndefined();
    expect(cleanBook({ day: 'x' })).toBeUndefined();
    expect(cleanBook(null)).toBeUndefined();
  });
});

describe('streaks and levels', () => {
  it('counts days in a row, through yesterday while today is open', () => {
    expect(streakOf(['2026-10-01', '2026-10-02'], '2026-10-03')).toBe(2);
    expect(streakOf(['2026-10-01', '2026-10-02', '2026-10-03'], '2026-10-03')).toBe(3);
    expect(streakOf(['2026-09-30', '2026-10-02'], '2026-10-03')).toBe(1);
    expect(streakOf([], '2026-10-03')).toBe(0);
    const row = weekRow(['2026-10-02'], '2026-10-03');
    expect(row).toHaveLength(7);
    expect(row[6]).toEqual({ day: '2026-10-03', lit: false, today: true });
    expect(row[5].lit).toBe(true);
  });

  it('names levels, and keeps counting after the last', () => {
    expect(levelOf(0)).toMatchObject({ level: 1, name: 'Spark', progress: 0 });
    expect(levelOf(175)).toMatchObject({ level: 2, name: 'Flicker', from: 100, to: 250, progress: 0.5 });
    expect(levelOf(4000)).toMatchObject({ level: 11, name: 'Afterglow' });
    expect(levelOf(5300)).toMatchObject({ level: 12, name: 'Afterglow 2' });
    expect(totalGlow({ glow: 100 }, 2, 3)).toBe(100 + 300 + 225);
  });
});

describe('best streak', () => {
  it('keeps the best streak once its days are tidied away', () => {
    expect(bestStreakOf({ lit: [], bestStreak: 8 })).toBe(8);
    expect(bestStreakOf({ lit: ['2026-10-01', '2026-10-02'] })).toBe(2);
    expect(bestStreakOf(undefined)).toBe(0);
  });

  it('finds the longest run of days', () => {
    expect(longestStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06'])).toBe(3);
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(['2026-09-30', '2026-10-01'])).toBe(2);
  });
});

describe('sharing your glow', () => {
  it('says your level, and a streak worth mentioning', () => {
    expect(glowShareText(4, 'Neon', 5, 'https://afterglowmusic.app')).toBe(
      'I’m glow level 4, Neon, on Afterglow.\n5 days in a row of daily quests.\nFind your festival sound:\nhttps://afterglowmusic.app',
    );
    expect(glowShareText(1, 'Spark', 1, 'u')).toBe('I’m glow level 1, Spark, on Afterglow.\nFind your festival sound:\nu');
  });
});
