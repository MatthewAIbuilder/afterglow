import { describe, expect, it } from '@jest/globals';
import type { Festival } from '../../../data/models';
import type { Crew, CrewUpdate } from '../../social/models';
import {
  ago,
  cleanOutbox,
  cleanSentVideos,
  clock,
  crewStories,
  delivered,
  enqueue,
  failed,
  lateLine,
  latestPerMember,
  liveCrews,
  markSeen,
  OUTBOX_KEEP_MS,
  outboxLine,
  refusedOnce,
  repliesLine,
  repliesTo,
  retryDelay,
  updateLine,
  withSentVideo,
  type OutboxItem,
} from '../updates';

const crew: Crew = { id: 'c1', festivalId: 'f', name: 'Bass crew', owner: 'me', members: ['me', 'maya', 'sam'], createdAt: '' };
// Local times on one festival day.
const t = (h: number, m = 0) => new Date(2026, 10, 7, h, m).toISOString();
const up = (id: string, uid: string, at: string, sentAt: string, more: Partial<CrewUpdate> = {}): CrewUpdate => ({
  id,
  crewId: 'c1',
  uid,
  kind: 'video',
  at,
  sentAt,
  festivalId: 'f',
  videoUrl: 'https://files.example/v.mp4',
  ...more,
});
const now = Date.parse(t(17, 30));

describe('crew updates: what time it was', () => {
  it('the newest update is the latest one filmed, whatever order they got through in', () => {
    // A 3:00 PM video stuck on bad signal until 5:00 PM; a 4:05 PM one got through at 4:10 PM.
    const stuck = up('a', 'maya', t(15), t(17));
    const later = up('b', 'maya', t(16, 5), t(16, 10), { stage: 'Main Stage', artistId: 'slander' });
    const [story] = crewStories([stuck, later], [crew], { me: 'me', now });
    expect(story.latest.id).toBe('b');
    expect(story.updates.map((u) => u.id)).toEqual(['b', 'a']);
    expect(updateLine(story.latest, 'SLANDER')).toBe('Updated 4:05 PM · Main Stage · SLANDER');
  });

  it('says when an update got through long after it happened, and nothing when it was quick', () => {
    expect(lateLine(up('a', 'maya', t(15), t(17, 2)))).toBe('Sent 3:00 PM, reached the crew 5:02 PM');
    expect(lateLine(up('b', 'maya', t(16, 5), t(16, 7)))).toBeUndefined();
    expect(clock(t(0, 5))).toBe('12:05 AM');
    expect(ago(t(15), now)).toBe('2 h 30 min ago');
    expect(ago(t(17, 29), now)).toBe('1 min ago');
  });

  it('one story per crewmate: never you, blocked people or people who left; new ones first', () => {
    const list = [
      up('a', 'maya', t(16), t(16)),
      up('b', 'sam', t(17), t(17)),
      up('c', 'me', t(17, 10), t(17, 10)),
      up('d', 'gone', t(17, 20), t(17, 20)),
      // Too old: two days back.
      up('e', 'sam', new Date(2026, 10, 5, 12).toISOString(), t(12)),
    ];
    const stories = crewStories(list, [crew], { me: 'me', now, seen: { sam: Date.parse(t(17)) } });
    expect(stories.map((s) => [s.uid, s.fresh])).toEqual([
      ['maya', true],
      ['sam', false],
    ]);
    expect(crewStories(list, [crew], { me: 'me', blocked: ['maya'], now }).map((s) => s.uid)).toEqual(['sam']);
    // Watching it stops the glow until something newer comes.
    expect(markSeen({}, stories[0])).toEqual({ maya: Date.parse(t(16)) });
  });

  it('the same update sent to two crews counts once', () => {
    const other = { ...crew, id: 'c2' };
    const a = up('a', 'maya', t(16), t(16));
    expect(crewStories([a, { ...a, crewId: 'c2' }], [crew, other], { me: 'me', now })[0].updates).toHaveLength(1);
  });

  it("lists each member's latest, in the crew's order", () => {
    const rows = latestPerMember([up('a', 'maya', t(15), t(15)), up('b', 'maya', t(16), t(16))], crew.members);
    expect(rows.map((r) => [r.uid, r.latest?.id])).toEqual([
      ['me', undefined],
      ['maya', 'b'],
      ['sam', undefined],
    ]);
  });
});

describe('the outbox', () => {
  const item = (id: string, at: string, crewIds = ['c1', 'c2']): OutboxItem => ({
    id,
    crewIds,
    input: { id, kind: 'checkin', at, festivalId: 'f', note: 'Meet at our spot' },
    tries: 0,
    queuedAt: now,
  });

  it('keeps updates in the order they happened, and lets go of each crew it reached', () => {
    let box = enqueue([], item('b', t(16)));
    box = enqueue(box, item('a', t(15)));
    expect(box.map((o) => o.id)).toEqual(['a', 'b']);
    box = delivered(box, 'a', ['c1']);
    expect(box[0].crewIds).toEqual(['c2']);
    box = delivered(box, 'a', ['c2']);
    expect(box.map((o) => o.id)).toEqual(['b']);
    expect(failed(box, 'b')[0].tries).toBe(1);
    expect(outboxLine(box)).toBe('Waiting for signal · your 4:00 PM update will send itself');
    expect(outboxLine([])).toBeUndefined();
  });

  it('backs off between tries, up to every two minutes', () => {
    expect([0, 1, 2, 3, 9].map(retryDelay)).toEqual([15_000, 30_000, 60_000, 120_000, 120_000]);
  });

  it('reads a saved outbox back safely, dropping stale or broken items', () => {
    const good = item('a', t(15));
    const stale = { ...item('b', t(14)), queuedAt: now - OUTBOX_KEEP_MS - 1 };
    expect(cleanOutbox([good, stale, { id: 'x' }, null, { ...good, id: 'c', crewIds: [] }], now).map((o) => o.id)).toEqual(['a']);
    expect(cleanOutbox('nope', now)).toEqual([]);
  });
});

