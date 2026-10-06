import type { Profile } from './models';
import { t, tn } from '../../i18n';

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
  if (!friends.length) return others.length ? tn(others.length, '{n} person on Afterglow is going', '{n} people on Afterglow are going') : undefined;
  const [a, b] = friends;
  const going =
    friends.length === 1
      ? t('{name} is going', { name: a.displayName })
      : friends.length === 2
        ? t('{a} and {b} are going', { a: a.displayName, b: b.displayName })
        : t('{a} and {n} others you follow are going', { a: a.displayName, n: friends.length - 1 });
  return others.length ? tn(others.length, '{going}, plus {n} other on Afterglow', '{going}, plus {n} others on Afterglow', { going }) : going;

}
