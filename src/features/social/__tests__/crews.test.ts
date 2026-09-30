import { describe, expect, it } from '@jest/globals';
import { CREW_MAX } from '../models';
import { crewNameProblem } from '../validate';
import { fakeSocial } from './fakeSocial';

async function person(f: ReturnType<typeof fakeSocial>, handle: string) {
  const u = await f.service.signUp(`${handle}@example.com`, 'password123');
  await f.service.saveProfile({ handle, displayName: handle, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}
const as = (f: ReturnType<typeof fakeSocial>, handle: string) => f.service.signIn(`${handle}@example.com`, 'password123');

describe('festival crews (in-memory backend, same rules as Firestore)', () => {
  it('start, join, share picks, see only your crews', async () => {
    const f = fakeSocial();
    const maya = await person(f, 'maya');
    const crew = await f.service.createCrew('acl-26', '  Weekend   one ');
    expect(crew).toMatchObject({ name: 'Weekend one', owner: maya, members: [maya] });
    await f.service.setCrewPicks(crew.id, ['skrillex', 'skrillex', 'levity']);
    const sam = await person(f, 'sam');
    expect(await f.service.myCrews()).toEqual([]);
    await expect(f.service.crewPicks(crew.id)).rejects.toThrow();
    await expect(f.service.setCrewPicks(crew.id, ['x'])).rejects.toThrow();
    const joined = await f.service.joinCrew(crew.id);
    expect(joined.members).toEqual([maya, sam]);
    expect((await f.service.joinCrew(crew.id)).members).toEqual([maya, sam]);
    await f.service.setCrewPicks(crew.id, ['skrillex']);
    const picks = await f.service.crewPicks(crew.id);
    expect(picks.find((p) => p.uid === maya)?.artists).toEqual(['skrillex', 'levity']);
    expect((await f.service.myCrews()).map((c) => c.id)).toEqual([crew.id]);
  });

  it('needs a profile, refuses a full crew and people the owner blocked', async () => {
    const f = fakeSocial();
    const maya = await person(f, 'maya');
    const crew = await f.service.createCrew('acl-26', 'Crew');
    await f.service.signUp('np@example.com', 'password123');
    await expect(f.service.createCrew('acl-26', 'Mine')).rejects.toMatchObject({ kind: 'no-profile' });
    await expect(f.service.joinCrew(crew.id)).rejects.toMatchObject({ kind: 'no-profile' });
    const bad = await person(f, 'bad');
    await as(f, 'maya');
    await f.service.setBlocked(bad, true);
    await as(f, 'bad');
    await expect(f.service.joinCrew(crew.id)).rejects.toThrow();
    f.crews.set(crew.id, { ...f.crews.get(crew.id)!, members: [maya, ...Array.from({ length: CREW_MAX - 1 }, (_, i) => `u${i}`)] });
    await person(f, 'late');
    await expect(f.service.joinCrew(crew.id)).rejects.toMatchObject({ kind: 'crew-full' });
    await expect(f.service.joinCrew('nope')).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('owner renames and removes people; others can’t', async () => {
    const f = fakeSocial();
    await person(f, 'maya');
    const crew = await f.service.createCrew('acl-26', 'Crew');
    const sam = await person(f, 'sam');
    await f.service.joinCrew(crew.id);
    await f.service.setCrewPicks(crew.id, ['a']);
    await expect(f.service.renameCrew(crew.id, 'Sam’s')).rejects.toThrow();
    await expect(f.service.removeFromCrew(crew.id, sam)).rejects.toThrow();
    await as(f, 'maya');
    expect((await f.service.renameCrew(crew.id, 'Weekend 2')).name).toBe('Weekend 2');
    expect((await f.service.removeFromCrew(crew.id, sam)).members).toHaveLength(1);
    expect(f.picks.has(`${crew.id}/${sam}`)).toBe(false);
  });

  it('leaving takes your picks; an owner hands it on; the last one out ends it; deleting your account leaves', async () => {
    const f = fakeSocial();
    await person(f, 'maya');
    const crew = await f.service.createCrew('acl-26', 'Crew');
    await f.service.setCrewPicks(crew.id, ['a']);
    const sam = await person(f, 'sam');
    await f.service.joinCrew(crew.id);
    await as(f, 'maya');
    await f.service.leaveCrew(crew.id);
    expect(f.crews.get(crew.id)).toMatchObject({ owner: sam, members: [sam] });
    expect(f.picks.size).toBe(0);
    await as(f, 'sam');
    await f.service.setCrewPicks(crew.id, ['b']);
    await f.service.deleteAccount('password123');
    expect(f.crews.has(crew.id)).toBe(false);
    expect(f.picks.size).toBe(0);
  });

  it('crew names: needed, short, friendly', () => {
    expect(crewNameProblem('  ')).toBe('Give your crew a name.');
    expect(crewNameProblem('x'.repeat(41))).toBe('At most 40 characters.');
    expect(crewNameProblem('Sunrise gang')).toBeUndefined();
  });
});
