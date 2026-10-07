import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { activityNotices } from '../features/notifications/activity';
import { inviteNotices } from '../features/crews/invite';
import { firstName } from '../features/crews/together';
import { cleanRead, notices, type Notice } from '../features/notifications/inbox';
import { sortNotices } from '../features/notifications/organize';
import { clipNotices } from '../features/notifications/clipNews';
import { lineupNotices } from '../features/notifications/lineupNews';
import { recapNotices } from '../features/recap/recap';
import { arrivalNotices, bloomNotices, sproutNotices, wildNotices } from '../features/sprouts/outbox';
import { useSprouts } from './sprouts';
import { themeGiftNotices } from '../features/themes/gifts';
import { themeOf } from '../features/themes/themes';
import { useRecapFestivals } from '../features/recap/useRecap';
import type { Activity, CrewInvite, Profile } from '../features/social/models';
import { useToday } from '../lib/useToday';
import { t } from '../i18n';
import { useCatalog } from './catalog';
import { useClipNews } from './clipNews';
import { useGoing } from './going';
import { useLineupNews } from './lineupNews';
import { useSeen } from './seen';
import { useSocial } from './social';
import { useLoves } from './useLoves';
import { useWeekends } from './weekends';
import { useOrgs } from './orgs';
import { followedOrgs, orgPostNotices, type OrgPost } from '../features/organizers/organizers';

/**
 * The bell's notices: news about your festivals (worked out on the phone),
 * then new followers and likes on your videos (read from your profile's
 * activity when you're signed in), and which ones you've read (saved on the
 * device). Must sit inside SocialProvider.
 */
type Ctx = {
  list: Notice[];
  /** Read your activity again (the bell's screen does when it opens). */
  refresh: () => void;
  read: ReadonlySet<string>;
  markRead: (ids: string[]) => void;
  /** Read notices have loaded, so the bell never flashes a count it shouldn't. */
  hydrated: boolean;
};

const STORAGE_KEY = 'noticesRead.v1';
/** How much recent activity the bell reads. */
const ACTIVITY_MAX = 30;
/** How many updates from organizers you follow the bell reads. */
const ORG_POSTS_MAX = 20;

const NoticesContext = createContext<Ctx | null>(null);

