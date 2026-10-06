import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useProfileBackdrop } from '../../features/profile/useProfileBackdrop';
import { isOver, whenRank } from '../../features/festivals/shelves';
import { goingLine } from '../../features/social/copy';
import { CoverSwap } from '../../features/profile/CoverSwap';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { MenuIcon, TilesIcon, BookmarkIcon, FestivalsIcon, PinIcon } from '../../components/TabIcons';
import { FestivalProfile } from '../../features/festivalMode/FestivalProfile';
import { useFestivalMode } from '../../state/festivalMode';
import { Tabs } from '../../components/Tabs';
import { ProfileCover } from '../../components/ProfileCover';
import { WEB_URL } from '../../config/app';
import { yourClipCount, yourClips } from '../../features/discover/saved';
import { groupFestivals } from '../../features/festivals/going';
import { countdown } from '../../features/festivals/when';
import { Highlights } from '../../features/profile/Highlights';
import { GardenShelf } from '../../features/sprouts/GardenShelf';
import { ProfileButton, ProfileHeader } from '../../features/profile/ProfileHeader';
import { useDailyQuests } from '../../features/quests/useDailyQuests';
import { CrewsList, SavedTab, VideosTab } from '../../features/profile/ProfileTabsContent';
import { currentlyFeeling, favouriteArtists, ORBIT_MAX } from '../../features/profile/identity';
import { BadgeCelebration } from '../../features/profile/BadgeCelebration';
import { BadgesPanel, ClaimBanner } from '../../features/profile/BadgesPanel';
import { useProfileBadges } from '../../features/profile/useProfileBadges';
import { useProfileShelves } from '../../state/profileShelves';
import { PassportTab } from '../../features/profile/PassportTab';
import { YourArtistsRow } from '../../features/profile/YourArtistsRow';
import { useWhereTheyPlay } from '../../features/artists/useWhereTheyPlay';
import { nextLine } from '../../features/artists/where';
import { useNow } from '../../lib/useNow';
import { useLoves } from '../../state/useLoves';
import { useSeen } from '../../state/seen';
import { type Highlight, profileHighlights, profileStats, videoGrid } from '../../features/profile/profileView';
import { useRecapFestivals, useYear } from '../../features/recap/useRecap';
import { isYearSoFar } from '../../features/recap/year';
import { tasteMix } from '../../features/taste/lean';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useClipPool } from '../../state/community';
import { useCrews } from '../../state/crews';
import { useFollowedArtists } from '../../state/followedArtists';
import { useGoing } from '../../state/going';
import { useMoments } from '../../features/memories/useMoments';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useSocial } from '../../state/social';
import { useMyOrg, useOrg } from '../../state/orgs';
import { OrgProfileCard } from '../../features/organizers/OrgProfileCard';
import { useTaste } from '../../state/taste';
import { useWeekends } from '../../state/weekends';
import { useMemoryPicker } from '../../features/memories/useAddMemory';
import type { Memory } from '../../features/memories/models';
import { sharedAsMemory } from '../../features/memories/webVideo';
import { GoingShowsList } from '../../features/festivals/GoingShowsList';
import { splitShows } from '../../features/festivals/goingShows';
import { localDay } from '../../features/artists/shows';
import { useGoingShows } from '../../state/goingShows';
import { color, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import { datesLine } from '../../features/festivals/format';

/** How far the cover photo reaches below the safe area. */
/** How far your profile background reaches: past the orbit and your name, fading out gently below them. */
const COVER_H = 300;
/** Where the top starts fading out: just past the middle of the orbit. */
const COVER_SOLID = 150;

type Tab = 'videos' | 'badges' | 'festivals' | 'saved';
const TABS: Tab[] = ['videos', 'festivals', 'badges', 'saved'];

/**
 * Profile, laid out like Instagram and TikTok: your photo and counts, name,
 * bio and sound, Edit / Share, round shortcuts to your festivals, then tabs
 * for your videos, your festivals and what you've saved. Everything else
 * (music, settings, legal) is behind the menu at the top right.
 */
export default function ProfileScreen() {
  // In festival mode: just you, your code and what you filmed here.
  const { active } = useFestivalMode();
  return active ? <FestivalProfile festival={active.festival} /> : <FullProfile />;
}

function FullProfile() {
  const quests = useDailyQuests();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { width } = useWindowDimensions();
  const catalog = useCatalog();
  const today = useToday();
  // `?tab=badges` (a side quest notification) opens on that tab.
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(() => (TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'videos'));
  const [seenParam, setSeenParam] = useState(params.tab);
  if (params.tab !== seenParam) {
    setSeenParam(params.tab);
    if (TABS.includes(params.tab as Tab)) setTab(params.tab as Tab);
  }
  const navigation = useNavigation();
  // Cleared once festival mode has loaded, so a festival-mode Profile that takes over still sees it.
  const { hydrated: modeLoaded } = useFestivalMode();
  useEffect(() => {
    if (params.tab && modeLoaded) navigation.setParams({ tab: undefined } as never);
  }, [params.tab, navigation, modeLoaded]);
  // Rows you've tucked away (Your artists, Your festivals).
  const shelves = useProfileShelves();

  const social = useSocial();
  const myOrg = useMyOrg(social.user?.uid);
  const runs = useOrg(myOrg ?? undefined);
  const me = social.profile;
  const backdrop = useProfileBackdrop(me);
  const { going } = useGoing();
  // "Going to …" under your bio, as others see it on your profile: festivals you're going to that aren't over, soonest first.
  const goingNote = useMemo(() => {
    const names = [...going]
      .map((id) => catalog.festival(id))
      .filter((f): f is NonNullable<typeof f> => !!f && !isOver(f, today))
      .sort((a, b) => whenRank(a, today) - whenRank(b, today))
      .map((f) => f.name);
    const line = goingLine(names);
    // Your profile settings can hide your festivals from others; say so, since only you see this one.
    return line && me && !me.showFestivals ? t('{line} · only you can see this', { line }) : line;
  }, [going, catalog, today, me]);
  const { ratings } = useRatings();
  const { reactions } = useReactions();
  const pool = useClipPool();
  const mine = useMemo(() => yourClips(pool.clips, reactions), [pool.clips, reactions]);
  const kept = yourClipCount(mine);
  const { memories, uriOf } = useMoments();
  const videos = useMemo(() => videoGrid(memories), [memories]);
  const { followed } = useFollowedArtists();
  const followedCount = followed.filter((id) => catalog.artist(id)).length;
  const { crews } = useCrews();

  // Your sound as chips, from the live taste.
  const { taste, informed } = useTaste();
  const sounds = useMemo(() => tasteMix(catalog.artists, taste, informed).slice(0, 3), [catalog.artists, taste, informed]);

  // Your festivals, as they are for you (your weekend), soonest first.
  const { forYou, weekendOf } = useWeekends();
  const festivals = useMemo(
    () =>
      groupFestivals(catalog.festivals.map(forYou), going, today).going.map((f) => {
        const w = weekendOf(f.id);
        const when = countdown(f, today);
        const said = when ?? datesLine(f);
        return { festival: f, over: when === t('Over'), detail: w ? t('Weekend {w} · {when}', { w, when: said }) : said };
      }),
    [catalog.festivals, forYou, going, today, weekendOf],
  );
  // Pins, side quests and milestones, with what's waiting to be claimed.
  const b = useProfileBadges();
  // Add a festival you went to before: a video from your camera roll, tagged with it.
  const pickPast = useMemoryPicker();
  const { earned } = b;
  const mySet = b.passport;
  const recaps = useRecapFestivals();

  // Who drifts round your photo and fills Your artists: the artists you love, like and follow.
  const favourites = useMemo(
    () => favouriteArtists({ artists: catalog.artists, taste, informed, ratings, followed }),
    [catalog.artists, taste, informed, ratings, followed],
  );
  // Where the next of them plays, under the Your artists row.
  const where = useWhereTheyPlay();
  const nextDate = useMemo(() => nextLine(where.dates), [where.dates]);
  // The sound you've been feeling this week, from clips you enjoyed lately.
  const { seen } = useSeen();
  const now = useNow();
  const nowMs = now.getTime();
  const feeling = useMemo(
    () => currentlyFeeling({ seen, reactions, artistOfClip: (id) => catalog.artist(pool.find(id)?.artistId ?? ''), now: nowMs }),
    [seen, reactions, catalog, pool, nowMs],
  );

  const loves = useLoves();
  const year = today.getFullYear();
  const yearCard = useYear(year);
  const highlights = profileHighlights({
    going: festivals.filter((g) => !g.over).map((g) => ({ festival: g.festival, when: g.detail })),
    year: yearCard ? { year, soFar: isYearSoFar(yearCard) } : undefined,
    recaps,
  });

  // Your followers, fetched each time the tab comes into view; who you follow is known on the phone.
  const [followers, setFollowers] = useState<{ uid: string; n: number } | undefined>();
  const meUid = me?.uid;
  useFocusEffect(
    useCallback(() => {
      if (!meUid) return;
      let live = true;
      social.service
        .followCounts(meUid)
        .then((c) => live && setFollowers({ uid: meUid, n: c.followers }))
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [meUid, social.service]),
  );

  // Videos you're tagged in and said yes to, for Moments' Tagged filter; read each time the tab comes into view.
  const [tagged, setTagged] = useState<{ uid: string; list: Memory[] } | undefined>();
  useFocusEffect(
    useCallback(() => {
      if (!meUid) return;
      let live = true;
      social.service
        .taggedMemoriesOf(meUid)
        .then((list) => live && setTagged({ uid: meUid, list: list.filter((m) => !social.blocked.has(m.uid)).map(sharedAsMemory) }))
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [meUid, social.service, social.blocked]),
  );
  const taggedHere = meUid ? (tagged?.uid === meUid ? tagged.list : []) : undefined;

  const { shows: myShows } = useGoingShows();
  const showsSplit = useMemo(() => splitShows(myShows, localDay(today)), [myShows, today]);
  const scroller = useRef<ScrollView>(null);
  const tabsY = useRef(0);
  const stats = profileStats({
    social: !!me,
    // Festivals you've been to (on Afterglow or before it, as throwbacks) and are going to; one-night shows aren't festivals.
    festivals: mySet.been.length + mySet.planning.length + b.throwbacks.length,
    followers: followers?.uid === me?.uid ? followers?.n : undefined,
    following: social.following.size,
    artists: Object.keys(ratings).length,
    moments: memories.length,
    badges: earned,
  });

  const openHighlight = (h: Highlight) => {
    if (h.kind === 'festival') router.push(`/festival/${h.id}`);
    else if (h.kind === 'year') router.push({ pathname: '/year/[year]', params: { year: String(h.year) } });
    else router.push({ pathname: '/recap/[id]', params: { id: h.id } });
  };
  const signIn = () => (social.user ? router.push('/profile-edit') : router.push('/account'));

  return (
    <View style={styles.root}>
      <PageTitle title={t('Profile')} />
      <NightSky />
      <ScrollView ref={scroller} contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: tabSpace + space.xl }} showsVerticalScrollIndicator={false}>
        <ProfileCover url={me?.coverUrl} backdrop={backdrop} height={insets.top + COVER_H} fadeFrom={(insets.top + COVER_SOLID) / (insets.top + COVER_H)} />
        <View style={styles.bar}>
          <Text style={styles.handle} numberOfLines={1} accessibilityRole="header">
            {me ? `@${me.handle}` : t('Profile')}
          </Text>
          <IconButton label={t('Settings and more')} onPress={() => router.push('/settings')}>
            <MenuIcon color={color.moon} size={22} />
          </IconButton>
        </View>

        <ProfileHeader
          note={goingNote}
            socials={me?.socials}
          name={me?.displayName ?? t('You')}
          initial={!!me}
          bio={me ? me.bio : t('Your festivals, your videos and your sound.')}
          avatarUrl={me?.avatarUrl}
          uid={me?.uid}
          stats={stats}
          onStat={(key) => {
            // Festivals, Moments and Badges open their tab below, scrolled into view.
            const open = (to: Tab) => {
              setTab(to);
              scroller.current?.scrollTo({ y: Math.max(0, tabsY.current - space.md), animated: true });
            };
            if (key === 'festivals') open('festivals');
            else if (key === 'moments') open('videos');
            else if (key === 'badges') open('badges');
            else if (key === 'artists') router.push('/your-artists');
            else if (me) router.push({ pathname: '/follows/[handle]', params: { handle: me.handle, list: key } });
          }}
          sounds={sounds}
          onSounds={() => router.push('/your-sound')}
          orbit={favourites.slice(0, ORBIT_MAX)}
          onOrbit={() => router.navigate({ pathname: '/sound', params: { view: 'map' } })}
          feeling={feeling?.tag}
          level={quests.ready ? quests.level : null}
          onLevel={() => router.push('/quests')}
        >
          {me ? (
            <>
              <ProfileButton label={t('Edit profile')} onPress={() => router.push('/profile-edit')} />
              <ProfileButton label={t('Share profile')} onPress={() => void shareMessage(t('@{handle} on Afterglow: {url}', { handle: me.handle, url: `${WEB_URL}/u/${me.handle}` }))} />
            </>
          ) : social.availability.ok && social.ready ? (
            <ProfileButton label={social.user ? t('Finish your profile') : t('Create your profile')} onPress={signIn} glow />
          ) : null}
        </ProfileHeader>

        {/* Swap between your cover photo and background, in the corner just under the orbit. */}
        {me ? <CoverSwap me={me} shown={backdrop} style={{ top: insets.top + 205, right: space.lg }} /> : null}

        {/* An event organizer's account: the organizer it runs, and its studio. */}
        {runs ? <OrgProfileCard org={runs} own /> : null}

        <ClaimBanner b={b} />

        <YourArtistsRow favourites={favourites} next={nextDate} hidden={shelves.hidden.has('artists')} onToggle={() => shelves.toggle('artists')} />

        <Highlights
          items={highlights}
          onOpen={openHighlight}
          festivalOf={catalog.festival}
          hidden={shelves.hidden.has('festivals')}
          onToggle={() => shelves.toggle('festivals')}
        />

        <GardenShelf hidden={shelves.hidden.has('garden')} onToggle={() => shelves.toggle('garden')} />

        <View style={styles.tabs} onLayout={(e) => (tabsY.current = e.nativeEvent.layout.y)}>
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            items={[
              { key: 'videos', label: t('Moments'), count: memories.length, icon: (c) => <TilesIcon color={c} size={16} /> },
              { key: 'festivals', label: t('Festivals'), count: mySet.been.length + mySet.planning.length + b.throwbacks.length, icon: (c) => <FestivalsIcon color={c} size={17} /> },
              { key: 'badges', label: t('Badges'), count: earned, icon: (c) => <PinIcon color={c} size={17} /> },
              { key: 'saved', label: t('Saved'), count: kept, icon: (c) => <BookmarkIcon color={c} size={16} /> },
            ]}
          />
        </View>

        {tab === 'videos' ? (
          <VideosTab memories={videos} width={width} uriOf={uriOf} lookup={catalog} tagged={taggedHere} />
        ) : tab === 'badges' ? (
          <BadgesPanel b={b} uid={me?.uid} width={width} />
        ) : tab === 'festivals' ? (
          <PassportTab
            passport={mySet}
            artistOf={catalog.artist}
            loves={loves}
            recapIds={new Set(recaps.map((f) => f.id))}
            today={today}
            onFind={() => router.navigate('/festivals')}
            throwbacks={b.throwbacks}
            onAddPast={() => void pickPast('library')}
          >
            <CrewsList
              crews={social.user ? crews.map((c) => ({ id: c.id, name: c.name, festival: catalog.festival(c.festivalId)?.name, people: c.members.length })) : []}
            />
            {/* One-night shows: their own list (they aren't festivals, so they don't count as one). */}
            <GoingShowsList title={t('Shows you’re going to')} shows={showsSplit.upcoming} />
            <GoingShowsList title={t('Shows you went to')} shows={showsSplit.past} />
          </PassportTab>
        ) : (
          <SavedTab clips={[...mine.saved, ...mine.liked].slice(0, 12)} clipCount={kept} followedCount={followedCount} artistOf={catalog.artist} width={width} />
        )}
      </ScrollView>
      <BadgeCelebration unlock={b.unlock} onDone={b.finishUnlock} />
    </View>
  );
}

function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.icon, pressed && { opacity: 0.6 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: space.xl, paddingRight: space.md, marginBottom: space.lg },
  handle: { ...type.title, fontSize: 22, color: color.moon, flex: 1 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tabs: { marginTop: space.xl },

});
