import type { Profile } from './models';

/**
 * Who else is going to a festival: people you follow first, then everyone
 * else on Afterglow who shows it on their profile. Pure. Only people who
 * switched on "Show festivals I'm going to" are ever found; you and anyone
 * you blocked are left out.
 */
export type Goers = { friends: Profile[]; others: Profile[] };

export function splitGoers(profiles: Profile[], opts: { following: ReadonlySet<string>; blocked: ReadonlySet<string>; me?: string }): Goers {
  const seen = new Set<string>();
  const friends: Profile[] = [];
  const others: Profile[] = [];
  for (const p of profiles) {
    if (seen.has(p.uid) || p.uid === opts.me || opts.blocked.has(p.uid)) continue;
    seen.add(p.uid);
    (opts.following.has(p.uid) ? friends : others).push(p);
  }
  const byName = (a: Profile, b: Profile) => a.displayName.localeCompare(b.displayName);
  return { friends: friends.sort(byName), others: others.sort(byName) };
}

/** "Maya is going", "Maya and Sam are going", "Maya and 3 others you follow are going", "12 people on Afterglow are going". */
export function goersLine({ friends, others }: Goers): string | undefined {
  const more = others.length ? `${others.length} ${others.length === 1 ? 'other' : 'others'} on Afterglow` : '';
  if (!friends.length) return others.length ? `${others.length} ${others.length === 1 ? 'person' : 'people'} on Afterglow ${others.length === 1 ? 'is' : 'are'} going` : undefined;
  const [a, b] = friends;
  const names =
    friends.length === 1 ? a.displayName : friends.length === 2 ? `${a.displayName} and ${b.displayName}` : `${a.displayName} and ${friends.length - 1} others you follow`;
  const going = `${names} ${friends.length === 1 ? 'is' : 'are'} going`;
  return more ? `${going}, plus ${more}` : going;
}