export function NoticesProvider({ children }: { children: ReactNode }) {
  const { festivals } = useCatalog();
  const { going } = useGoing();
  const today = useToday();
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setRead((current) => new Set([...cleanRead(JSON.parse(raw)), ...current]));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...read])).catch(() => {});
  }, [read]);

  const markRead = useCallback((ids: string[]) => {
    setRead((current) => (ids.every((id) => current.has(id)) ? current : new Set([...current, ...ids])));
  }, []);

  // Festivals as they are for you: a two-weekend festival follows the weekend you're going to.
  const { forYou } = useWeekends();
  const mine = useMemo(() => festivals.map(forYou), [festivals, forYou]);
  const list = useMemo(() => notices(mine, going, today), [mine, going, today]);
  // Artists you'd love, newly added to a lineup (or on a festival new to Afterglow).
  const { memory } = useLineupNews();
  const loves = useLoves();
  const { artist: artistById } = useCatalog();
  const lineupList = useMemo(
    () =>
      lineupNotices(memory.news, {
        festivals: mine,
        loves,
        nameOf: (id) => artistById(id)?.name,
        going: new Set(going),
        today,
      }),
    [memory.news, mine, loves, artistById, going, today],
  );
  // New sets from artists you'd love that you haven't watched yet.
  const { memory: clipMemory } = useClipNews();
  const { clip: clipById } = useCatalog();
  const { seen } = useSeen();
  const clipList = useMemo(
    () => clipNotices(clipMemory.news, { clip: clipById, loves, nameOf: (id) => artistById(id)?.name, watched: (id) => id in seen }),
    [clipMemory.news, clipById, loves, artistById, seen],
  );
  // Your activity: fetched when you sign in, when the app comes back, and when the bell's screen asks.
  const social = useSocial();
  const uid = social.user?.uid;
  const [activity, setActivity] = useState<{ uid: string; items: Activity[]; people: Record<string, Profile | null>; videos: Record<string, string>; invites: CrewInvite[] }>();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);
  const { artist, festival } = useCatalog();
  useEffect(() => {
    if (!uid || !social.availability.ok) return;
    let live = true;
    (async () => {
      try {
        const items = await social.service.activity(ACTIVITY_MAX);
        // Crews you've been asked to join (they leave once you join or say no).
        const invites = await social.service.crewInvites(ACTIVITY_MAX).catch(() => [] as CrewInvite[]);
        const who = [...new Set([...items.map((a) => a.from), ...invites.map((i) => i.from)])];
        const people: Record<string, Profile | null> = {};
        await Promise.all(who.map(async (u) => (people[u] = await social.service.profileOf(u).catch(() => null))));
        // What your liked videos are of, from what you've shared.
        const videos: Record<string, string> = {};
        if (items.some((a) => a.kind === 'like' || a.kind === 'comment')) {
          for (const m of await social.service.memoriesOf(uid).catch(() => [])) {
            const name = m.artistId ? artist(m.artistId)?.name : undefined;
            if (name) videos[m.id] = t('your video of {artist}', { artist: name });
          }
        }
        if (live) setActivity({ uid, items, people, videos, invites });
      } catch {
        // Keep what was there; the next refresh tries again.
      }
    })();
    return () => {
      live = false;
    };
  }, [uid, social.availability.ok, social.service, artist, tick]);
  const activityList = useMemo(
    () =>
      activity && activity.uid === uid
        ? activityNotices(activity.items, {
            handleOf: (u) => activity.people[u]?.handle,
            videoOf: (id) => activity.videos[id],
            blocked: social.blocked,
          })
        : [],
    [activity, uid, social.blocked],
  );
  const inviteList = useMemo(() => {
    if (!activity || activity.uid !== uid) return [];
    const nameOf = (u: string) => {
      const p = activity.people[u];
      return p ? firstName(p.displayName) : undefined;
    };
    const open = activity.invites.filter((i) => !social.blocked.has(i.from));
    return inviteNotices(open, { nameOf, festivalName: (id) => festival(id)?.name });
  }, [activity, uid, social.blocked, festival]);
  // Updates from event organizers you follow (read with your activity).
  const orgs = useOrgs();
  const followedKey = useMemo(() => followedOrgs(orgs, social.following).map((o) => o.id).sort().join(','), [orgs, social.following]);
  const [orgPosts, setOrgPosts] = useState<{ uid: string; posts: OrgPost[] }>();
  useEffect(() => {
    if (!uid || !social.availability.ok || !followedKey) return;
    let live = true;
    social.service
      .orgPosts(followedKey.split(','), ORG_POSTS_MAX)
      .then((posts) => live && setOrgPosts({ uid, posts }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [uid, social.availability.ok, social.service, followedKey, tick]);
  const orgList = useMemo(() => (orgPosts && orgPosts.uid === uid && followedKey ? orgPostNotices(orgPosts.posts.filter((p) => followedKey.split(',').includes(p.orgId)), orgs) : []), [orgPosts, uid, followedKey, orgs]);
  // Festivals that ended lately with a recap for you.
  const recapFestivals = useRecapFestivals();
  const recapList = useMemo(() => recapNotices(recapFestivals, today), [recapFestivals, today]);
  // Sprouts you gave that someone picked up.
  const { gifts, blooms, garden, giftThemes } = useSprouts();
  const sproutList = useMemo(
    () => [
      ...wildNotices(garden, today.getTime()),
      ...arrivalNotices(garden, today.getTime()),
      ...bloomNotices(blooms, today.getTime()),
      ...sproutNotices(gifts, today.getTime()),
      ...themeGiftNotices(giftThemes, (id) => themeOf(id).name),
    ],
    [garden, blooms, gifts, giftThemes, today],
  );
  // Happening now first, then the newest first (features/notifications/organize.ts).
  const all = useMemo(
    () => sortNotices([...inviteList, ...recapList, ...list, ...lineupList, ...clipList, ...sproutList, ...orgList, ...activityList], today.getTime()),
    [inviteList, recapList, list, lineupList, clipList, sproutList, orgList, activityList, today],
  );

  const value = useMemo<Ctx>(() => ({ list: all, refresh, read, markRead, hydrated }), [all, refresh, read, markRead, hydrated]);
  return <NoticesContext.Provider value={value}>{children}</NoticesContext.Provider>;
}

export function useNotices() {
  const ctx = useContext(NoticesContext);
  if (!ctx) throw new Error('useNotices must be used inside NoticesProvider');
  return ctx;
}
