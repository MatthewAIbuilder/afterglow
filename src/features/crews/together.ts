import type { Crew, CrewPicks } from '../social/models';

/**
 * Planning a festival as a crew. Pure. Each member shares their starred sets
 * at the crew's festival; this works out which sets more than one of you
 * want, and says who in plain words. Picks from people no longer in the
 * crew, and artists not on the lineup, are ignored.
 */
export type SharedPick = { artistId: string; who: string[] };

export type Together = {
  /** Sets starred by two or more members: most of you first, then billing order. */
  shared: SharedPick[];
  /** Each member's picks on the lineup, in billing order (members with none are left out). */
  byMember: Record<string, string[]>;
};

export function crewTogether(picks: CrewPicks[], members: string[], lineup: string[]): Together {
  const inCrew = new Set(members);
  const order = new Map(lineup.map((id, i) => [id, i]));
  const byMember: Record<string, string[]> = {};
  const who = new Map<string, string[]>();
  for (const p of picks) {
    if (!inCrew.has(p.uid)) continue;
    const mine = [...new Set(p.artists)].filter((a) => order.has(a)).sort((a, b) => order.get(a)! - order.get(b)!);
    if (!mine.length) continue;
    byMember[p.uid] = mine;
    for (const a of mine) who.set(a, [...(who.get(a) ?? []), p.uid]);
  }
  const memberOrder = new Map(members.map((m, i) => [m, i]));
  const shared = [...who.entries()]
    .filter(([, w]) => w.length > 1)
    .map(([artistId, w]) => ({ artistId, who: w.sort((a, b) => memberOrder.get(a)! - memberOrder.get(b)!) }))
    .sort((a, b) => b.who.length - a.who.length || order.get(a.artistId)! - order.get(b.artistId)!);
  return { shared, byMember };
}

/** Names in a list: "Maya", "Maya and Sam", "Maya, Sam and Jo". */
const joinNames = (names: string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/**
 * Who wants a set: "Both of you", "All 4 of you", or names with you last
 * ("Maya and you", "Maya, Sam and you"). `nameOf` gives a member's first name.
 */
export function whoLine(who: string[], crewSize: number, me: string | undefined, nameOf: (uid: string) => string): string {
  if (who.length === crewSize && crewSize > 1) return crewSize === 2 ? 'Both of you' : `All ${crewSize} of you`;
  const others = who.filter((u) => u !== me).map(nameOf);
  return joinNames(me && who.includes(me) ? [...others, 'you'] : others);
}

/** A line about the crew for the festival page: "You, Maya and Sam", "Just you so far. Invite your friends." */
export function crewMembersLine(crew: Crew, me: string | undefined, nameOf: (uid: string) => string): string {
  const others = crew.members.filter((u) => u !== me);
  if (!others.length) return 'Just you so far. Invite your friends.';
  const shown = others.slice(0, 3).map(nameOf);
  const more = others.length - shown.length;
  return `You, ${joinNames(more ? [...shown, `${more} more`] : shown)}`;
}

/** "3 sets you share", "1 set you share", or nothing to show yet. */
export function sharedCountLine(together: Together): string | undefined {
  const n = together.shared.length;
  return n ? `${n} ${n === 1 ? 'set' : 'sets'} you share` : undefined;
}

/** A member's first name from their display name (or handle). */
export const firstName = (displayName: string) => displayName.trim().split(/\s+/)[0] || displayName;

/** The address that opens a crew (in the app, or on the website). */
export const crewPath = (id: string) => `/crew/${id}`;

/** Whether the picks you'd publish differ from the ones last published (order doesn't matter). */
export function picksChanged(next: readonly string[], last: readonly string[] | undefined): boolean {
  if (!last) return true;
  if (next.length !== last.length) return true;
  const had = new Set(last);
  return next.some((a) => !had.has(a));
}
