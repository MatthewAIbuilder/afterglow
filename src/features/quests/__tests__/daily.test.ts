import { describe, expect, it } from '@jest/globals';
import {
  ALL_DONE_BONUS,
  DAILY,
  NO_COUNTS,
  type QuestSnapshot,
  canDo,
  cleanBook,
  dailyCurrent,
  dailyPicks,
  dayLetter,
  dayStart,
  levelOf,
  longestStreak,
  added,
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
      expect(picks.some((q) => q.id === 'stars' || q.id === 'thisorthat')).toBe(false);
      expect(picks).toHaveLength(3);
    }
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
    // An old book that kept numbers reads as nothing (a fresh start).
    expect(cleanBook({ ...book, base: { likes: 3 } })).toBeUndefined();
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
  it('finds the longest run of days', () => {
    expect(longestStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06'])).toBe(3);
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(['2026-09-30', '2026-10-01'])).toBe(2);
  });
});