describe('which crews are live', () => {
  const fest = (id: string, more: Partial<Festival>): Festival => ({ id, name: id, dates: '', location: '', lineup: [], days: [], stages: [], ...more });
  it('crews for festivals not over (and the morning after), or undated', () => {
    const festivals = new Map([
      ['on', fest('on', { startDate: '2026-11-06', endDate: '2026-11-08' })],
      ['over', fest('over', { startDate: '2026-10-01', endDate: '2026-10-03' })],
      ['tbd', fest('tbd', {})],
    ]);
    const crews = ['on', 'over', 'tbd', 'missing'].map((f) => ({ ...crew, id: f, festivalId: f }));
    expect(liveCrews(crews, (id) => festivals.get(id), new Date(2026, 10, 9, 3)).map((c) => c.id)).toEqual(['on', 'tbd']);
    expect(liveCrews(crews, (id) => festivals.get(id), new Date(2026, 10, 10, 12)).map((c) => c.id)).toEqual(['tbd']);
  });
});

describe('crew updates: replies', () => {
  const reply = (id: string, uid: string, at: string, replyTo: string, note: string) =>
    up(id, uid, at, at, { kind: 'reply', replyTo, note, videoUrl: undefined });

  it('replies to you join the replier\'s story; replies between others stay under their update', () => {
    const mine = up('m1', 'me', t(16), t(16), { kind: 'checkin', note: 'Meet at our spot', videoUrl: undefined });
    const sams = up('s1', 'sam', t(16, 2), t(16, 2), { kind: 'checkin', videoUrl: undefined });
    const toMe = reply('r1', 'maya', t(16, 10), 'm1', 'On my way');
    const toSam = reply('r2', 'maya', t(16, 20), 's1', 'Save me a spot');
    const stories = crewStories([mine, sams, toMe, toSam], [crew], { me: 'me', now });
    const maya = stories.find((s) => s.uid === 'maya')!;
    expect(maya.updates.map((u) => u.id)).toEqual(['r1']);
    expect(updateLine(maya.latest)).toBe('Replied 4:10 PM');
    // A reply never says where someone is.
    expect(latestPerMember([mine, toMe, toSam], ['me', 'maya']).map((r) => r.latest?.id)).toEqual(['m1', undefined]);
  });

  it('a thread reads oldest first, without blocked people, and sums up in one line', () => {
    const target = up('m1', 'me', t(16), t(16), { kind: 'checkin', videoUrl: undefined });
    const list = [reply('r2', 'sam', t(16, 20), 'm1', 'Be there in 10'), reply('r1', 'maya', t(16, 10), 'm1', 'On my way'), reply('r3', 'troll', t(16, 30), 'm1', 'Hi')];
    const thread = repliesTo(list, target, ['troll']);
    expect(thread.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(repliesLine(thread, (u) => (u === 'sam' ? 'Sam' : 'Maya'))).toBe('2 replies · Sam: Be there in 10');
    expect(repliesLine([], () => '')).toBeUndefined();
  });

  it('a waiting reply survives a restart, one without its target does not', () => {
    const base = { crewIds: ['c1'], tries: 0, queuedAt: now };
    const ok = { ...base, id: 'r1', input: { id: 'r1', kind: 'reply', at: t(17), festivalId: 'f', replyTo: 'm1', note: 'On my way' } };
    const broken = { ...base, id: 'r2', input: { id: 'r2', kind: 'reply', at: t(17), festivalId: 'f', note: 'Hm' } };
    expect(cleanOutbox([ok, broken], now).map((o) => o.id)).toEqual(['r1']);
  });
});

describe('crew videos to tidy', () => {
  it('remembers each crew’s uploaded videos once, and reads them back safely', () => {
    const sent = withSentVideo(withSentVideo(withSentVideo({}, 'c1', 'a'), 'c1', 'b'), 'c1', 'a');
    expect(sent).toEqual({ c1: ['b', 'a'] });
    expect(cleanSentVideos({ c1: ['a', 3], c2: 'x', c3: [] })).toEqual({ c1: ['a'] });
    expect(cleanSentVideos(null)).toEqual({});
  });
});

describe('outbox refusals', () => {
  it('counts refusals apart from tries with no signal, and remembers whether any crew got it', () => {
    const item: OutboxItem = { id: 'u1', crewIds: ['c1', 'c2'], input: { id: 'u1', kind: 'checkin', at: t(17), festivalId: 'f' }, tries: 2, queuedAt: now };
    const once = refusedOnce([item], 'u1')[0];
    expect(once).toMatchObject({ tries: 3, refused: 1 });
    expect(delivered([item], 'u1', ['c1'])[0]).toMatchObject({ crewIds: ['c2'], reachedSome: true });
    expect(delivered([item], 'u1', ['c1'], false)[0]).toMatchObject({ crewIds: ['c2'], reachedSome: false });
    expect(cleanOutbox([once], now)[0].refused).toBe(1);
  });
});
