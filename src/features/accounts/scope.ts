/**
 * Each account on a phone has its own things: likes, saves and skips, ratings,
 * artists you follow, plans, quests, the garden, care. They're kept under the
 * same keys as always (so every store reads them as before); when a different
 * account signs in, the ones on the phone are put away under the account
 * they belong to (`<key>@<uid>`) and that account's own are brought back (or
 * none, for an account new to this phone). Signed out is its own "account"
 * (`guest`). Pure, with storage passed in, so the rules are tested apart.
 *
 * - The first time this runs on a phone, what's there belongs to whoever is
 *   signed in (or to signed out): nothing moves.
 * - Signing up (or into an account new to this phone) from signed out keeps
 *   what you did signed out: it becomes that account's.
 * - Anything else is a switch: put away, bring back.
 * Things about the phone itself (tips seen, the catalogue, autoplay, your
 * videos in Memories, music connections) stay with the phone.
 */
export const OWNER_KEY = 'accountScope.v1';
export const GUEST = 'guest';

/** What belongs to an account rather than the phone. */
export const ACCOUNT_KEYS = [
  'reactions.v1',
  'artistRatings.v1',
  'followedArtists.v1',
  'going.v1',
  'goingShows.v1',
  'mustSees.v1',
  'weekends.v1',
  'setReminders.v1',
  'dayHours.v1',
  'prep.v1',
  'festivalWeek.v1',
  'quests.v1',
  'dailyQuests.v1',
  'accountGlow.v1',
  'secrets.v1',
  'badgeClaims.v1',
  'gardenLayout.v1',
  'showcase.v1',
  'sprouts.v1',
  'kandi.v1',
  'finds.v1',
  'closeFriends.v1',
  'scouted.v1',
  'festivalRequests.v1',
  'recentStations.v1',
  'recentSearches.v1',
  'profileShelves.v1',
  'themeGift.v1',
  'lastBackdrop.v1',
  'care.v1',
  'noticesRead.v1',
  'crewSeen.v1',
  'crewChatRead.v1',
  'crewCareNotified.v1',
  'supportSeen.v1',
] as const;

export type ScopeStorage = {
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiSet(pairs: [string, string][]): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
};

export const putAwayKey = (key: string, scope: string) => `${key}@${scope}`;
const PUT_AWAY_MARK = 'scopeKept';

/** Which account the things on the phone belong to now (undefined: never decided, before this feature). */
export async function currentOwner(s: ScopeStorage): Promise<string | undefined> {
  const [[, v]] = await s.multiGet([OWNER_KEY]);
  return v ?? undefined;
}

/** Has this account ever had its things put away on this phone? */
async function hasPutAway(s: ScopeStorage, scope: string): Promise<boolean> {
  const [[, v]] = await s.multiGet([putAwayKey(PUT_AWAY_MARK, scope)]);
  return v === '1';
}

export type ScopeChange = 'same' | 'claimed' | 'carried' | 'switched';

/**
 * Make the phone's things `target`'s (an account's uid, or GUEST). Returns
 * what happened: nothing ('same'), the first owner decided ('claimed'), what
 * you did signed out carried into a new account ('carried'), or a switch
 * ('switched', after which every store must read again).
 */
export async function moveTo(s: ScopeStorage, target: string): Promise<ScopeChange> {
  const owner = await currentOwner(s);
  if (owner === target) return 'same';
  if (owner === undefined) {
    await s.multiSet([[OWNER_KEY, target]]);
    return 'claimed';
  }
  if (owner === GUEST && target !== GUEST && !(await hasPutAway(s, target))) {
    await s.multiSet([[OWNER_KEY, target]]);
    return 'carried';
  }
  // Put away the owner's things…
  const now = await s.multiGet(ACCOUNT_KEYS);
  const keep: [string, string][] = [[putAwayKey(PUT_AWAY_MARK, owner), '1']];
  const drop: string[] = [];
  for (const [k, v] of now) {
    if (v === null) drop.push(putAwayKey(k, owner));
    else keep.push([putAwayKey(k, owner), v]);
  }
  await s.multiSet(keep);
  if (drop.length) await s.multiRemove(drop);
  // …and bring back the target's (none, for an account new to this phone).
  const back = await s.multiGet(ACCOUNT_KEYS.map((k) => putAwayKey(k, target)));
  const restore: [string, string][] = [];
  const clear: string[] = [];
  back.forEach(([, v], i) => {
    if (v === null) clear.push(ACCOUNT_KEYS[i]);
    else restore.push([ACCOUNT_KEYS[i], v]);
  });
  if (restore.length) await s.multiSet(restore);
  if (clear.length) await s.multiRemove(clear);
  await s.multiSet([[OWNER_KEY, target]]);
  return 'switched';
}
